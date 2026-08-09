import type { Env } from '../context';
import { AIProviderError } from './router';

const GEMINI_MODEL = 'gemini-2.0-flash';
const EMBEDDING_MODEL = 'text-embedding-004';
const REQUEST_TIMEOUT_MS = 15_000;

export async function generateContent(prompt: string, opts: { maxTokens?: number }, env: Env): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 300 },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AIProviderError(`Gemini request failed with HTTP ${response.status}`, {
      provider: 'gemini',
      status: response.status,
      detail: body,
    });
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.length === 0) {
    throw new AIProviderError('Gemini returned an empty completion', { provider: 'gemini' });
  }
  return text;
}

export async function embedText(text: string, env: Env): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AIProviderError(`Gemini embed request failed with HTTP ${response.status}`, {
      provider: 'gemini',
      status: response.status,
      detail: body,
    });
  }

  const data = (await response.json()) as {
    embedding?: { values?: number[] };
  };
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new AIProviderError('Gemini returned an empty embedding', { provider: 'gemini' });
  }
  return values;
}
