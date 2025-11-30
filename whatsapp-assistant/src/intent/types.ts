export type IntentType =
  | 'REMINDER'
  | 'SNOOZE'
  | 'CANCEL'
  | 'SUMMARIZE'
  | 'QUICK_REPLY'
  | 'ASK'
  | 'OPT_IN'
  | 'OPT_OUT'
  | 'UNKNOWN';

export interface ParsedIntent {
  type: IntentType;
  confidence: number;
  data: {
    subject?: string;
    scheduledFor?: Date;
    reminderId?: string;
    recurrenceType?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    recurrenceEnd?: Date;
    snoozeMinutes?: number;
    query?: string;
  };
}

export interface IntentParser {
  parse(text: string, context?: { userId?: string; threadId?: string }): Promise<ParsedIntent>;
}

