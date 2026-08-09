import type { Context } from '../context';
import { PlatformError } from '../utils/errors';
import { captureError } from '../utils/monitoring';
import { dispatchAI } from '../ai/router';
import { ddgSearch } from './ddg';
import { tavilySearch, isTavilyBudgetHealthy } from './tavily';
import { apifySearch } from './apify';
import { parseDorkOperators, applyDorkOperators } from './dorking';
import { filterPhantomResults } from './classify';
import { reorderByDomainPriority } from './domain-priority';
import type { SearchInValue } from '../mcp/validation';

export type SearchProvider = 'ddg' | 'tavily' | 'apify';

export interface ProviderResultItem {
  url: string;
  title: string;
  snippet: string;
}

export type ProviderResult = ProviderResultItem[];

export interface SearchOpts {
  searchIn?: SearchInValue[];
  maxResults: number;
}

export interface SearchResultItem extends ProviderResultItem {
  domainPriority: number;
}

export interface SearchResult {
  results: SearchResultItem[];
  summary: string;
  providerUsed: SearchProvider;
}

const SUMMARY_EXCERPT_COUNT = 5;

async function tryProvider(
  label: SearchProvider,
  fn: () => Promise<ProviderResult>,
  query: string,
): Promise<ProviderResult | null> {
  try {
    return await fn();
  } catch (err) {
    captureError(`search/dev-router.ts::${label}`, err, { query });
    return null;
  }
}

async function summarize(query: string, results: SearchResultItem[], ctx: Context): Promise<string> {
  if (results.length === 0) {
    return '';
  }
  const excerpt = results
    .slice(0, SUMMARY_EXCERPT_COUNT)
    .map((result, index) => `${index + 1}. ${result.title} — ${result.snippet}`)
    .join('\n');
  const prompt = [
    `Search query: ${query}`,
    '',
    'Search results:',
    excerpt,
    '',
    'Provide a concise 2-3 sentence summary of the most relevant findings.',
  ].join('\n');

  try {
    const ai = await dispatchAI('summarize', prompt, ctx);
    const text = (ai.text ?? '').trim();
    return text.length > 0 ? text : (results[0]?.snippet ?? '');
  } catch (err) {
    captureError('search/dev-router.ts::summarize', err, { query });
    return results[0]?.snippet ?? '';
  }
}

export async function runSearchPipeline(query: string, opts: SearchOpts, ctx: Context): Promise<SearchResult> {
  const { cleanQuery, operators } = parseDorkOperators(query);

  let providerResults: ProviderResult | null = null;
  let providerUsed: SearchProvider | null = null;

  const ddgQuery = applyDorkOperators(cleanQuery, operators, 'ddg');
  const ddgOut = await tryProvider('ddg', () => ddgSearch(ddgQuery, opts), query);
  if (ddgOut !== null) {
    providerResults = ddgOut;
    providerUsed = 'ddg';
  }

  if (providerResults === null && (await isTavilyBudgetHealthy(ctx.env))) {
    const tavilyQuery = applyDorkOperators(cleanQuery, operators, 'tavily');
    const tavilyOut = await tryProvider('tavily', () => tavilySearch(tavilyQuery, opts, ctx.env), query);
    if (tavilyOut !== null) {
      providerResults = tavilyOut;
      providerUsed = 'tavily';
    }
  }

  if (providerResults === null) {
    const apifyQuery = applyDorkOperators(cleanQuery, operators, 'apify');
    const apifyOut = await tryProvider('apify', () => apifySearch(apifyQuery, opts, ctx.env), query);
    if (apifyOut !== null) {
      providerResults = apifyOut;
      providerUsed = 'apify';
    }
  }

  if (providerResults === null || providerUsed === null) {
    throw new PlatformError('SEARCH_UNAVAILABLE', 'All search providers are exhausted.');
  }

  const truncated = providerResults.slice(0, opts.maxResults);
  const filtered = await filterPhantomResults(truncated, ctx);
  const results = reorderByDomainPriority(filtered);
  const summary = await summarize(query, results, ctx);

  return { results, summary, providerUsed };
}
