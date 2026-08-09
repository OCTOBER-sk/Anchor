import type { Env } from '../context';
import { AIProviderError } from './router';
import { safeFetch } from '../utils/safe-fetch';

const CEREBRAS_CHAT_URL = 'https://api.cerebras.ai/v1/chat/completions';
const CEREBRAS_ALLOWED_HOSTS = ['api.cerebras.ai'];
const CEREBRAS_MODEL = 'gpt-oss-120b';
const REQUEST_TIMEOUT_MS = 15_000;

async function safeReadBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export async function complete(prompt: string, opts: { maxTokens?: number }, env: Env): Promise<string> {
  const response = await safeFetch(
    CEREBRAS_CHAT_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxTokens ?? 300,
        temperature: 0.2,
      }),
    },
    { allowedHosts: CEREBRAS_ALLOWED_HOSTS, timeoutMs: REQUEST_TIMEOUT_MS },
  );

  if (!response.ok) {
    const body = await safeReadBody(response);
    // Surface 429 immediately — no local retry loop. The retry/fallback
    // decision belongs to ai/router.ts.
    throw new AIProviderError(`Cerebras request failed with HTTP ${response.status}`, {
      provider: 'cerebras',
      status: response.status,
      detail: body,
    });
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.length === 0) {
    throw new AIProviderError('Cerebras returned an empty completion', { provider: 'cerebras' });
  }
  return text;
}
