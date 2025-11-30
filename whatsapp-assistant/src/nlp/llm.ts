import axios from 'axios';
import { getEnv } from '../config/env';

/**
 * Generic LLM client abstraction (OpenAI-compatible)
 */
export async function getLLMResponse(
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const env = getEnv();
  const apiKey = env.OPENAI_API_KEY;
  const baseURL = env.OPENAI_BASE_URL;

  if (!apiKey) {
    // Mock response for testing
    if (env.NODE_ENV === 'test') {
      return JSON.stringify({
        type: 'UNKNOWN',
        confidence: 0.5,
        data: {},
      });
    }
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model: options?.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 500,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error('LLM API error:', error.response?.data || error.message);
    throw new Error(`LLM request failed: ${error.message}`);
  }
}

