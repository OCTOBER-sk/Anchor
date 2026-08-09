import { describe, it, expect, vi, beforeEach } from 'vitest';
import { filterMetaForTier, canSeeProviderNames } from '../src/auth/permissions';
import { handleSearch } from '../src/tools/search';
import { handleGuide } from '../src/tools/guide';
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

const VENDOR_NAMES = ['cerebras', 'gemini', 'tavily', 'ddg', 'apify'];

beforeEach(async () => {
  vi.mocked(runSearchPipeline).mockResolvedValue(mockSearchResult());
  vi.mocked(embedText).mockResolvedValue(new Array<number>(768).fill(0.5));
  vi.mocked(matchMemoriesLite).mockResolvedValue([]);
});

describe('tier gating of _meta.provider_used (Phase 6)', () => {
  it('never exposes vendor names to the standard tier through anchor_search', async () => {
    const ctx = buildTestContext(await buildTestEnv(), { agentTier: 'standard' });
    const result = await handleSearch({ query: 'cloudflare workers' }, ctx);

    const metaJson = JSON.stringify(result._meta).toLowerCase();
    for (const vendor of VENDOR_NAMES) {
      expect(metaJson).not.toContain(vendor);
    }
    expect(result._meta.provider_used).toBe('search-primary');
  });

  it('exposes the raw vendor name to admin and debug tiers', async () => {
    for (const tier of ['admin', 'debug'] as const) {
      const ctx = buildTestContext(await buildTestEnv(), { agentTier: tier });
      const result = await handleSearch({ query: 'cloudflare workers' }, ctx);

      expect(result._meta.provider_used).toBe('ddg');
    }
  });

  it('maps categories to generic labels for standard agents', () => {
    expect(filterMetaForTier({ provider_used: 'tavily', platform_category: 'search' }, 'standard')).toEqual({
      provider_used: 'search-primary',
      platform_category: 'search',
    });
    expect(filterMetaForTier({ provider_used: 'gemini', platform_category: 'memory' }, 'standard')).toEqual({
      provider_used: 'memory-store',
      platform_category: 'memory',
    });
    expect(filterMetaForTier({ provider_used: 'none', platform_category: 'cache' }, 'standard')).toEqual({
      provider_used: 'response-cache',
      platform_category: 'cache',
    });
  });

  it('preserves raw provider names for admin and debug agents', () => {
    expect(filterMetaForTier({ provider_used: 'gemini', platform_category: 'memory' }, 'admin')).toEqual({
      provider_used: 'gemini',
      platform_category: 'memory',
    });
    expect(filterMetaForTier({ provider_used: 'tavily', platform_category: 'search' }, 'debug')).toEqual({
      provider_used: 'tavily',
      platform_category: 'search',
    });
  });

  it('canSeeProviderNames gates on tier', () => {
    expect(canSeeProviderNames('standard')).toBe(false);
    expect(canSeeProviderNames('admin')).toBe(true);
    expect(canSeeProviderNames('debug')).toBe(true);
  });

  it('keeps guide _meta generic for standard agents', async () => {
    const ctx = buildTestContext(await buildTestEnv(), { agentTier: 'standard' });
    const result = await handleGuide({}, ctx);

    const metaJson = JSON.stringify(result._meta).toLowerCase();
    for (const vendor of VENDOR_NAMES) {
      expect(metaJson).not.toContain(vendor);
    }
    expect(result._meta.provider_used).toBe('response-cache');
  });
});
