import { getLLMResponse } from './llm';
import { Message } from '@prisma/client';

/**
 * Generate quick reply suggestions for a message
 */
export async function generateQuickReplies(
  lastMessage: Message,
  context?: { threadMessages?: Message[] }
): Promise<string[]> {
  const prompt = `You are a helpful assistant that suggests quick reply options for WhatsApp messages. Given the following message, suggest 1-3 short, friendly, and concise reply options (each under 50 characters).

Message: "${lastMessage.content}"

Respond with a JSON array of strings:
["reply option 1", "reply option 2", "reply option 3"]

Only respond with valid JSON array, no other text.`;

  try {
    const response = await getLLMResponse(prompt, {
      temperature: 0.8,
      maxTokens: 150,
    });

    const parsed = JSON.parse(response.trim());
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).filter((r: any) => typeof r === 'string' && r.length <= 50);
    }
  } catch (error) {
    console.error('Quick reply generation error:', error);
  }

  // Fallback suggestions
  return ['Got it!', 'Thanks!', 'Will do'];
}

