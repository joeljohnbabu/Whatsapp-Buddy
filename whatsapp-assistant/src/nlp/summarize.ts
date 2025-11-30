import { getLLMResponse } from './llm';
import { Message } from '@prisma/client';

export interface ThreadSummary {
  summary: string;
  actionItems: string[];
}

/**
 * Summarize a message thread using LLM
 */
export async function summarizeThread(messages: Message[]): Promise<ThreadSummary> {
  if (messages.length === 0) {
    return {
      summary: 'No messages to summarize.',
      actionItems: [],
    };
  }

  // Prepare message context
  const messageTexts = messages
    .slice(-50) // Last 50 messages
    .map((msg) => `${msg.direction === 'INBOUND' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  const prompt = `You are a helpful assistant that summarizes WhatsApp conversation threads. Analyze the following conversation and provide:

1. A concise 1-2 sentence summary of the main topics discussed
2. Three bullet-point action items or key takeaways

Conversation:
${messageTexts}

Respond with a JSON object in this exact format:
{
  "summary": "1-2 sentence summary",
  "actionItems": ["item 1", "item 2", "item 3"]
}

Only respond with valid JSON, no other text.`;

  try {
    const response = await getLLMResponse(prompt, {
      temperature: 0.5,
      maxTokens: 300,
    });

    const parsed = JSON.parse(response.trim());
    return {
      summary: parsed.summary || 'Unable to generate summary.',
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 3) : [],
    };
  } catch (error) {
    console.error('Summarization error:', error);
    return {
      summary: 'Unable to generate summary at this time.',
      actionItems: [],
    };
  }
}

