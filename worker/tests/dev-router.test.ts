import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from '../src/context';
import { PlatformError } from '../src/utils/errors';
import { runSearchPipeline } from '../src/search/dev-router';
import type { ProviderResultItem } from '../src/search/dev-router';
import { buildTestContext, buildTestEnv } from './test-utils';

vi.mock('../src/search/ddg', () => ({
  ddgSearch: vi.fn(),
}));

vi.mock('../src/search/tavily', () => ({
  tavilySearch: vi.fn(),
  isTavilyBudgetHealthy: vi.fn(),
}));

vi.mock('../src/search/apify', () => ({
  apifySearch: vi.fn(),
}));

vi.mock('../src/ai/router', () => ({
  dispatchAI: vi.fn(),
}));

import { ddgSearch } from '../src/search/ddg';
import { tavilySearch, isTavilyBudgetHealthy } from '../src/search/tavily';
import { apifySearch } from '../src/search/apify';
import { dispatchAI } from '../src/ai/router';

const GENUINE_DOCS: ProviderResultItem = {
  url: 'https://developers.cloudflare.com/workers/',
  title: 'Cloudflare Workers documentation',
  snippet:
    'A comprehensive documentation page covering the full Cloudflare Workers runtime, its platform limits, and CPU time accounting.',
};

const GENUINE_BLOG: ProviderResultItem = {
  url: 'https://medium.com/cloudflare-workers',
  title: 'An in-depth analysis of Cloudflare Workers',
  snippet:
    'A long-form editorial about Cloudflare Workers covering pricing, CPU time, and cold start behavior across regions.',
};

const PHANTOM: ProviderResultItem = {
  url: 'https://spam.example.com/ads',
  title: 'Sponsored content',
  snippet: 'Sign in to continue reading this exclusive article.',
};

let ctx: Context;

beforeEach(async () => {
  vi.mocked(ddgSearch).mockReset();
  vi.mocked(tavilySearch).mockReset();
  vi.mocked(apifySearch).mockReset();
  vi.mocked(dispatchAI).mockReset();
  vi.mocked(isTavilyBudgetHealthy).mockResolvedValue(true);
  vi.mocked(dispatchAI).mockResolvedValue({
    text: 'A concise summary.',
    providerUsed: 'cerebras',
    platformCategory: 'search',
  });
  ctx = buildTestContext(await buildTestEnv());
});

describe('search/dev-router pipeline', () => {
  it('throws SEARCH_UNAVAILABLE only when all three providers are exhausted', async () => {
    vi.mocked(ddgSearch).mockRejectedValue(new Error('DDG down'));
    vi.mocked(tavilySearch).mockRejectedValue(new Error('Tavily down'));
    vi.mocked(apifySearch).mockRejectedValue(new Error('Apify down'));

    let caught: unknown;
    try {
      await runSearchPipeline('anything', { maxResults: 10 }, ctx);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(PlatformError);
    expect((caught as PlatformError).code).toBe('SEARCH_UNAVAILABLE');
  });

  it('filters phantoms, applies domain-priority reordering, and summarizes via AI', async () => {
    vi.mocked(ddgSearch).mockResolvedValue([GENUINE_DOCS, PHANTOM, GENUINE_BLOG]);

    const result = await runSearchPipeline('cloudflare workers', { maxResults: 10 }, ctx);

    expect(result.providerUsed).toBe('ddg');
    expect(tavilySearch).not.toHaveBeenCalled();
    expect(apifySearch).not.toHaveBeenCalled();

    expect(result.results).toHaveLength(2);
    expect(result.results.map((r) => r.url)).not.toContain(PHANTOM.url);
    expect(result.results[0]?.url).toBe(GENUINE_DOCS.url);
    expect(result.results[0]?.domainPriority).toBeGreaterThan(result.results[1]?.domainPriority ?? 0);
    expect(result.summary).toBe('A concise summary.');
    expect(dispatchAI).toHaveBeenCalledWith('summarize', expect.stringContaining('cloudflare workers'), ctx);
  });

  it('applies dork operators to the query handed to the primary provider', async () => {
    vi.mocked(ddgSearch).mockResolvedValue([GENUINE_DOCS]);

    await runSearchPipeline('cloudflare site:cloudflare.com -blog', { maxResults: 10 }, ctx);

    expect(ddgSearch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(ddgSearch).mock.calls[0]?.[0]).toBe('cloudflare site:cloudflare.com -blog');
  });

  it('caps results at max_results', async () => {
    vi.mocked(ddgSearch).mockResolvedValue([GENUINE_DOCS, GENUINE_BLOG]);

    const result = await runSearchPipeline('cloudflare workers', { maxResults: 1 }, ctx);

    expect(result.results).toHaveLength(1);
  });
});
