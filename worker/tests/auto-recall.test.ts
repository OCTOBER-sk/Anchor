import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from '../src/context';
import { PlatformError } from '../src/utils/errors';
import { handleSearch } from '../src/tools/search';
import { buildTestContext, buildTestEnv, mockSearchResult } from './test-utils';
import type { MemoryMatch } from '../src/storage/supabase';

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
import { captureError } from '../src/utils/monitoring';

function embedding3072(): number[] {
  const values = new Array<number>(3072);
  for (let i = 0; i < values.length; i += 1) {
    values[i] = i / 3072;
  }
  return values;
}

function memoryMatch(overrides: Partial<MemoryMatch> = {}): MemoryMatch {
  return {
    id: 'mem-1',
    content: 'Cloudflare Workers enforce a 10ms CPU time limit per invocation on the free plan.',
    tags: ['cloudflare'],
    similarity: 0.82,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

let ctx: Context;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(runSearchPipeline).mockResolvedValue(mockSearchResult());
  vi.mocked(embedText).mockResolvedValue(embedding3072());
  vi.mocked(matchMemoriesLite).mockResolvedValue([]);
  ctx = buildTestContext(await buildTestEnv());
});

describe('auto-recall injection — §5', () => {
  it('merges recall matches into the search result, running both branches in parallel (critical #1)', async () => {
    const matches = [
      memoryMatch({ id: 'mem-1', similarity: 0.9 }),
      memoryMatch({ id: 'mem-2', content: 'Deploys run through wrangler.', tags: [], similarity: 0.8 }),
    ];
    vi.mocked(matchMemoriesLite).mockResolvedValue(matches);

    const result = await handleSearch({ query: 'cloudflare workers' }, ctx);

    expect(result.related_memories).toHaveLength(2);
    expect(result.related_memories).toEqual(matches);
    expect(result.results).toEqual(mockSearchResult().results);

    expect(runSearchPipeline).toHaveBeenCalledTimes(1);
    expect(matchMemoriesLite).toHaveBeenCalledTimes(1);
    expect(embedText).toHaveBeenCalledWith('cloudflare workers', ctx.env);
    expect(matchMemoriesLite).toHaveBeenCalledWith(embedding3072(), { ownerId: 'anchor-deployment-owner' }, ctx.env);
  });

  it('resolves with related_memories: [] and logs recallForSearch when embedding fails (critical #2 variant A)', async () => {
    vi.mocked(embedText).mockRejectedValue(new Error('gemini quota exhausted'));

    const result = await handleSearch({ query: 'cloudflare workers' }, ctx);

    expect(result.related_memories).toEqual([]);
    expect(result.results.length).toBeGreaterThan(0);
    expect(captureError).toHaveBeenCalledWith('recallForSearch', expect.any(Error), { query: 'cloudflare workers' });
    expect(runSearchPipeline).toHaveBeenCalledTimes(1);
  });

  it('resolves with related_memories: [] and logs recallForSearch when matchMemoriesLite fails (critical #2 variant A)', async () => {
    vi.mocked(matchMemoriesLite).mockRejectedValue(new Error('Supabase project paused'));

    const result = await handleSearch({ query: 'another topic' }, ctx);

    expect(result.related_memories).toEqual([]);
    expect(result.results.length).toBeGreaterThan(0);
    expect(captureError).toHaveBeenCalledWith('recallForSearch', expect.any(Error), { query: 'another topic' });
    expect(matchMemoriesLite).toHaveBeenCalledTimes(1);
  });

  it('does not let recall failure mask a genuine search failure — rejects SEARCH_UNAVAILABLE (critical #2 variant B)', async () => {
    vi.mocked(runSearchPipeline).mockRejectedValue(new PlatformError('SEARCH_UNAVAILABLE', 'all providers down'));
    vi.mocked(embedText).mockRejectedValue(new Error('gemini down'));

    await expect(handleSearch({ query: 'doomed query' }, ctx)).rejects.toMatchObject({
      code: 'SEARCH_UNAVAILABLE',
    });

    expect(captureError).toHaveBeenCalledWith('recallForSearch', expect.any(Error), { query: 'doomed query' });
    expect(runSearchPipeline).toHaveBeenCalledTimes(1);
  });

  it('serves cached web-search results on repeat queries but re-runs recall freshly (cache test)', async () => {
    vi.mocked(matchMemoriesLite).mockResolvedValueOnce([memoryMatch({ id: 'stale', content: 'old memory' })]);

    const first = await handleSearch({ query: 'cache me' }, ctx);

    vi.mocked(matchMemoriesLite).mockResolvedValueOnce([
      memoryMatch({ id: 'fresh', content: 'memory written since the search was cached' }),
    ]);

    const second = await handleSearch({ query: 'cache me' }, ctx);

    expect(runSearchPipeline).toHaveBeenCalledTimes(1);
    expect(matchMemoriesLite).toHaveBeenCalledTimes(2);
    expect(second.results).toEqual(first.results);
    expect(first.related_memories[0]?.id).toBe('stale');
    expect(second.related_memories[0]?.id).toBe('fresh');
  });
});
