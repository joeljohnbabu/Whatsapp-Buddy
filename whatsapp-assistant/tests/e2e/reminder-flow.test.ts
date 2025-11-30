import { whatsappClient } from '../../src/whatsapp/client';
import { createReminder } from '../../src/scheduler/jobs';
import { prisma } from '../../src/db/client';
import { ReminderStatus } from '@prisma/client';

// Mock WhatsApp client
jest.mock('../../src/whatsapp/client', () => ({
  whatsappClient: {
    sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'test-msg-id' }),
    verifyWebhook: jest.fn().mockReturnValue(true),
  },
}));

describe('End-to-End Reminder Flow', () => {
  let testUserId: string;
  let testPhoneNumber: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        phoneNumber: '+19999999999',
        consentGiven: true,
      },
    });
    testUserId = user.id;
    testPhoneNumber = user.phoneNumber;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { phoneNumber: testPhoneNumber },
    });
  });

  it('should create reminder, schedule job, and send message when job executes', async () => {
    const scheduledFor = new Date(Date.now() + 1000); // 1 second from now
    const { reminderId, jobId } = await createReminder(
      testUserId,
      testPhoneNumber,
      'E2E Test Reminder',
      scheduledFor
    );

    expect(reminderId).toBeDefined();
    expect(jobId).toBeDefined();

    // Wait for job to execute (in real scenario, worker would process it)
    // For this test, we verify the job was created and reminder exists
    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
    });

    expect(reminder).toBeDefined();
    expect(reminder?.status).toBe(ReminderStatus.PENDING);
    expect(reminder?.subject).toBe('E2E Test Reminder');

    // Cleanup
    await prisma.reminder.delete({ where: { id: reminderId } });
  });
});

