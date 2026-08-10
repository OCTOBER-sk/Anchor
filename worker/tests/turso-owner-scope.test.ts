import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from '@libsql/client/web';
import { createClient as createNodeClient } from '@libsql/client';
import { listAgentKeys, queryUsageSummary, queryActivity } from '../src/storage/turso';
import { buildTestEnv } from './test-utils';

// Exercise the real storage layer against an in-memory SQLite database seeded
// with two owners so we can prove reads are scoped by owner_id — a mocked
// execute() can never demonstrate the SQL filter, so this uses a real client.
vi.mock('@libsql/client/web', () => ({ createClient: vi.fn() }));
import { createClient as createWebClient } from '@libsql/client/web';

type NodeClient = ReturnType<typeof createNodeClient>;

const SCHEMA = [
  `create table agents (
     id text primary key,
     key_hash text not null unique,
     key_ciphertext text,
     slug text not null,
     name text not null default '',
     owner_id text not null,
     tier text not null default 'standard',
     rate_limit_per_min integer not null default 30,
     rate_limit_per_day integer not null default 500,
     status text not null default 'active',
     created_at text not null,
     last_used_at text
   )`,
  `create table requests (
     id text primary key,
     agent_id text not null,
     tool_name text not null,
     status text not null,
     error_code text,
     latency_ms integer not null,
     created_at text not null
   )`,
];

let db: NodeClient;
let env: Awaited<ReturnType<typeof buildTestEnv>>;

const todayIso = new Date().toISOString();
const oldIso = new Date(2000, 0, 2).toISOString();

async function seedAgent(
  id: string,
  ownerId: string,
  overrides: Partial<{ slug: string; name: string; status: string; createdAt: string }> = {},
): Promise<void> {
  await db.execute({
    sql: `insert into agents (id, key_hash, key_ciphertext, slug, name, owner_id, tier, rate_limit_per_min, rate_limit_per_day, status, created_at, last_used_at)
          values (?, ?, ?, ?, ?, ?, 'standard', 30, 500, ?, ?, null)`,
    args: [
      id,
      `hash-${id}`,
      null,
      overrides.slug ?? id,
      overrides.name ?? id,
      ownerId,
      overrides.status ?? 'active',
      overrides.createdAt ?? todayIso,
    ],
  });
}

async function seedRequest(id: string, agentId: string, toolName: string, createdAt: string): Promise<void> {
  await db.execute({
    sql: `insert into requests (id, agent_id, tool_name, status, error_code, latency_ms, created_at)
          values (?, ?, ?, 'success', null, 20, ?)`,
    args: [id, agentId, toolName, createdAt],
  });
}

beforeEach(async () => {
  db = createNodeClient({ url: ':memory:' });
  for (const stmt of SCHEMA) {
    await db.execute(stmt);
  }
  vi.mocked(createWebClient).mockReturnValue(db as unknown as Client);
  env = await buildTestEnv();
});

describe('storage/turso — owner scoping (two owners, real in-memory DB)', () => {
  it('listAgentKeys returns only the calling owner\u2019s keys', async () => {
    await seedAgent('a1', 'user-1', { createdAt: '2026-08-09T00:00:00Z' });
    await seedAgent('a2', 'user-1', { createdAt: '2026-08-10T00:00:00Z' });
    await seedAgent('b1', 'user-2', { createdAt: '2026-08-09T01:00:00Z' });
    await seedAgent('b2', 'user-2', { createdAt: '2026-08-10T01:00:00Z' });

    const keys1 = await listAgentKeys('user-1', env);
    const keys2 = await listAgentKeys('user-2', env);

    expect(keys1.map((k) => k.id).sort()).toEqual(['a1', 'a2']);
    expect(keys2.map((k) => k.id).sort()).toEqual(['b1', 'b2']);
    expect(keys1.map((k) => k.id)).not.toContain('b1');
    expect(keys1.map((k) => k.id)).not.toContain('b2');
    expect(keys2.map((k) => k.id)).not.toContain('a1');
  });

  it('queryUsageSummary scopes totals, active key count, and by-capability usage per owner', async () => {
    await seedAgent('a1', 'user-1');
    await seedAgent('a2', 'user-1');
    await seedAgent('b1', 'user-2');
    await seedAgent('b2', 'user-2', { status: 'revoked' });

    await seedRequest('r1', 'a1', 'anchor_search', todayIso);
    await seedRequest('r2', 'a1', 'anchor_remember', todayIso);
    await seedRequest('r3', 'a1', 'anchor_guide', todayIso);
    await seedRequest('r4', 'a1', 'anchor_search', oldIso);

    await seedRequest('r5', 'b1', 'anchor_search', todayIso);
    await seedRequest('r6', 'b1', 'anchor_dev_search', todayIso);
    await seedRequest('r7', 'b2', 'anchor_search', todayIso);

    const summary1 = await queryUsageSummary('user-1', env);
    const summary2 = await queryUsageSummary('user-2', env);

    expect(summary1.requestsToday).toBe(3);
    expect(summary1.requestsThisMonth).toBe(3);
    expect(summary1.activeKeyCount).toBe(2);
    expect(summary1.byCapability.search).toEqual({ count: 1, lastUsedAt: todayIso });
    expect(summary1.byCapability.memory).toEqual({ count: 1, lastUsedAt: todayIso });
    expect(summary1.byCapability.devSearch).toEqual({ count: 0, lastUsedAt: null });

    expect(summary2.requestsToday).toBe(3);
    expect(summary2.requestsThisMonth).toBe(3);
    expect(summary2.activeKeyCount).toBe(1);
    expect(summary2.byCapability.search).toEqual({ count: 2, lastUsedAt: todayIso });
    expect(summary2.byCapability.devSearch).toEqual({ count: 1, lastUsedAt: todayIso });

    expect(summary1.byCapability.search.count).toBe(1);
    expect(summary2.byCapability.search.count).toBe(2);
  });

  it('queryActivity returns only the calling owner\u2019s request log entries', async () => {
    await seedAgent('a1', 'user-1');
    await seedAgent('b1', 'user-2');

    await seedRequest('r1', 'a1', 'anchor_search', '2026-08-10T01:00:00Z');
    await seedRequest('r2', 'a1', 'anchor_guide', '2026-08-10T02:00:00Z');
    await seedRequest('r3', 'b1', 'anchor_search', '2026-08-10T03:00:00Z');

    const activity1 = await queryActivity('user-1', 20, env);
    const activity2 = await queryActivity('user-2', 20, env);

    expect(activity1.map((a) => a.id)).toEqual(['r2', 'r1']);
    expect(activity2.map((a) => a.id)).toEqual(['r3']);
    expect(activity1.map((a) => a.agentSlug)).toEqual(['a1', 'a1']);
    expect(activity2.map((a) => a.agentSlug)).toEqual(['b1']);
  });

  it('queryActivity honors the limit within the owner\u2019s scoped rows', async () => {
    await seedAgent('a1', 'user-1');
    await seedRequest('r1', 'a1', 'anchor_search', '2026-08-10T01:00:00Z');
    await seedRequest('r2', 'a1', 'anchor_search', '2026-08-10T02:00:00Z');

    const limited = await queryActivity('user-1', 1, env);
    expect(limited).toHaveLength(1);
    expect(limited[0]?.id).toBe('r2');
  });
});
