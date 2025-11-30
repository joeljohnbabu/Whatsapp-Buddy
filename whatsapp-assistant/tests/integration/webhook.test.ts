import request from 'supertest';
import express from 'express';
import { handleWebhook } from '../../src/webhook/handler';
import { prisma } from '../../src/db/client';
import { getEnv } from '../../src/config/env';

// Mock WhatsApp client
jest.mock('../../src/whatsapp/client', () => ({
  whatsappClient: {
    sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'test-msg-id' }),
    verifyWebhook: jest.fn().mockReturnValue(true),
  },
}));

// Mock LLM
jest.mock('../../src/nlp/llm', () => ({
  getLLMResponse: jest.fn().mockResolvedValue(JSON.stringify({
    type: 'UNKNOWN',
    confidence: 0.5,
    data: {},
  })),
}));

describe('Webhook Integration Tests', () => {
  const app = express();
  app.use(express.json());
  app.post('/webhook', handleWebhook);

  let testPhoneNumber: string;

  beforeEach(() => {
    testPhoneNumber = `+1${Math.floor(Math.random() * 10000000000)}`;
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.user.deleteMany({
      where: { phoneNumber: testPhoneNumber },
    });
  });

  describe('First-time user flow', () => {
    it('should send opt-in message to new user', async () => {
      const { whatsappClient } = require('../../src/whatsapp/client');
      
      const webhookPayload = {
        From: `whatsapp:${testPhoneNumber}`,
        Body: 'Hello',
        MessageSid: 'test-msg-1',
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      // Verify user created
      const user = await prisma.user.findUnique({
        where: { phoneNumber: testPhoneNumber },
      });
      expect(user).toBeDefined();
      expect(user?.consentGiven).toBe(false);

      // Verify opt-in message sent
      expect(whatsappClient.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testPhoneNumber,
          body: expect.stringContaining('opt in'),
        })
      );
    });

    it('should accept opt-in and create user', async () => {
      const { whatsappClient } = require('../../src/whatsapp/client');
      
      const webhookPayload = {
        From: `whatsapp:${testPhoneNumber}`,
        Body: 'YES',
        MessageSid: 'test-msg-2',
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      const user = await prisma.user.findUnique({
        where: { phoneNumber: testPhoneNumber },
      });
      expect(user?.consentGiven).toBe(true);
    });
  });

  describe('Reminder creation', () => {
    it('should create reminder from webhook', async () => {
      // Create user with consent
      const user = await prisma.user.create({
        data: {
          phoneNumber: testPhoneNumber,
          consentGiven: true,
        },
      });

      const webhookPayload = {
        From: `whatsapp:${testPhoneNumber}`,
        Body: 'Remind me tomorrow at 9am to call mom',
        MessageSid: 'test-msg-3',
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      // Verify reminder created
      const reminders = await prisma.reminder.findMany({
        where: { userId: user.id },
      });

      expect(reminders.length).toBeGreaterThan(0);
      expect(reminders[0].subject).toContain('call mom');
      expect(reminders[0].status).toBe('PENDING');

      // Cleanup
      await prisma.reminder.deleteMany({ where: { userId: user.id } });
    });
  });
});

