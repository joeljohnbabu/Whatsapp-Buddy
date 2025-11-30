import { IntentParser } from '../../src/intent/parser';

describe('IntentParser', () => {
  const parser = new IntentParser();

  describe('Rule-based parsing', () => {
    it('should parse "Remind me tomorrow at 9am to call mom"', async () => {
      const result = await parser.parse('Remind me tomorrow at 9am to call mom');
      expect(result.type).toBe('REMINDER');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.data.subject).toContain('call mom');
      expect(result.data.scheduledFor).toBeInstanceOf(Date);
    });

    it('should parse "Can you ping me in 2 hours about the meeting?"', async () => {
      const result = await parser.parse('Can you ping me in 2 hours about the meeting?');
      expect(result.type).toBe('REMINDER');
      expect(result.data.subject).toContain('meeting');
      expect(result.data.scheduledFor).toBeInstanceOf(Date);
    });

    it('should parse "Snooze this for 30 minutes"', async () => {
      const result = await parser.parse('Snooze this for 30 minutes');
      expect(result.type).toBe('SNOOZE');
      expect(result.data.snoozeMinutes).toBe(30);
    });

    it('should parse "Cancel my reminder about rent"', async () => {
      const result = await parser.parse('Cancel my reminder about rent');
      expect(result.type).toBe('CANCEL');
      expect(result.data.subject).toContain('rent');
    });

    it('should parse "/remind 2025-12-01 18:00 Pay rent"', async () => {
      const result = await parser.parse('/remind 2025-12-01 18:00 Pay rent');
      expect(result.type).toBe('REMINDER');
      expect(result.data.subject).toContain('Pay rent');
      expect(result.data.scheduledFor).toBeInstanceOf(Date);
    });

    it('should parse "Summarize this thread"', async () => {
      const result = await parser.parse('Summarize this thread');
      expect(result.type).toBe('SUMMARIZE');
    });

    it('should parse "TL;DR this chat"', async () => {
      const result = await parser.parse('TL;DR this chat');
      expect(result.type).toBe('SUMMARIZE');
    });

    it('should parse opt-in "YES"', async () => {
      const result = await parser.parse('YES');
      expect(result.type).toBe('OPT_IN');
    });

    it('should parse opt-out "stop"', async () => {
      const result = await parser.parse('stop');
      expect(result.type).toBe('OPT_OUT');
    });
  });
});

