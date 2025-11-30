import express, { Express } from 'express';
import { getEnv } from './config/env';
import { handleWebhook } from './webhook/handler';
import apiRoutes from './api/routes';
import { startReminderWorker } from './scheduler/worker';
import { prisma } from './db/client';

const app: Express = express();
const env = getEnv();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook endpoint (must be raw body for signature verification)
app.post('/webhook', handleWebhook);
app.get('/webhook', handleWebhook); // For Meta verification

// API routes
app.use('/api', apiRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp Assistant (Boomerang)',
    version: '1.0.0',
    status: 'running',
  });
});

// Start reminder worker
const worker = startReminderWorker();
console.log('Reminder worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
const PORT = parseInt(env.PORT, 10);
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 WhatsApp provider: ${env.WHATSAPP_PROVIDER}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
});

