import { describe, it, expect } from 'vitest';
import type { Env } from '../src/context';
import { checkAndIncrement } from '../src/auth/ratelimit';
import { createMemoryKV, type MemoryKV } from './test-utils';

const AGENT_ID = 'test-agent-id';
const RATE_LIMIT_KEY = `ratelimit:${AGENT_ID}`;
const DEFAULT_LIMITS = { perMinute: 30, perDay: 500 };

function rateLimitEnv(store: MemoryKV): Env {
  return {
    AGENT_KEYS: createMemoryKV() as unknown as KVNamespace,
    RATE_LIMIT: store as unknown as KVNamespace,
    RESPONSE_CACHE: createMemoryKV() as unknown as KVNamespace,
    TURSO_DATABASE_URL: 'libsql://test.turso.io',
    TURSO_AUTH_TOKEN: 'test-token',
    SUPABASE_ANON_KEY: 'test-anon',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test',
    KEY_ENC_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    CEREBRAS_API_KEY: 'csk-test',
    GEMINI_API_KEY: 'AIza-test',
    TAVILY_API_KEY: 'tvly-test',
    APIFY_API_TOKEN: 'apify_api_test',
    ALLOWED_ORIGINS: 'https://claude.ai',
  };
}

describe('auth/ratelimit', () => {
  it('allows the first request and performs exactly one KV write', async () => {
    const store = createMemoryKV();
    const result = await checkAndIncrement(AGENT_ID, DEFAULT_LIMITS, rateLimitEnv(store));

    expect(result.allowed).toBe(true);
    expect(result.remainingMinute).toBe(29);
    expect(result.remainingDay).toBe(499);
    expect(typeof result.resetAtMinute).toBe('string');
    expect(typeof result.resetAtDay).toBe('string');
    expect(store.puts).toHaveLength(1);

    const written = JSON.parse(store.data.get(RATE_LIMIT_KEY) ?? '{}');
    expect(written.minuteCount).toBe(1);
    expect(written.dayCount).toBe(1);
  });

  it('rejects at the per-minute cap with exactly one KV write (critical test #3)', async () => {
    const store = createMemoryKV();
    const now = Date.now();
    store.data.set(
      RATE_LIMIT_KEY,
      JSON.stringify({ minuteCount: 30, minuteWindowStart: now, dayCount: 0, dayWindowStart: now }),
    );

    const result = await checkAndIncrement(AGENT_ID, DEFAULT_LIMITS, rateLimitEnv(store));

    expect(result.allowed).toBe(false);
    expect(result.remainingMinute).toBe(0);
    expect(store.puts).toHaveLength(1);

    const written = JSON.parse(store.data.get(RATE_LIMIT_KEY) ?? '{}');
    expect(written.minuteCount).toBe(30);
    expect(written.dayCount).toBe(0);
  });

  it('rejects when the per-day cap is reached', async () => {
    const store = createMemoryKV();
    const now = Date.now();
    store.data.set(
      RATE_LIMIT_KEY,
      JSON.stringify({ minuteCount: 0, minuteWindowStart: now, dayCount: 500, dayWindowStart: now }),
    );

    const result = await checkAndIncrement(AGENT_ID, DEFAULT_LIMITS, rateLimitEnv(store));

    expect(result.allowed).toBe(false);
    expect(result.remainingDay).toBe(0);
    expect(store.puts).toHaveLength(1);
  });

  it('rolls over the minute window and allows the request', async () => {
    const store = createMemoryKV();
    const now = Date.now();
    store.data.set(
      RATE_LIMIT_KEY,
      JSON.stringify({ minuteCount: 30, minuteWindowStart: now - 120_000, dayCount: 0, dayWindowStart: now }),
    );

    const result = await checkAndIncrement(AGENT_ID, DEFAULT_LIMITS, rateLimitEnv(store));

    expect(result.allowed).toBe(true);
    expect(store.puts).toHaveLength(1);

    const written = JSON.parse(store.data.get(RATE_LIMIT_KEY) ?? '{}');
    expect(written.minuteCount).toBe(1);
    expect(written.minuteWindowStart).toBeGreaterThanOrEqual(now - 1_000);
  });

  it('rolls over the day window and allows the request', async () => {
    const store = createMemoryKV();
    const now = Date.now();
    store.data.set(
      RATE_LIMIT_KEY,
      JSON.stringify({ minuteCount: 0, minuteWindowStart: now, dayCount: 500, dayWindowStart: now - 2 * 86_400_000 }),
    );

    const result = await checkAndIncrement(AGENT_ID, DEFAULT_LIMITS, rateLimitEnv(store));

    expect(result.allowed).toBe(true);
    const written = JSON.parse(store.data.get(RATE_LIMIT_KEY) ?? '{}');
    expect(written.dayCount).toBe(1);
    expect(written.dayWindowStart).toBeGreaterThanOrEqual(now - 1_000);
  });

  it('persists a rolled-over window state even when the request is rejected', async () => {
    const store = createMemoryKV();
    const now = Date.now();
    store.data.set(
      RATE_LIMIT_KEY,
      JSON.stringify({ minuteCount: 30, minuteWindowStart: now, dayCount: 500, dayWindowStart: now - 2 * 86_400_000 }),
    );

    const result = await checkAndIncrement(AGENT_ID, DEFAULT_LIMITS, rateLimitEnv(store));

    expect(result.allowed).toBe(false);
    expect(store.puts).toHaveLength(1);

    const written = JSON.parse(store.data.get(RATE_LIMIT_KEY) ?? '{}');
    expect(written.dayCount).toBe(0);
    expect(written.dayWindowStart).toBeGreaterThanOrEqual(now - 1_000);
    expect(written.minuteCount).toBe(30);
  });

  it('surfaces resetAt timestamps on rejection', async () => {
    const store = createMemoryKV();
    const now = Date.now();
    store.data.set(
      RATE_LIMIT_KEY,
      JSON.stringify({ minuteCount: 30, minuteWindowStart: now, dayCount: 0, dayWindowStart: now }),
    );

    const result = await checkAndIncrement(AGENT_ID, DEFAULT_LIMITS, rateLimitEnv(store));

    expect(Date.parse(result.resetAtMinute)).toBe(now + 60_000);
    expect(Date.parse(result.resetAtDay)).toBe(now + 86_400_000);
  });
});
