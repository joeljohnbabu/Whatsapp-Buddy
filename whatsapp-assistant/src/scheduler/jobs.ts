import { reminderQueue } from './queue';
import { format, formatInTimeZone } from 'date-fns-tz';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { prisma } from '../db/client';
import { ReminderStatus, RecurrenceType } from '@prisma/client';

export interface ReminderJobData {
  reminderId: string;
  userId: string;
  phoneNumber: string;
  subject: string;
  originalText?: string;
  isRecurring: boolean;
  recurrenceType?: RecurrenceType;
}

/**
 * Create and enqueue a reminder job
 */
export async function createReminderJob(data: ReminderJobData, scheduledFor: Date): Promise<string> {
  const job = await reminderQueue.add(
    'send-reminder',
    data,
    {
      jobId: `reminder-${data.reminderId}`,
      delay: Math.max(0, scheduledFor.getTime() - Date.now()),
    }
  );

  return job.id!;
}

/**
 * Create a reminder in the database and schedule it
 */
export async function createReminder(
  userId: string,
  phoneNumber: string,
  subject: string,
  scheduledFor: Date,
  options?: {
    originalText?: string;
    recurrenceType?: RecurrenceType;
    recurrenceEnd?: Date;
  }
): Promise<{ reminderId: string; jobId: string }> {
  const reminder = await prisma.reminder.create({
    data: {
      userId,
      subject,
      scheduledFor,
      originalText: options?.originalText,
      status: ReminderStatus.PENDING,
      isRecurring: !!options?.recurrenceType,
      recurrenceType: options?.recurrenceType || null,
      recurrenceEnd: options?.recurrenceEnd || null,
    },
  });

  const jobId = await createReminderJob(
    {
      reminderId: reminder.id,
      userId,
      phoneNumber,
      subject,
      originalText: options?.originalText,
      isRecurring: !!options?.recurrenceType,
      recurrenceType: options?.recurrenceType,
    },
    scheduledFor
  );

  return { reminderId: reminder.id, jobId };
}

/**
 * Cancel a reminder and remove its job
 */
export async function cancelReminder(reminderId: string, userId: string): Promise<boolean> {
  const reminder = await prisma.reminder.findFirst({
    where: {
      id: reminderId,
      userId,
      status: ReminderStatus.PENDING,
    },
  });

  if (!reminder) {
    return false;
  }

  // Cancel in database
  await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      status: ReminderStatus.CANCELLED,
      cancelledAt: new Date(),
    },
  });

  // Remove job from queue
  const job = await reminderQueue.getJob(`reminder-${reminderId}`);
  if (job) {
    await job.remove();
  }

  return true;
}

/**
 * Snooze a reminder (create new reminder, cancel old one)
 */
export async function snoozeReminder(
  reminderId: string,
  userId: string,
  snoozeMinutes: number
): Promise<{ reminderId: string; jobId: string } | null> {
  const reminder = await prisma.reminder.findFirst({
    where: {
      id: reminderId,
      userId,
      status: ReminderStatus.PENDING,
    },
  });

  if (!reminder) {
    return null;
  }

  // Cancel old reminder
  await cancelReminder(reminderId, userId);

  // Create new reminder
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const newScheduledFor = new Date(Date.now() + snoozeMinutes * 60 * 1000);

  return createReminder(
    userId,
    user.phoneNumber,
    reminder.subject,
    newScheduledFor,
    {
      originalText: reminder.originalText,
      recurrenceType: reminder.recurrenceType || undefined,
      recurrenceEnd: reminder.recurrenceEnd || undefined,
    }
  );
}

/**
 * Handle recurring reminder - create next occurrence
 */
export async function scheduleNextRecurrence(reminderId: string): Promise<void> {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { user: true },
  });

  if (!reminder || !reminder.isRecurring || !reminder.recurrenceType) {
    return;
  }

  // Check if recurrence has ended
  if (reminder.recurrenceEnd && reminder.recurrenceEnd < new Date()) {
    return;
  }

  let nextDate: Date;
  const baseDate = reminder.scheduledFor;

  switch (reminder.recurrenceType) {
    case RecurrenceType.DAILY:
      nextDate = addDays(baseDate, 1);
      break;
    case RecurrenceType.WEEKLY:
      nextDate = addWeeks(baseDate, 1);
      break;
    case RecurrenceType.MONTHLY:
      nextDate = addMonths(baseDate, 1);
      break;
    default:
      return;
  }

  // Create next reminder
  await createReminder(
    reminder.userId,
    reminder.user.phoneNumber,
    reminder.subject,
    nextDate,
    {
      originalText: reminder.originalText,
      recurrenceType: reminder.recurrenceType,
      recurrenceEnd: reminder.recurrenceEnd || undefined,
    }
  );
}

