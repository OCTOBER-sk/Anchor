import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from '../src/context';
import { PlatformError } from '../src/utils/errors';
import { handleSearch } from '../src/tools/search';
import { buildTestContext, buildTestEnv, mockSearchResult } from './test-utils';

vi.mock('../src/search/dev-router', () => ({
  runSearchPipeline: vi.fn(),
}));

vi.mock('../src/ai/gemini', () => ({
  embedText: vi.fn(),
  generateContent: vi.fn(),
}));

vi.mock('../src/storage/supabase', () => ({
  matchMemoriesLite: vi.fn(),
  writeMemory: vi.fn(),
  matchMemories: vi.fn(),
  pingKeepalive: vi.fn(),
}));

vi.mock('../src/utils/monitoring', () => ({
  captureError: vi.fn(),
}));

import { runSearchPipeline } from '../src/search/dev-router';
import { embedText } from '../src/ai/gemini';
import { matchMemoriesLite } from '../src/storage/supabase';

let ctx: Context;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(runSearchPipeline).mockResolvedValue(mockSearchResult());
  vi.mocked(embedText).mockResolvedValue(new Array<number>(768).fill(0.5));
  vi.mocked(matchMemoriesLite).mockResolvedValue([]);
  ctx = buildTestContext(await buildTestEnv());
});

describe('tools/search', () => {
  it('returns the §8 output shape with related_memories always present and empty', async () => {
    const result = await handleSearch({ query: 'cloudflare workers' }, ctx);

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]).toMatchObject({
      url: expect.any(String),
      title: expect.any(String),
      snippet: expect.any(String),
      domainPriority: expect.any(Number),
    });
    expect(typeof result.summary).toBe('string');
    expect(result.related_memories).toEqual([]);
    expect(result._meta).toEqual({ provider_used: 'search-primary', platform_category: 'search' });
    expect(runSearchPipeline).toHaveBeenCalledWith('cloudflare workers', { searchIn: undefined, maxResults: 10 }, ctx);
  });

  it('serves an identical repeated query from the RESPONSE_CACHE without re-running the pipeline', async () => {
    const first = await handleSearch({ query: 'cache me' }, ctx);
    const second = await handleSearch({ query: 'cache me' }, ctx);

    expect(runSearchPipeline).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('runs the pipeline again for a different query', async () => {
    await handleSearch({ query: 'query a' }, ctx);
    await handleSearch({ query: 'query b' }, ctx);

    expect(runSearchPipeline).toHaveBeenCalledTimes(2);
  });

  it('exposes the raw provider name in _meta for admin-tier agents only', async () => {
    const adminCtx = buildTestContext(await buildTestEnv(), { agentTier: 'admin' });

    const result = await handleSearch({ query: 'cloudflare workers' }, adminCtx);

    expect(result._meta.provider_used).toBe('ddg');
    expect(result._meta.platform_category).toBe('search');
  });

  it('propagates SEARCH_UNAVAILABLE when the pipeline exhausts all providers', async () => {
    vi.mocked(runSearchPipeline).mockRejectedValue(new PlatformError('SEARCH_UNAVAILABLE', 'all down'));

    await expect(handleSearch({ query: 'failing query' }, ctx)).rejects.toThrow(PlatformError);
  });
});
