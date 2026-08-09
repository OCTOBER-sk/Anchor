import type { Context } from '../context';
import { filterMetaForTier, type PublicMeta } from '../auth/permissions';
import { getCached, setCached } from '../storage/kv';
import { runSearchPipeline, type SearchProvider, type SearchResultItem } from '../search/dev-router';
import type { SearchInValue } from '../mcp/validation';

const SEARCH_CACHE_TTL_SECONDS = 300;
const DEFAULT_MAX_RESULTS = 10;

export interface SearchInput {
  query: string;
  search_in?: SearchInValue[];
  max_results?: number;
}

export interface RelatedMemory {
  id: string;
  content: string;
  tags: string[];
  similarity: number;
  created_at: string;
}

interface CachedSearchCore {
  results: SearchResultItem[];
  summary: string;
  providerUsed: SearchProvider;
}

export interface SearchToolResult {
  results: SearchResultItem[];
  summary: string;
  related_memories: RelatedMemory[];
  _meta: PublicMeta;
}

async function cacheKeyForSearch(input: SearchInput): Promise<string> {
  const payload = JSON.stringify([input.query, input.search_in ?? ['url', 'title', 'body'], input.max_results ?? DEFAULT_MAX_RESULTS]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `search:${hex}`;
}

export async function handleSearch(input: SearchInput, ctx: Context): Promise<SearchToolResult> {
  const cacheKey = await cacheKeyForSearch(input);
  const cached = await getCached<CachedSearchCore>(cacheKey, ctx.env);

  let core: CachedSearchCore;
  if (cached !== null) {
    core = cached;
  } else {
    const result = await runSearchPipeline(
      input.query,
      { searchIn: input.search_in, maxResults: input.max_results ?? DEFAULT_MAX_RESULTS },
      ctx,
    );
    core = { results: result.results, summary: result.summary, providerUsed: result.providerUsed };
    await setCached(cacheKey, core, SEARCH_CACHE_TTL_SECONDS, ctx.env);
  }

  const meta = filterMetaForTier({ provider_used: core.providerUsed, platform_category: 'search' }, ctx.agentTier);

  return {
    results: core.results,
    summary: core.summary,
    related_memories: [],
    _meta: meta,
  };
}
