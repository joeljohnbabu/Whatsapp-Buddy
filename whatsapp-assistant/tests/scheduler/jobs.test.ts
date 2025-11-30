import { createReminder, cancelReminder, snoozeReminder } from '../../src/scheduler/jobs';
import { prisma } from '../../src/db/client';
import { ReminderStatus } from '@prisma/client';

// Mock the queue
jest.mock('../../src/scheduler/queue', () => ({
  reminderQueue: {
    add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
    getJob: jest.fn().mockResolvedValue({
      remove: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe('Scheduler Jobs', () => {
  let testUserId: string;
  let testPhoneNumber: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        phoneNumber: '+1234567890',
        consentGiven: true,
      },
    });
    testUserId = user.id;
    testPhoneNumber = user.phoneNumber;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({
      where: { phoneNumber: testPhoneNumber },
    });
  });

  describe('createReminder', () => {
    it('should create a reminder and schedule a job', async () => {
      const scheduledFor = new Date(Date.now() + 3600000); // 1 hour from now
      const result = await createReminder(
        testUserId,
        testPhoneNumber,
        'Test reminder',
        scheduledFor
      );

      expect(result.reminderId).toBeDefined();
      expect(result.jobId).toBeDefined();

      // Verify reminder in DB
      const reminder = await prisma.reminder.findUnique({
        where: { id: result.reminderId },
      });

      expect(reminder).toBeDefined();
      expect(reminder?.subject).toBe('Test reminder');
      expect(reminder?.status).toBe(ReminderStatus.PENDING);

      // Cleanup
      await prisma.reminder.delete({ where: { id: result.reminderId } });
    });
  });

  describe('cancelReminder', () => {
    it('should cancel a pending reminder', async () => {
      const scheduledFor = new Date(Date.now() + 3600000);
      const { reminderId } = await createReminder(
        testUserId,
        testPhoneNumber,
        'Cancel test',
        scheduledFor
      );

      const success = await cancelReminder(reminderId, testUserId);
      expect(success).toBe(true);

      const reminder = await prisma.reminder.findUnique({
        where: { id: reminderId },
      });

      expect(reminder?.status).toBe(ReminderStatus.CANCELLED);
      expect(reminder?.cancelledAt).toBeDefined();
    });
  });

  describe('snoozeReminder', () => {
    it('should snooze a reminder', async () => {
      const scheduledFor = new Date(Date.now() + 3600000);
      const { reminderId } = await createReminder(
        testUserId,
        testPhoneNumber,
        'Snooze test',
        scheduledFor
      );

      const result = await snoozeReminder(reminderId, testUserId, 30);
      expect(result).toBeDefined();
      expect(result?.reminderId).toBeDefined();

      // Verify old reminder is cancelled
      const oldReminder = await prisma.reminder.findUnique({
        where: { id: reminderId },
      });
      expect(oldReminder?.status).toBe(ReminderStatus.CANCELLED);

      // Cleanup
      if (result) {
        await prisma.reminder.delete({ where: { id: result.reminderId } });
      }
    });
  });
});

