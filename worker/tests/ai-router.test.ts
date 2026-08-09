import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from '../src/context';
import { dispatchAI, AIProviderError } from '../src/ai/router';
import { buildTestContext, buildTestEnv } from './test-utils';

vi.mock('../src/ai/cerebras', () => ({
  complete: vi.fn(),
}));

vi.mock('../src/ai/gemini', () => ({
  generateContent: vi.fn(),
}));

import { complete } from '../src/ai/cerebras';
import { generateContent } from '../src/ai/gemini';

let ctx: Context;

beforeEach(async () => {
  vi.mocked(complete).mockReset();
  vi.mocked(generateContent).mockReset();
  ctx = buildTestContext(await buildTestEnv());
});

describe('ai/router', () => {
  it('uses Cerebras on the fast path and never touches Gemini (critical #5a)', async () => {
    vi.mocked(complete).mockResolvedValue('cerebras summary');

    const result = await dispatchAI('summarize', 'input', ctx);

    expect(result.providerUsed).toBe('cerebras');
    expect(result.text).toBe('cerebras summary');
    expect(result.platformCategory).toBe('search');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('falls back to Gemini when Cerebras rejects, reporting providerUsed gemini (critical #5a)', async () => {
    vi.mocked(complete).mockRejectedValue(new Error('Cerebras 429 rate limited'));
    vi.mocked(generateContent).mockResolvedValue('gemini summary');

    const result = await dispatchAI('summarize', 'input', ctx);

    expect(result.providerUsed).toBe('gemini');
    expect(result.text).toBe('gemini summary');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('surfaces a 429 from Cerebras as a failure that triggers the Gemini fallback', async () => {
    vi.mocked(complete).mockRejectedValue(new Error('HTTP 429'));
    vi.mocked(generateContent).mockResolvedValue('fallback text');

    const result = await dispatchAI('summarize', 'input', ctx);

    expect(result.providerUsed).toBe('gemini');
    expect(result.text).toBe('fallback text');
  });

  it('throws AIProviderError when both providers fail', async () => {
    vi.mocked(complete).mockRejectedValue(new Error('cerebras down'));
    vi.mocked(generateContent).mockRejectedValue(new Error('gemini down'));

    await expect(dispatchAI('classify', 'input', ctx)).rejects.toThrow(AIProviderError);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('dispatches classify tasks through the same provider chain', async () => {
    vi.mocked(complete).mockResolvedValue('genuine');

    const result = await dispatchAI('classify', 'input', ctx);

    expect(result.text).toBe('genuine');
    expect(result.providerUsed).toBe('cerebras');
  });
});
