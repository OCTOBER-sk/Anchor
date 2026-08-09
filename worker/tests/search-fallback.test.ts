import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../src/context';
import { runSearchPipeline } from '../src/search/dev-router';
import type { ProviderResultItem } from '../src/search/dev-router';
import { buildTestContext, buildTestEnv, type MemoryKV } from './test-utils';

vi.mock('../src/search/ddg', () => ({
  ddgSearch: vi.fn(),
}));

vi.mock('../src/search/tavily', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/search/tavily')>();
  return {
    ...actual,
    tavilySearch: vi.fn(),
  };
});

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

const TAVILY_BUDGET_KEY = 'tavily:budget:month';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function resultItems(): ProviderResultItem[] {
  return [
    {
      url: 'https://developers.cloudflare.com/workers/',
      title: 'Cloudflare Workers documentation',
      snippet:
        'A comprehensive documentation page covering the full Cloudflare Workers runtime, its platform limits, and CPU time accounting.',
    },
  ];
}

async function seedBudget(env: Env, credits: number): Promise<void> {
  await (env.RATE_LIMIT as unknown as MemoryKV).put(
    TAVILY_BUDGET_KEY,
    JSON.stringify({ month: currentMonth(), credits }),
  );
}

beforeEach(() => {
  vi.mocked(ddgSearch).mockReset();
  vi.mocked(tavilySearch).mockReset();
  vi.mocked(apifySearch).mockReset();
  vi.mocked(dispatchAI).mockReset();
  vi.mocked(dispatchAI).mockResolvedValue({
    text: 'summary',
    providerUsed: 'cerebras',
    platformCategory: 'search',
  });
});

describe('search/tavily budget guard (real isTavilyBudgetHealthy)', () => {
  it('treats a fresh month as healthy', async () => {
    const env = await buildTestEnv();
    await expect(isTavilyBudgetHealthy(env)).resolves.toBe(true);
  });

  it('stays healthy exactly at the reserve floor', async () => {
    const env = await buildTestEnv();
    await seedBudget(env, 900);
    await expect(isTavilyBudgetHealthy(env)).resolves.toBe(true);
  });

  it('becomes unhealthy once the remaining pool drops below the reserve floor', async () => {
    const env = await buildTestEnv();
    await seedBudget(env, 901);
    await expect(isTavilyBudgetHealthy(env)).resolves.toBe(false);
  });

  it('honors a custom reserve floor from the environment', async () => {
    const env = await buildTestEnv({ TAVILY_RESERVE_CREDITS: '20' });
    await seedBudget(env, 980);
    await expect(isTavilyBudgetHealthy(env)).resolves.toBe(true);

    await seedBudget(env, 981);
    await expect(isTavilyBudgetHealthy(env)).resolves.toBe(false);
  });
});

describe('search provider fallback order (critical #5b)', () => {
  it('falls through to Tavily when DDG fails and the budget is healthy', async () => {
    vi.mocked(ddgSearch).mockRejectedValue(new Error('DDG 429'));
    vi.mocked(tavilySearch).mockResolvedValue(resultItems());

    const env = await buildTestEnv();
    const result = await runSearchPipeline('cloudflare workers', { maxResults: 10 }, buildTestContext(env));

    expect(ddgSearch).toHaveBeenCalledTimes(1);
    expect(tavilySearch).toHaveBeenCalledTimes(1);
    expect(apifySearch).not.toHaveBeenCalled();
    expect(result.providerUsed).toBe('tavily');
    expect(result.results[0]?.url).toBe('https://developers.cloudflare.com/workers/');
  });

  it('never calls Tavily when the budget is unhealthy and proceeds to Apify', async () => {
    vi.mocked(ddgSearch).mockRejectedValue(new Error('DDG 429'));
    vi.mocked(apifySearch).mockResolvedValue(resultItems());

    const env = await buildTestEnv();
    await seedBudget(env, 950);

    const result = await runSearchPipeline('cloudflare workers', { maxResults: 10 }, buildTestContext(env));

    expect(tavilySearch).not.toHaveBeenCalled();
    expect(apifySearch).toHaveBeenCalledTimes(1);
    expect(result.providerUsed).toBe('apify');
  });

  it('uses DDG when it succeeds, never reaching Tavily', async () => {
    vi.mocked(ddgSearch).mockResolvedValue(resultItems());

    const env = await buildTestEnv();
    const result = await runSearchPipeline('cloudflare workers', { maxResults: 10 }, buildTestContext(env));

    expect(result.providerUsed).toBe('ddg');
    expect(tavilySearch).not.toHaveBeenCalled();
    expect(apifySearch).not.toHaveBeenCalled();
  });

  it('falls through to Apify when DDG and a budget-healthy Tavily both fail', async () => {
    vi.mocked(ddgSearch).mockRejectedValue(new Error('DDG down'));
    vi.mocked(tavilySearch).mockRejectedValue(new Error('Tavily 402 payment required'));
    vi.mocked(apifySearch).mockResolvedValue(resultItems());

    const env = await buildTestEnv();
    const result = await runSearchPipeline('cloudflare workers', { maxResults: 10 }, buildTestContext(env));

    expect(tavilySearch).toHaveBeenCalledTimes(1);
    expect(apifySearch).toHaveBeenCalledTimes(1);
    expect(result.providerUsed).toBe('apify');
  });
});
