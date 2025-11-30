import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import { cancelReminder } from '../scheduler/jobs';
import { getEnv } from '../config/env';

const router = Router();

/**
 * GET /reminders - List reminders for a user (requires phone number query param)
 */
router.get('/reminders', async (req: Request, res: Response) => {
  try {
    const phoneNumber = req.query.phoneNumber as string;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber query parameter required' });
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const reminders = await prisma.reminder.findMany({
      where: { userId: user.id },
      orderBy: { scheduledFor: 'asc' },
      take: 50,
    });

    res.json({ reminders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /reminders/:id - Cancel a reminder
 */
router.delete('/reminders/:id', async (req: Request, res: Response) => {
  try {
    const reminderId = req.params.id;
    const phoneNumber = req.query.phoneNumber as string;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber query parameter required' });
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const success = await cancelReminder(reminderId, user.id);
    if (success) {
      res.json({ message: 'Reminder cancelled' });
    } else {
      res.status(404).json({ error: 'Reminder not found or already cancelled' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /delete-data - Delete all user data (privacy)
 */
router.delete('/delete-data', async (req: Request, res: Response) => {
  try {
    const phoneNumber = req.query.phoneNumber as string;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber query parameter required' });
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user (cascade will delete reminders, messages, threads)
    await prisma.user.delete({
      where: { id: user.id },
    });

    res.json({ message: 'All user data deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /health - Health check
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});

export default router;

