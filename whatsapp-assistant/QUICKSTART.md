# Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:
- `DATABASE_URL` (use Docker Compose defaults or your PostgreSQL)
- `REDIS_URL` (use Docker Compose defaults or your Redis)
- `WHATSAPP_PROVIDER=twilio` (for development)
- `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` (get from Twilio Console)
- `OPENAI_API_KEY` (for LLM features)

### 3. Start Services with Docker

```bash
docker-compose up -d postgres redis
```

### 4. Setup Database

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

### 6. Test Locally with ngrok

```bash
# In another terminal
ngrok http 3000
```

Use the ngrok URL as your webhook URL in Twilio/Meta.

### 7. Test Webhook

```bash
# Using the test script
chmod +x examples/webhook-test.sh
./examples/webhook-test.sh http://localhost:3000
```

Or use the Postman collection in `examples/postman-collection.json`.

## Next Steps

1. **Configure Twilio Sandbox:**
   - Go to Twilio Console → WhatsApp → Sandbox
   - Send "join [code]" to the sandbox number
   - Set webhook URL to your ngrok URL + `/webhook`

2. **Test Reminder Creation:**
   - Send: "Remind me tomorrow at 9am to call mom"
   - You should receive a confirmation

3. **View Reminders:**
   ```bash
   curl "http://localhost:3000/api/reminders?phoneNumber=+1234567890"
   ```

## Common Issues

- **Database connection error:** Ensure PostgreSQL is running (`docker-compose ps`)
- **Redis connection error:** Ensure Redis is running
- **Webhook not receiving:** Check ngrok is running and URL is correct
- **Reminders not sending:** Check worker logs and Redis connection

## Production Deployment

See `README.md` for full deployment instructions.

