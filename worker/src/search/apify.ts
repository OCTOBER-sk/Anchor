import type { Env } from '../context';
import { getApifyBudgetCounter, incrementApifyBudgetCounter } from '../storage/kv';
import { safeFetch } from '../utils/safe-fetch';
import type { ProviderResult, ProviderResultItem, SearchOpts } from './dev-router';

const APIFY_API_BASE = 'https://api.apify.com/v2';
const APIFY_ALLOWED_HOSTS = ['*.apify.com'];
const DEFAULT_ACTOR_ID = 'apify/google-search-scraper';
const MONTHLY_BUDGET_CENTS = 450;
const ESTIMATED_RUN_COST_CENTS = 50;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function budgetAllowsStart(env: Env): Promise<boolean> {
  const spent = await getApifyBudgetCounter(env);
  return spent + ESTIMATED_RUN_COST_CENTS <= MONTHLY_BUDGET_CENTS;
}

async function startRun(actorId: string, query: string, env: Env): Promise<string> {
  const response = await safeFetch(
    `${APIFY_API_BASE}/acts/${actorId}/runs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.APIFY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: { query } }),
    },
    { allowedHosts: APIFY_ALLOWED_HOSTS, timeoutMs: REQUEST_TIMEOUT_MS },
  );
  if (!response.ok) {
    throw new Error(`Apify run start failed with HTTP ${response.status}`);
  }
  const data = (await response.json()) as { data?: { id?: string } };
  const runId = data.data?.id;
  if (typeof runId !== 'string' || runId.length === 0) {
    throw new Error('Apify run start returned no run id');
  }
  return runId;
}

async function pollStatus(runId: string, env: Env): Promise<string> {
  const response = await safeFetch(
    `${APIFY_API_BASE}/actor-runs/${runId}`,
    { headers: { Authorization: `Bearer ${env.APIFY_API_TOKEN}` } },
    { allowedHosts: APIFY_ALLOWED_HOSTS, timeoutMs: REQUEST_TIMEOUT_MS },
  );
  if (!response.ok) {
    throw new Error(`Apify run poll failed with HTTP ${response.status}`);
  }
  const data = (await response.json()) as { data?: { status?: string } };
  return data.data?.status ?? 'RUNNING';
}

async function fetchDataset(runId: string, env: Env): Promise<ProviderResultItem[]> {
  const response = await safeFetch(
    `${APIFY_API_BASE}/actor-runs/${runId}/dataset/items`,
    { headers: { Authorization: `Bearer ${env.APIFY_API_TOKEN}` } },
    { allowedHosts: APIFY_ALLOWED_HOSTS, timeoutMs: REQUEST_TIMEOUT_MS },
  );
  if (!response.ok) {
    throw new Error(`Apify dataset fetch failed with HTTP ${response.status}`);
  }
  const rows = (await response.json()) as Array<{ url?: string; title?: string; description?: string }>;
  return rows.map((row) => ({
    url: row.url ?? '',
    title: row.title ?? '',
    snippet: row.description ?? '',
  }));
}

export async function apifySearch(query: string, opts: SearchOpts, env: Env): Promise<ProviderResult> {
  if (!(await budgetAllowsStart(env))) {
    throw new Error('Apify monthly budget ceiling reached; skipping actor run.');
  }

  const actorId = (env as Env & { APIFY_ACTOR_ID?: string }).APIFY_ACTOR_ID ?? DEFAULT_ACTOR_ID;
  const runId = await startRun(actorId, query, env);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const status = await pollStatus(runId, env);
    if (status === 'SUCCEEDED') {
      const items = await fetchDataset(runId, env);
      await incrementApifyBudgetCounter(ESTIMATED_RUN_COST_CENTS, env);
      return items.slice(0, opts.maxResults);
    }
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED_OUT') {
      throw new Error(`Apify run ended with status "${status}"`);
    }
    if (attempt < MAX_POLL_ATTEMPTS - 1) {
      await sleep(POLL_INTERVAL_MS);
    }
  }
  throw new Error('Apify run polling exceeded the hard timeout');
}
