Whatsapp-Buddy

A WhatsApp-based personal assistant that automates reminders, follow-ups, message scheduling, and AI-powered responses — all inside WhatsApp. Designed for users who rely heavily on WhatsApp and want fast, simple productivity tools without switching apps.

 🚀 Features
- ⏰ Smart reminders using natural language  
- 🔁 Follow-up automation (boomerang-style)  
- 🧠 AI-generated quick replies  
- 📝 Notes and task extraction  
- 📅 Scheduled and recurring reminders  
- 🧾 Chat summarization  
- 🔐 Privacy-first message handling  

 🏗️ Tech Stack
- Backend: Node.js / Python (choose your implementation)  
- Messaging: WhatsApp Cloud API (Meta) or Twilio WhatsApp  
- AI: OpenAI / Llama / Gemini (pluggable)  
- Database: PostgreSQL / MongoDB  
- Queue / Scheduler: Redis + BullMQ / Celery  
- Deployment: Render / Railway / AWS / GCP  

📦 Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/whatsapp-assistant.git
   cd whatsapp-assistant
2. Install Dependecies:
   npm install
   
3.Create a .env file and add:
  WHATSAPP_API_KEY=
  WHATSAPP_PHONE_NUMBER_ID=
  WHATSAPP_VERIFY_TOKEN=
  DATABASE_URL=
  OPENAI_API_KEY=
  REDIS_URL=

4. Start the development server:
   npm run dev


 


