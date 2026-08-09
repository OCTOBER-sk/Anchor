import type { AgentRecord, Env } from '../context';

export interface RateLimitState {
  minuteCount: number;
  minuteWindowStart: number;
  dayCount: number;
  dayWindowStart: number;
}

const RATE_LIMIT_KEY_PREFIX = 'ratelimit:';
const TAVILY_BUDGET_KEY = 'tavily:budget:month';
const APIFY_BUDGET_KEY = 'apify:budget:month';

interface TavilyBudget {
  month: string;
  credits: number;
}

interface ApifyBudget {
  month: string;
  cents: number;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function getAgentRecord(key: string, env: Env): Promise<AgentRecord | null> {
  try {
    const raw = await env.AGENT_KEYS.get(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as AgentRecord;
  } catch {
    return null;
  }
}

export async function setAgentRecord(key: string, record: AgentRecord, env: Env): Promise<void> {
  try {
    await env.AGENT_KEYS.put(key, JSON.stringify(record));
  } catch {
    // no-op: KV outage must degrade gracefully
  }
}

export async function getRateLimitState(agentId: string, env: Env): Promise<RateLimitState | null> {
  try {
    const raw = await env.RATE_LIMIT.get(`${RATE_LIMIT_KEY_PREFIX}${agentId}`);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as RateLimitState;
  } catch {
    return null;
  }
}

export async function setRateLimitState(agentId: string, state: RateLimitState, env: Env): Promise<void> {
  try {
    await env.RATE_LIMIT.put(`${RATE_LIMIT_KEY_PREFIX}${agentId}`, JSON.stringify(state));
  } catch {
    // no-op: KV outage must degrade gracefully
  }
}

export async function getCached<T>(key: string, env: Env): Promise<T | null> {
  try {
    const raw = await env.RESPONSE_CACHE.get(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number, env: Env): Promise<void> {
  try {
    await env.RESPONSE_CACHE.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch {
    // no-op: KV outage must degrade gracefully
  }
}

export async function getTavilyBudgetCounter(env: Env): Promise<number> {
  try {
    const raw = await env.RATE_LIMIT.get(TAVILY_BUDGET_KEY);
    if (raw === null) {
      return 0;
    }
    const budget = JSON.parse(raw) as TavilyBudget;
    return budget.month === currentMonth() ? budget.credits : 0;
  } catch {
    return 0;
  }
}

export async function incrementTavilyBudgetCounter(delta: number, env: Env): Promise<void> {
  try {
    const raw = await env.RATE_LIMIT.get(TAVILY_BUDGET_KEY);
    const budget: TavilyBudget = raw === null ? { month: currentMonth(), credits: 0 } : (JSON.parse(raw) as TavilyBudget);
    if (budget.month !== currentMonth()) {
      budget.month = currentMonth();
      budget.credits = 0;
    }
    budget.credits += delta;
    await env.RATE_LIMIT.put(TAVILY_BUDGET_KEY, JSON.stringify(budget));
  } catch {
    // no-op: KV outage must degrade gracefully
  }
}

export async function getApifyBudgetCounter(env: Env): Promise<number> {
  try {
    const raw = await env.RATE_LIMIT.get(APIFY_BUDGET_KEY);
    if (raw === null) {
      return 0;
    }
    const budget = JSON.parse(raw) as ApifyBudget;
    return budget.month === currentMonth() ? budget.cents : 0;
  } catch {
    return 0;
  }
}

export async function incrementApifyBudgetCounter(delta: number, env: Env): Promise<void> {
  try {
    const raw = await env.RATE_LIMIT.get(APIFY_BUDGET_KEY);
    const budget: ApifyBudget = raw === null ? { month: currentMonth(), cents: 0 } : (JSON.parse(raw) as ApifyBudget);
    if (budget.month !== currentMonth()) {
      budget.month = currentMonth();
      budget.cents = 0;
    }
    budget.cents += delta;
    await env.RATE_LIMIT.put(APIFY_BUDGET_KEY, JSON.stringify(budget));
  } catch {
    // no-op: KV outage must degrade gracefully
  }
}
