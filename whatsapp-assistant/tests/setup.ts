// Test setup file
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.WHATSAPP_PROVIDER = 'twilio';
process.env.OPENAI_API_KEY = 'test-key';
process.env.PORT = '3000';

