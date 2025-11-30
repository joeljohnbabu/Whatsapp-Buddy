# WhatsApp Assistant (Boomerang for WhatsApp)

A production-ready MVP for a WhatsApp assistant that handles reminders, snooze, quick auto-responses, and thread summarization. Built with Node.js, TypeScript, Express, PostgreSQL, and Redis.

## Features

- ✅ **Reminder Management**: Create, cancel, and snooze reminders via natural language
- ✅ **Thread Summarization**: Get AI-powered summaries of conversation threads
- ✅ **Quick Replies**: Generate contextual reply suggestions
- ✅ **Recurring Reminders**: Support for daily, weekly, and monthly recurrence
- ✅ **Consent Flow**: First-time user opt-in/opt-out mechanism
- ✅ **Privacy Controls**: Data retention policies and user data deletion
- ✅ **Multi-Provider Support**: Works with Meta Cloud API (WhatsApp Business API) or Twilio
- ✅ **LLM Integration**: Abstracted LLM layer supporting OpenAI-compatible APIs

## Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL with Prisma ORM
- **Scheduler**: Redis + BullMQ
- **LLM**: OpenAI-compatible API (configurable)
- **Testing**: Jest
- **Containerization**: Docker + Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (for local development)
- PostgreSQL 16+ (if not using Docker)
- Redis 7+ (if not using Docker)
- WhatsApp Business API account (Meta Cloud) or Twilio account

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up database:**

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

4. **Start development server:**

```bash
npm run dev
```

Or use Docker Compose:

```bash
docker-compose up --build
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `WHATSAPP_PROVIDER`: `"meta"` or `"twilio"` (default: `"twilio"`)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `OPENAI_API_KEY`: Your OpenAI API key (or compatible service)
- `META_ACCESS_TOKEN` / `TWILIO_ACCOUNT_SID`: Provider-specific credentials

### WhatsApp Provider Setup

#### Option 1: Twilio (Recommended for Development)

1. Sign up for a [Twilio account](https://www.twilio.com/)
2. Get a WhatsApp sandbox number from Twilio Console
3. Configure webhook URL: `https://your-domain.com/webhook`
4. Set environment variables:
   ```
   WHATSAPP_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ```

**Testing with Twilio Sandbox:**
- Send "join [your-code]" to the sandbox number
- Use the sandbox number in your webhook payloads

#### Option 2: Meta Cloud API (WhatsApp Business API)

1. Create a Meta App and configure WhatsApp Business API
2. Get your Phone Number ID and Access Token
3. Configure webhook URL: `https://your-domain.com/webhook`
4. Set verify token in environment variables
5. Set environment variables:
   ```
   WHATSAPP_PROVIDER=meta
   META_ACCESS_TOKEN=your_access_token
   META_PHONE_NUMBER_ID=your_phone_number_id
   META_APP_SECRET=your_app_secret
   META_VERIFY_TOKEN=your_verify_token
   ```

## Usage Examples

### Natural Language Commands

Users can interact with the assistant using natural language:

- **Create Reminder**: "Remind me tomorrow at 9am to call mom"
- **Time-based**: "Can you ping me in 2 hours about the meeting?"
- **Snooze**: "Snooze this for 30 minutes"
- **Cancel**: "Cancel my reminder about rent"
- **Command Format**: "/remind 2025-12-01 18:00 Pay rent"
- **Summarize**: "Summarize this thread" or "TL;DR this chat"
- **Recurring**: "Remind me daily at 8am to take vitamins"

### API Endpoints

#### List Reminders
```bash
GET /api/reminders?phoneNumber=+1234567890
```

#### Cancel Reminder
```bash
DELETE /api/reminders/:id?phoneNumber=+1234567890
```

#### Delete User Data (Privacy)
```bash
DELETE /api/delete-data?phoneNumber=+1234567890
```

#### Health Check
```bash
GET /api/health
```

## Testing Webhooks Locally

### Using ngrok (Recommended)

1. Install ngrok: `npm install -g ngrok`
2. Start your server: `npm run dev`
3. Expose it: `ngrok http 3000`
4. Use the ngrok URL as your webhook URL in Twilio/Meta

### Sample Webhook Payloads

#### Twilio Webhook (POST /webhook)
```json
{
  "From": "whatsapp:+1234567890",
  "Body": "Remind me tomorrow at 9am to call mom",
  "MessageSid": "SM1234567890abcdef"
}
```

#### Meta Webhook (POST /webhook)
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "1234567890",
          "id": "wamid.xxx",
          "text": {
            "body": "Remind me tomorrow at 9am to call mom"
          },
          "type": "text"
        }]
      }
    }]
  }]
}
```

### Testing with cURL

```bash
# Twilio format
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+1234567890",
    "Body": "Remind me tomorrow at 9am to call mom",
    "MessageSid": "test-123"
  }'

# Meta format
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "1234567890",
            "id": "test-123",
            "text": {
              "body": "Remind me tomorrow at 9am to call mom"
            },
            "type": "text"
          }]
        }
      }]
    }]
  }'
```

## Architecture

### Project Structure

```
whatsapp-assistant/
├── src/
│   ├── api/              # REST API routes
│   ├── config/           # Configuration (env, etc.)
│   ├── db/               # Database client (Prisma)
│   ├── intent/           # Intent parsing (rule-based + LLM)
│   ├── nlp/              # LLM services (summarization, quick replies)
│   ├── scheduler/        # BullMQ jobs and worker
│   ├── webhook/          # Webhook handler
│   ├── whatsapp/         # WhatsApp client abstraction
│   └── index.ts          # Express app entry point
├── tests/                # Test files
│   ├── intent/           # Unit tests for parser
│   ├── scheduler/        # Unit tests for jobs
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── prisma/               # Prisma schema and migrations
├── docker-compose.yml    # Local development setup
├── Dockerfile            # Production Docker image
└── README.md
```

### Intent Parsing

The system uses a hybrid approach:
1. **Rule-based parsing** (regex patterns) for common intents - fast and reliable
2. **LLM fallback** for ambiguous or complex requests - flexible and intelligent

### Scheduler

- Uses **BullMQ** with Redis for job queuing
- Jobs are scheduled with delays based on reminder time
- Worker processes jobs and sends WhatsApp messages
- Supports retries and exponential backoff

### Data Models

- **User**: Phone number, consent status
- **Reminder**: Subject, scheduled time, status, recurrence
- **Message**: Inbound/outbound messages with retention
- **MessageThread**: Thread summaries and action items

## Privacy & Data Retention

- Messages are automatically expired after `MESSAGE_RETENTION_DAYS` (default: 30)
- Users can delete all their data via `/api/delete-data`
- Webhook signatures are verified for security
- Rate limiting per user (configurable)

## Deployment

### Docker Production Build

```bash
docker build -t whatsapp-assistant .
docker run -p 3000:3000 --env-file .env whatsapp-assistant
```

### Environment-Specific Configuration

1. Set `NODE_ENV=production`
2. Use production database and Redis instances
3. Configure proper webhook URLs in WhatsApp provider
4. Set up SSL/TLS (HTTPS required for webhooks)
5. Configure monitoring and logging

### CI/CD (GitHub Actions)

A sample workflow is included. To use:

1. Create `.github/workflows/ci.yml` (see example below)
2. Configure secrets in GitHub repository settings
3. Push to trigger workflow

Example workflow:

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run prisma:generate
      - run: npm test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
```

## Swapping WhatsApp Providers

The system abstracts WhatsApp providers behind a common interface. To switch:

1. Update `WHATSAPP_PROVIDER` in `.env`
2. Set the appropriate provider credentials
3. Restart the server

The code automatically uses the correct client implementation.

## Swapping LLM Providers

The LLM layer is abstracted. To use a different provider:

1. Update `OPENAI_BASE_URL` to your provider's endpoint
2. Ensure your provider is OpenAI-compatible
3. Set `OPENAI_API_KEY` to your provider's API key

For non-OpenAI-compatible providers, modify `src/nlp/llm.ts` to implement the provider-specific API.

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check network connectivity

### Redis Connection Issues

- Verify `REDIS_URL` is correct
- Ensure Redis is running
- Check Redis logs for errors

### Webhook Not Receiving Messages

- Verify webhook URL is publicly accessible (use ngrok for local testing)
- Check webhook signature verification
- Verify provider configuration (Twilio/Meta)
- Check server logs for errors

### Reminders Not Sending

- Verify Redis and BullMQ worker are running
- Check worker logs for job processing errors
- Verify WhatsApp client credentials
- Check reminder status in database

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For issues and questions, please open an issue on the repository.

