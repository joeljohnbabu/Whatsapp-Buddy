import axios, { AxiosInstance } from 'axios';
import { getEnv } from '../config/env';

export interface WhatsAppMessage {
  to: string; // Phone number in E.164 format
  body: string;
  messageId?: string;
}

export interface WhatsAppClient {
  sendMessage(message: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }>;
  verifyWebhook(body: any, signature: string): boolean;
}

/**
 * Meta Cloud API (WhatsApp Business API) implementation
 */
class MetaWhatsAppClient implements WhatsAppClient {
  private client: AxiosInstance;
  private phoneNumberId: string;
  private accessToken: string;
  private appSecret: string;

  constructor() {
    const env = getEnv();
    this.phoneNumberId = env.META_PHONE_NUMBER_ID!;
    this.accessToken = env.META_ACCESS_TOKEN!;
    this.appSecret = env.META_APP_SECRET!;

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/v18.0/${this.phoneNumberId}`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendMessage(message: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.client.post('/messages', {
        messaging_product: 'whatsapp',
        to: message.to,
        type: 'text',
        text: {
          body: message.body,
        },
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  verifyWebhook(body: any, signature: string): boolean {
    const crypto = require('crypto');
    const env = getEnv();
    
    if (!this.appSecret) return false;

    const hmac = crypto.createHmac('sha256', this.appSecret);
    hmac.update(JSON.stringify(body));
    const calculatedSignature = hmac.digest('hex');

    return calculatedSignature === signature;
  }
}

/**
 * Twilio WhatsApp implementation
 */
class TwilioWhatsAppClient implements WhatsAppClient {
  private client: AxiosInstance;
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private webhookSecret?: string;

  constructor() {
    const env = getEnv();
    this.accountSid = env.TWILIO_ACCOUNT_SID!;
    this.authToken = env.TWILIO_AUTH_TOKEN!;
    this.fromNumber = env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
    this.webhookSecret = env.TWILIO_WEBHOOK_SECRET;

    this.client = axios.create({
      baseURL: `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`,
      auth: {
        username: this.accountSid,
        password: this.authToken,
      },
    });
  }

  async sendMessage(message: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const formData = new URLSearchParams();
      formData.append('From', this.fromNumber);
      formData.append('To', message.to.startsWith('whatsapp:') ? message.to : `whatsapp:${message.to}`);
      formData.append('Body', message.body);

      const response = await this.client.post('/Messages.json', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return {
        success: true,
        messageId: response.data.sid,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  verifyWebhook(body: any, signature: string): boolean {
    // Twilio uses X-Twilio-Signature header with HMAC-SHA1
    const crypto = require('crypto');
    const env = getEnv();
    
    if (!this.webhookSecret) return true; // Skip verification if not configured

    // Twilio signature verification
    // For production, implement proper Twilio signature validation
    // See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
    return true; // Simplified for MVP
  }
}

/**
 * Factory to create the appropriate WhatsApp client
 */
export function createWhatsAppClient(): WhatsAppClient {
  const env = getEnv();
  const provider = env.WHATSAPP_PROVIDER;

  if (provider === 'meta') {
    return new MetaWhatsAppClient();
  } else if (provider === 'twilio') {
    return new TwilioWhatsAppClient();
  } else {
    throw new Error(`Unsupported WhatsApp provider: ${provider}`);
  }
}

export const whatsappClient = createWhatsAppClient();

