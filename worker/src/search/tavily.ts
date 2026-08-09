import type { Env } from '../context';
import { getTavilyBudgetCounter, incrementTavilyBudgetCounter } from '../storage/kv';
import { safeFetch } from '../utils/safe-fetch';
import type { ProviderResult, SearchOpts } from './dev-router';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_ALLOWED_HOSTS = ['api.tavily.com'];
const TAVILY_MONTHLY_CREDITS = 1000;
const BASIC_SEARCH_CREDITS = 1;
const REQUEST_TIMEOUT_MS = 10_000;

export async function isTavilyBudgetHealthy(env: Env): Promise<boolean> {
  const spent = await getTavilyBudgetCounter(env);
  const remaining = TAVILY_MONTHLY_CREDITS - spent;
  const reserve = Number(env.TAVILY_RESERVE_CREDITS ?? '100');
  return remaining >= reserve;
}

export async function tavilySearch(query: string, opts: SearchOpts, env: Env): Promise<ProviderResult> {
  const response = await safeFetch(
    TAVILY_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: opts.maxResults,
        search_depth: 'basic',
        include_answer: false,
      }),
    },
    { allowedHosts: TAVILY_ALLOWED_HOSTS, timeoutMs: REQUEST_TIMEOUT_MS },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 429 || response.status === 402) {
      throw new Error(`Tavily quota exhausted (HTTP ${response.status}): ${body}`);
    }
    throw new Error(`Tavily request failed with HTTP ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { results?: Array<{ url?: string; title?: string; content?: string }> };
  const items = (data.results ?? []).map((result) => ({
    url: result.url ?? '',
    title: result.title ?? '',
    snippet: result.content ?? '',
  }));

  await incrementTavilyBudgetCounter(BASIC_SEARCH_CREDITS, env);

  return items.slice(0, opts.maxResults);
}
