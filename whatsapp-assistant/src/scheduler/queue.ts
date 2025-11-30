import { Queue } from 'bullmq';
import { getEnv } from '../config/env';
import IORedis from 'ioredis';

const env = getEnv();
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const reminderQueue = new Queue('reminders', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

