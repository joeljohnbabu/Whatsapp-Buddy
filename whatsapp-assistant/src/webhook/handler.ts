import { Request, Response } from 'express';
import { whatsappClient } from '../whatsapp/client';
import { intentParser } from '../intent/parser';
import { prisma } from '../db/client';
import { createReminder, cancelReminder, snoozeReminder } from '../scheduler/jobs';
import { summarizeThread } from '../nlp/summarize';
import { generateQuickReplies } from '../nlp/quickReply';
import { getEnv } from '../config/env';
import { MessageDirection } from '@prisma/client';
import { addDays } from 'date-fns';

/**
 * Extract phone number from WhatsApp message
 */
function extractPhoneNumber(message: any, provider: string): string | null {
  if (provider === 'meta') {
    return message.from || message.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  } else if (provider === 'twilio') {
    return message.From?.replace('whatsapp:', '') || message.From;
  }
  return null;
}

/**
 * Extract message text from WhatsApp webhook
 */
function extractMessageText(message: any, provider: string): string | null {
  if (provider === 'meta') {
    return (
      message.text?.body ||
      message.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body
    );
  } else if (provider === 'twilio') {
    return message.Body;
  }
  return null;
}

/**
 * Extract message ID from WhatsApp webhook
 */
function extractMessageId(message: any, provider: string): string | null {
  if (provider === 'meta') {
    return message.id || message.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
  } else if (provider === 'twilio') {
    return message.MessageSid;
  }
  return null;
}

/**
 * Handle incoming WhatsApp webhook
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const env = getEnv();
  const provider = env.WHATSAPP_PROVIDER;

  try {
    // Verify webhook signature
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-twilio-signature'] || '';
    if (typeof signature === 'string' && !whatsappClient.verifyWebhook(req.body, signature)) {
      console.warn('Webhook signature verification failed');
      // Continue for development, but log warning
    }

    // Handle webhook verification (Meta)
    if (provider === 'meta' && req.query['hub.mode'] === 'subscribe') {
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      if (token === env.META_VERIFY_TOKEN) {
        res.status(200).send(challenge);
        return;
      } else {
        res.status(403).send('Forbidden');
        return;
      }
    }

    // Extract message data
    const messageData = provider === 'meta' 
      ? req.body.entry?.[0]?.changes?.[0]?.value
      : req.body;

    const phoneNumber = extractPhoneNumber(messageData, provider);
    const messageText = extractMessageText(messageData, provider);
    const messageId = extractMessageId(messageData, provider);

    if (!phoneNumber || !messageText) {
      res.status(200).json({ status: 'ok', message: 'No actionable message' });
      return;
    }

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phoneNumber,
          consentGiven: false,
        },
      });
    }

    // Store incoming message
    const message = await prisma.message.create({
      data: {
        userId: user.id,
        whatsappMessageId: messageId || undefined,
        content: messageText,
        direction: MessageDirection.INBOUND,
        expiresAt: addDays(new Date(), parseInt(env.MESSAGE_RETENTION_DAYS)),
      },
    });

    // Handle first-time user (opt-in flow)
    if (!user.consentGiven) {
      if (messageText.trim().toUpperCase() === 'YES') {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            consentGiven: true,
            consentDate: new Date(),
          },
        });

        await whatsappClient.sendMessage({
          to: phoneNumber,
          body: 'Great! I\'m Boomerang, your WhatsApp assistant. I can help you:\n\n• Set reminders\n• Summarize threads\n• Quick replies\n\nTry: "Remind me tomorrow at 9am to call mom"',
        });
      } else {
        await whatsappClient.sendMessage({
          to: phoneNumber,
          body: 'Hi — I\'m Boomerang. I can help you set reminders and summarize threads. Reply YES to opt in.',
        });
      }
      res.status(200).json({ status: 'ok' });
      return;
    }

    // Parse intent
    const intent = await intentParser.parse(messageText, {
      userId: user.id,
      threadId: message.threadId || undefined,
    });

    // Store intent data
    await prisma.message.update({
      where: { id: message.id },
      data: {
        intent: intent.type,
        intentData: JSON.stringify(intent.data),
      },
    });

    // Handle intents
    let responseText = '';

    switch (intent.type) {
      case 'REMINDER': {
        if (intent.data.scheduledFor && intent.data.subject) {
          const { reminderId } = await createReminder(
            user.id,
            phoneNumber,
            intent.data.subject,
            intent.data.scheduledFor,
            {
              originalText: messageText,
              recurrenceType: intent.data.recurrenceType,
            }
          );

          const formattedDate = formatInTimeZone(
            intent.data.scheduledFor,
            'UTC',
            'MMM d, yyyy h:mm a zzz'
          );

          responseText = `Got it — I'll remind you on ${formattedDate}. Reply CANCEL to remove or SNOOZE to postpone.`;
        } else {
          responseText = 'I couldn\'t understand when to remind you. Try: "Remind me tomorrow at 9am to call mom"';
        }
        break;
      }

      case 'SNOOZE': {
        if (intent.data.snoozeMinutes) {
          // Find the most recent pending reminder
          const recentReminder = await prisma.reminder.findFirst({
            where: {
              userId: user.id,
              status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
          });

          if (recentReminder) {
            await snoozeReminder(recentReminder.id, user.id, intent.data.snoozeMinutes);
            responseText = `Snoozed for ${intent.data.snoozeMinutes} minutes.`;
          } else {
            responseText = 'No active reminder found to snooze.';
          }
        } else {
          responseText = 'How long should I snooze? Try: "Snooze for 30 minutes"';
        }
        break;
      }

      case 'CANCEL': {
        const reminders = await prisma.reminder.findMany({
          where: {
            userId: user.id,
            status: 'PENDING',
            subject: {
              contains: intent.data.subject || '',
              mode: 'insensitive',
            },
          },
        });

        if (reminders.length > 0) {
          for (const reminder of reminders) {
            await cancelReminder(reminder.id, user.id);
          }
          responseText = `Cancelled ${reminders.length} reminder(s).`;
        } else {
          responseText = 'No matching reminder found to cancel.';
        }
        break;
      }

      case 'SUMMARIZE': {
        const threadMessages = await prisma.message.findMany({
          where: {
            userId: user.id,
            threadId: message.threadId || undefined,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        if (threadMessages.length > 0) {
          const summary = await summarizeThread(threadMessages.reverse());
          responseText = `📋 Summary:\n${summary.summary}\n\nAction items:\n${summary.actionItems.map((item) => `• ${item}`).join('\n')}`;
        } else {
          responseText = 'No messages found to summarize.';
        }
        break;
      }

      case 'OPT_OUT': {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            consentGiven: false,
          },
        });
        responseText = 'You\'ve been unsubscribed. Reply YES to opt back in.';
        break;
      }

      default: {
        // Generate quick replies for unknown intents
        const quickReplies = await generateQuickReplies(message);
        responseText = `I'm not sure how to help with that. Quick replies:\n${quickReplies.map((r) => `• ${r}`).join('\n')}`;
      }
    }

    // Send response
    if (responseText) {
      await whatsappClient.sendMessage({
        to: phoneNumber,
        body: responseText,
      });

      // Store outbound message
      await prisma.message.create({
        data: {
          userId: user.id,
          content: responseText,
          direction: MessageDirection.OUTBOUND,
          expiresAt: addDays(new Date(), parseInt(env.MESSAGE_RETENTION_DAYS)),
        },
      });
    }

    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

