import { ParsedIntent, IntentType } from './types';
import { parse as parseDate } from 'date-fns';
import { add, addHours, addDays, addWeeks, addMonths, startOfDay, isAfter, parseISO } from 'date-fns';
import { getLLMResponse } from '../nlp/llm';

/**
 * Hybrid intent parser: rule-based regex patterns + LLM fallback
 */
export class IntentParser {
  /**
   * Parse user message to extract intent
   */
  async parse(
    text: string,
    context?: { userId?: string; threadId?: string }
  ): Promise<ParsedIntent> {
    const normalized = text.trim().toLowerCase();

    // Rule-based parsing (high confidence)
    const ruleBasedResult = this.parseWithRules(normalized, text);
    if (ruleBasedResult.confidence >= 0.8) {
      return ruleBasedResult;
    }

    // LLM fallback for ambiguous cases
    return this.parseWithLLM(text, context);
  }

  /**
   * Rule-based parsing using regex patterns
   */
  private parseWithRules(normalized: string, original: string): ParsedIntent {
    // OPT_IN / OPT_OUT
    if (/^(yes|yep|yeah|ok|okay|sure|i agree|accept)$/i.test(normalized)) {
      return {
        type: 'OPT_IN',
        confidence: 0.95,
        data: {},
      };
    }
    if (/^(no|nope|stop|unsubscribe|cancel|opt.?out)$/i.test(normalized)) {
      return {
        type: 'OPT_OUT',
        confidence: 0.95,
        data: {},
      };
    }

    // CANCEL
    const cancelMatch = normalized.match(
      /(?:cancel|delete|remove|stop)\s+(?:my\s+)?(?:reminder|remind)\s+(?:about|for|to)?\s*(.+)/i
    );
    if (cancelMatch) {
      return {
        type: 'CANCEL',
        confidence: 0.9,
        data: {
          subject: cancelMatch[1].trim(),
        },
      };
    }

    // SNOOZE
    const snoozeMatch = normalized.match(
      /(?:snooze|postpone|delay|remind\s+me\s+later)\s+(?:this\s+)?(?:for\s+)?(\d+)\s*(min|mins|minute|minutes|hour|hours|h|m)/i
    );
    if (snoozeMatch) {
      const amount = parseInt(snoozeMatch[1]);
      const unit = snoozeMatch[2].toLowerCase();
      const minutes = unit.includes('hour') || unit === 'h' ? amount * 60 : amount;
      return {
        type: 'SNOOZE',
        confidence: 0.9,
        data: {
          snoozeMinutes: minutes,
        },
      };
    }

    // REMINDER with explicit datetime
    const explicitDateMatch = original.match(
      /\/remind\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})\s+(.+)/i
    );
    if (explicitDateMatch) {
      const [, dateStr, hour, minute, subject] = explicitDateMatch;
      try {
        const scheduledFor = parseISO(`${dateStr}T${hour}:${minute}:00`);
        if (isAfter(scheduledFor, new Date())) {
          return {
            type: 'REMINDER',
            confidence: 0.95,
            data: {
              subject: subject.trim(),
              scheduledFor,
            },
          };
        }
      } catch (e) {
        // Invalid date, continue
      }
    }

    // REMINDER with natural language
    const reminderPatterns = [
      {
        pattern: /remind\s+me\s+(?:tomorrow|today)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(?:to|about|for)\s+(.+)/i,
        extract: (match: RegExpMatchArray, now: Date) => {
          let hour = parseInt(match[1]);
          const minute = match[2] ? parseInt(match[2]) : 0;
          const ampm = match[3]?.toLowerCase();
          const subject = match[4].trim();

          if (ampm === 'pm' && hour !== 12) hour += 12;
          if (ampm === 'am' && hour === 12) hour = 0;

          const isTomorrow = match[0].toLowerCase().includes('tomorrow');
          const baseDate = isTomorrow ? addDays(now, 1) : now;
          const scheduledFor = startOfDay(baseDate);
          scheduledFor.setHours(hour, minute, 0, 0);

          if (!isAfter(scheduledFor, now)) {
            scheduledFor.setDate(scheduledFor.getDate() + 1);
          }

          return { subject, scheduledFor };
        },
      },
      {
        pattern: /(?:ping|remind|alert)\s+me\s+(?:in\s+)?(\d+)\s+(hour|hours|minute|minutes|day|days|week|weeks)\s+(?:about|for|to|that)\s+(.+)/i,
        extract: (match: RegExpMatchArray, now: Date) => {
          const amount = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          const subject = match[3].trim();

          let scheduledFor: Date;
          if (unit.includes('hour')) scheduledFor = addHours(now, amount);
          else if (unit.includes('minute')) scheduledFor = add(now, { minutes: amount });
          else if (unit.includes('day')) scheduledFor = addDays(now, amount);
          else if (unit.includes('week')) scheduledFor = addWeeks(now, amount);
          else scheduledFor = addHours(now, amount);

          return { subject, scheduledFor };
        },
      },
      {
        pattern: /remind\s+me\s+(?:to|about|for)\s+(.+?)\s+(?:tomorrow|today|in\s+\d+)/i,
        extract: (match: RegExpMatchArray, now: Date) => {
          // Fallback - will need LLM for better extraction
          return { subject: match[1].trim(), scheduledFor: addHours(now, 1) };
        },
      },
    ];

    for (const { pattern, extract } of reminderPatterns) {
      const match = original.match(pattern);
      if (match) {
        try {
          const { subject, scheduledFor } = extract(match, new Date());
          if (isAfter(scheduledFor, new Date())) {
            // Check for recurrence
            const recurringMatch = normalized.match(/(daily|weekly|monthly)/i);
            let recurrenceType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | undefined;
            if (recurringMatch) {
              const rec = recurringMatch[1].toLowerCase();
              if (rec === 'daily') recurrenceType = 'DAILY';
              else if (rec === 'weekly') recurrenceType = 'WEEKLY';
              else if (rec === 'monthly') recurrenceType = 'MONTHLY';
            }

            return {
              type: 'REMINDER',
              confidence: 0.85,
              data: {
                subject,
                scheduledFor,
                recurrenceType,
              },
            };
          }
        } catch (e) {
          // Continue to next pattern
        }
      }
    }

    // SUMMARIZE
    if (/^(?:summarize|summary|tl;?dr|tldr|recap)\s*(?:this\s+)?(?:thread|chat|conversation)?$/i.test(normalized)) {
      return {
        type: 'SUMMARIZE',
        confidence: 0.9,
        data: {},
      };
    }

    // Default: unknown
    return {
      type: 'UNKNOWN',
      confidence: 0.1,
      data: {},
    };
  }

  /**
   * LLM fallback for ambiguous or complex intents
   */
  private async parseWithLLM(
    text: string,
    context?: { userId?: string; threadId?: string }
  ): Promise<ParsedIntent> {
    const prompt = `You are an intent parser for a WhatsApp reminder assistant. Analyze the following message and extract the intent.

Message: "${text}"

Respond with a JSON object in this exact format:
{
  "type": "REMINDER" | "SNOOZE" | "CANCEL" | "SUMMARIZE" | "QUICK_REPLY" | "ASK" | "UNKNOWN",
  "confidence": 0.0-1.0,
  "data": {
    "subject": "extracted reminder subject or null",
    "scheduledFor": "ISO 8601 datetime string or null",
    "snoozeMinutes": number or null,
    "recurrenceType": "DAILY" | "WEEKLY" | "MONTHLY" or null,
    "query": "search/ask query or null"
  }
}

Examples:
- "Remind me tomorrow at 9am to call mom" → {"type": "REMINDER", "confidence": 0.95, "data": {"subject": "call mom", "scheduledFor": "2025-12-01T09:00:00Z"}}
- "Snooze this for 30 minutes" → {"type": "SNOOZE", "confidence": 0.9, "data": {"snoozeMinutes": 30}}
- "Cancel my reminder about rent" → {"type": "CANCEL", "confidence": 0.9, "data": {"subject": "rent"}}

Only respond with valid JSON, no other text.`;

    try {
      const response = await getLLMResponse(prompt);
      const parsed = JSON.parse(response.trim());
      
      // Validate and transform
      if (parsed.data?.scheduledFor) {
        parsed.data.scheduledFor = new Date(parsed.data.scheduledFor);
      }

      return parsed as ParsedIntent;
    } catch (error) {
      // Fallback to rule-based unknown
      return {
        type: 'UNKNOWN',
        confidence: 0.1,
        data: {},
      };
    }
  }
}

export const intentParser = new IntentParser();

