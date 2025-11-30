import { Worker, Job } from 'bullmq';
import { getEnv } from '../config/env';
import IORedis from 'ioredis';
import { whatsappClient } from '../whatsapp/client';
import { prisma } from '../db/client';
import { ReminderStatus } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { scheduleNextRecurrence } from './jobs';

const env = getEnv();
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

interface ReminderJobData {
  reminderId: string;
  userId: string;
  phoneNumber: string;
  subject: string;
  originalText?: string;
  isRecurring: boolean;
  recurrenceType?: string;
}

/**
 * Process reminder jobs and send WhatsApp messages
 */
export function startReminderWorker(): Worker {
  const worker = new Worker<ReminderJobData>(
    'reminders',
    async (job: Job<ReminderJobData>) => {
      const { reminderId, phoneNumber, subject, originalText, isRecurring } = job.data;

      // Verify reminder still exists and is pending
      const reminder = await prisma.reminder.findUnique({
        where: { id: reminderId },
      });

      if (!reminder || reminder.status !== ReminderStatus.PENDING) {
        console.log(`Reminder ${reminderId} no longer pending, skipping`);
        return;
      }

      // Build message
      let messageBody = `🔔 Reminder: ${subject}`;
      if (originalText) {
        messageBody += `\n\nOriginal: "${originalText}"`;
      }

      // Add quick actions
      messageBody += `\n\nQuick actions:\n• SNOOZE 10m\n• SNOOZE 30m\n• DONE`;

      // Send via WhatsApp
      const result = await whatsappClient.sendMessage({
        to: phoneNumber,
        body: messageBody,
      });

      if (result.success) {
        // Mark as delivered
        await prisma.reminder.update({
          where: { id: reminderId },
          data: {
            status: ReminderStatus.DELIVERED,
            deliveredAt: new Date(),
          },
        });

        // Schedule next recurrence if applicable
        if (isRecurring) {
          await scheduleNextRecurrence(reminderId);
        }
      } else {
        throw new Error(`Failed to send reminder: ${result.error}`);
      }
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Reminder job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Reminder job ${job?.id} failed:`, err);
  });

  return worker;
}

