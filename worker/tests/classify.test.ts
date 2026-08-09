import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from '../src/context';
import { classifyResult, filterPhantomResults } from '../src/search/classify';
import type { ProviderResultItem } from '../src/search/dev-router';
import { buildTestContext, buildTestEnv } from './test-utils';

vi.mock('../src/ai/router', () => ({
  dispatchAI: vi.fn(),
}));

import { dispatchAI } from '../src/ai/router';

const GENUINE: ProviderResultItem = {
  url: 'https://developers.cloudflare.com/workers/limits/',
  title: 'Cloudflare Workers Limits',
  snippet:
    'A comprehensive guide covering Cloudflare Workers CPU time limits, request quotas, and how they are enforced across every invocation.',
};

const PHANTOM_PAYWALL: ProviderResultItem = {
  url: 'https://spam.example.com/article',
  title: 'Sponsored content',
  snippet: 'Sign in to continue reading this exclusive article about workers and edge compute.',
};

const PHANTOM_LOW_CONTENT: ProviderResultItem = {
  url: 'https://placeholder.example.com/x',
  title: 'Click',
  snippet: 'short',
};

const UNCERTAIN: ProviderResultItem = {
  url: 'https://example.com/post',
  title: 'A short note on workers',
  snippet: 'A moderately detailed post about the topic with limited depth.',
};

let ctx: Context;

beforeEach(async () => {
  vi.mocked(dispatchAI).mockReset();
  ctx = buildTestContext(await buildTestEnv());
});

describe('search/classify', () => {
  it('classifies a substantive result as genuine', () => {
    expect(classifyResult(GENUINE)).toBe('genuine');
  });

  it('classifies a paywall-stub result as phantom', () => {
    expect(classifyResult(PHANTOM_PAYWALL)).toBe('phantom');
  });

  it('classifies a low-content placeholder as phantom', () => {
    expect(classifyResult(PHANTOM_LOW_CONTENT)).toBe('phantom');
  });

  it('classifies a moderately-detailed result as uncertain', () => {
    expect(classifyResult(UNCERTAIN)).toBe('uncertain');
  });

  it('drops phantoms and keeps genuine/uncertain without an AI pass', async () => {
    const kept = await filterPhantomResults([GENUINE, PHANTOM_PAYWALL, PHANTOM_LOW_CONTENT, UNCERTAIN]);
    expect(kept).toEqual([GENUINE, UNCERTAIN]);
    expect(dispatchAI).not.toHaveBeenCalled();
  });

  it('consults AI for uncertain results when a context is provided (phantom verdict drops it)', async () => {
    vi.mocked(dispatchAI).mockResolvedValue({
      text: 'phantom',
      providerUsed: 'cerebras',
      platformCategory: 'search',
    });

    const kept = await filterPhantomResults([UNCERTAIN, GENUINE], ctx);
    expect(kept).toEqual([GENUINE]);
    expect(dispatchAI).toHaveBeenCalledWith('classify', expect.any(String), ctx);
  });

  it('keeps uncertain results when AI decides they are genuine', async () => {
    vi.mocked(dispatchAI).mockResolvedValue({
      text: 'genuine',
      providerUsed: 'gemini',
      platformCategory: 'search',
    });

    const kept = await filterPhantomResults([UNCERTAIN], ctx);
    expect(kept).toEqual([UNCERTAIN]);
  });

  it('keeps uncertain results conservatively when the AI call fails', async () => {
    vi.mocked(dispatchAI).mockRejectedValue(new Error('AI down'));

    const kept = await filterPhantomResults([UNCERTAIN], ctx);
    expect(kept).toEqual([UNCERTAIN]);
  });
});
