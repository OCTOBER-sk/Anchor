import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client, ResultSet } from '@libsql/client/web';
import { createClient } from '@libsql/client/web';
import { lookupAgent, createAgent, listAgents, revokeAgent, renameAgent, slugify, deriveUniqueSlug, listAgentKeys, logRequest, queryUsageSummary, queryActivity } from '../src/storage/turso';
import { buildTestEnv, TEST_AGENT, type MemoryKV } from './test-utils';

vi.mock('@libsql/client/web', () => ({
  createClient: vi.fn(),
}));

interface MockRow {
  [column: string]: unknown;
}

function agentRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: 'agent-1',
    key_hash: 'hash1',
    slug: 'cli',
    name: '',
    owner_id: 'anchor-owner',
    tier: 'standard',
    rate_limit_per_min: 30,
    rate_limit_per_day: 500,
    status: 'active',
    created_at: '2026-08-09T00:00:00.000Z',
    last_used_at: null,
    ...overrides,
  };
}

const executeMock = vi.fn();

function resultSet(rows: MockRow[] = []): ResultSet {
  return {
    columns: Object.keys(rows[0] ?? {}),
    columnTypes: [],
    rows,
    rowsAffected: 0,
    lastInsertRowid: undefined,
    toJSON: () => ({}),
  } as unknown as ResultSet;
}

beforeEach(() => {
  executeMock.mockReset();
  vi.mocked(createClient).mockReturnValue({ execute: executeMock } as unknown as Client);
});

describe('storage/turso', () => {
  it('lookupAgent maps a DB row to an AgentRecord', async () => {
    executeMock.mockResolvedValue(resultSet([agentRow()]));

    const env = await buildTestEnv();
    const record = await lookupAgent('hash1', env);

    expect(record).toEqual({
      id: 'agent-1',
      slug: 'cli',
      name: '',
      ownerId: 'anchor-owner',
      tier: 'standard',
      status: 'active',
      rateLimits: { perMinute: 30, perDay: 500 },
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0]?.[0]).toMatchObject({
      sql: expect.stringContaining('key_hash = ?'),
      args: ['hash1'],
    });
  });

  it('lookupAgent returns null when no row matches', async () => {
    executeMock.mockResolvedValue(resultSet());

    const env = await buildTestEnv();
    const record = await lookupAgent('missing', env);

    expect(record).toBeNull();
  });

  it('createAgent inserts the row and writes the KV entry immediately', async () => {
    executeMock.mockResolvedValue(resultSet());

    const env = await buildTestEnv();
    const record = await createAgent({ keyHash: 'hash1', slug: 'cli', ownerId: 'anchor-owner' }, env);

    expect(record.id).toBeTruthy();
    expect(record.slug).toBe('cli');
    expect(record.tier).toBe('standard');
    expect(record.status).toBe('active');
    expect(record.rateLimits).toEqual({ perMinute: 30, perDay: 500 });

    const insertCall = executeMock.mock.calls[0]?.[0];
    expect(insertCall).toMatchObject({ sql: expect.stringContaining('insert into agents') });

    const agentKv = env.AGENT_KEYS as unknown as MemoryKV;
    const cached = JSON.parse(agentKv.data.get('hash1') ?? '{}');
    expect(cached.id).toBe(record.id);
  });

  it('createAgent honors explicit tier and rate limits', async () => {
    executeMock.mockResolvedValue(resultSet());

    const env = await buildTestEnv();
    const record = await createAgent(
      { keyHash: 'hash2', slug: 'adminagent', ownerId: 'anchor-owner', tier: 'admin', rateLimits: { perMinute: 60, perDay: 1000 } },
      env,
    );

    expect(record.tier).toBe('admin');
    expect(record.rateLimits).toEqual({ perMinute: 60, perDay: 1000 });
    const insertArgs = executeMock.mock.calls[0]?.[0].args;
    expect(insertArgs).toContain('adminagent');
    expect(insertArgs).toContain('admin');
    expect(insertArgs).toContain(60);
    expect(insertArgs).toContain(1000);
  });

  it('listAgents maps every row', async () => {
    executeMock.mockResolvedValue(
      resultSet([agentRow({ id: 'a1' }), agentRow({ id: 'a2', key_hash: 'hash2', status: 'revoked' })]),
    );

    const env = await buildTestEnv();
    const agents = await listAgents(env);

    expect(agents).toHaveLength(2);
    expect(agents[0]?.id).toBe('a1');
    expect(agents[1]?.status).toBe('revoked');
  });

  it('revokeAgent updates the DB status and the KV cache entry', async () => {
    const env = await buildTestEnv();
    const agentKv = env.AGENT_KEYS as unknown as MemoryKV;
    const hash = 'hash1';
    agentKv.data.set(hash, JSON.stringify({ ...TEST_AGENT, id: 'agent-1' }));

    executeMock
      .mockResolvedValueOnce(resultSet([agentRow()]))
      .mockResolvedValueOnce(resultSet());

    await revokeAgent('agent-1', env);

    expect(executeMock.mock.calls[1]?.[0]).toMatchObject({
      sql: expect.stringContaining("status = 'revoked'"),
      args: ['agent-1'],
    });
    const cached = JSON.parse(agentKv.data.get(hash) ?? '{}');
    expect(cached.status).toBe('revoked');
  });

  it('revokeAgent is a no-op when the agent does not exist', async () => {
    executeMock.mockResolvedValue(resultSet());

    const env = await buildTestEnv();
    await expect(revokeAgent('does-not-exist', env)).resolves.toBeUndefined();
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed: lookupAgent throws when the database errors', async () => {
    executeMock.mockRejectedValue(new Error('database unavailable'));

    const env = await buildTestEnv();
    await expect(lookupAgent('hash1', env)).rejects.toThrow('database unavailable');
  });

  it('fails closed: createAgent propagates database errors and writes nothing to KV', async () => {
    executeMock.mockRejectedValue(new Error('database unavailable'));

    const env = await buildTestEnv();
    const agentKv = env.AGENT_KEYS as unknown as MemoryKV;
    await expect(createAgent({ keyHash: 'hash-new', slug: 'cli', ownerId: 'anchor-owner' }, env)).rejects.toThrow(
      'database unavailable',
    );
    expect(agentKv.data.has('hash-new')).toBe(false);
  });

  it('slugify lowercases and makes names URL-safe', () => {
    expect(slugify('Cursor — work')).toBe('cursor-work');
    expect(slugify('  My  Key!!')).toBe('my-key');
    expect(slugify('Backup Phone')).toBe('backup-phone');
    expect(slugify('!!!')).toBe('agent');
  });

  it('deriveUniqueSlug appends -2, -3 on collision', async () => {
    executeMock.mockResolvedValue(resultSet([{ slug: 'cursor' }, { slug: 'cursor-2' }]));

    const env = await buildTestEnv();
    const slug = await deriveUniqueSlug('Cursor', env);

    expect(slug).toBe('cursor-3');
    expect(executeMock.mock.calls[0]?.[0]).toMatchObject({
      sql: expect.stringContaining('select slug from agents'),
    });
  });

  it('createAgent derives a URL-safe slug from the name and dedupes against existing slugs', async () => {
    executeMock
      .mockResolvedValueOnce(resultSet([{ slug: 'cursor' }])) // existing slug collision
      .mockResolvedValueOnce(resultSet()); // insert

    const env = await buildTestEnv();
    const record = await createAgent({ keyHash: 'hashX', name: 'Cursor', ownerId: 'anchor-owner' }, env);

    expect(record.slug).toBe('cursor-2');
    expect(record.name).toBe('Cursor');
    expect(record.tier).toBe('standard');
    expect(record.status).toBe('active');

    const insertCall = executeMock.mock.calls[1]?.[0];
    expect(insertCall.sql).toContain('insert into agents');
    expect(insertCall.args).toContain('cursor-2');
    expect(insertCall.args).toContain('Cursor');

    const agentKv = env.AGENT_KEYS as unknown as MemoryKV;
    const cached = JSON.parse(agentKv.data.get('hashX') ?? '{}');
    expect(cached.slug).toBe('cursor-2');
    expect(cached.name).toBe('Cursor');
  });

  it('listAgentKeys maps rows to masked key prefixes and never returns the raw key', async () => {
    executeMock.mockResolvedValue(
      resultSet([
        {
          id: 'a1',
          key_hash: 'abcdef0123456789...',
          slug: 'cursor',
          name: 'Cursor',
          tier: 'standard',
          status: 'active',
          created_at: '2026-08-09T00:00:00.000Z',
          last_used_at: null,
          rate_limit_per_min: 30,
          rate_limit_per_day: 500,
        },
      ]),
    );

    const env = await buildTestEnv();
    const keys = await listAgentKeys(env);

    expect(keys).toHaveLength(1);
    expect(keys[0]?.name).toBe('Cursor');
    expect(keys[0]?.keyPrefix).toBe('anchor_cursor_abcdef01…');
    expect(keys[0]?.rateLimitPerMin).toBe(30);
    expect(keys[0]?.createdAt).toBe('2026-08-09T00:00:00.000Z');
    expect(JSON.stringify(keys)).not.toContain('anchor_cursor_abcdef0123456789');
  });

  it('listAgentKeys derives lastUsedAt from the requests log (per-agent max)', async () => {
    // The agents row carries a null last_used_at (never populated live);
    // the subquery mock returns the most recent request timestamp per agent.
    executeMock.mockResolvedValue(
      resultSet([
        {
          id: 'a1',
          key_hash: 'abcdef0123456789...',
          slug: 'cursor',
          name: 'Cursor',
          tier: 'standard',
          status: 'active',
          created_at: '2026-08-09T00:00:00.000Z',
          last_used_at: '2026-08-09T02:15:00.000Z',
          rate_limit_per_min: 30,
          rate_limit_per_day: 500,
        },
        {
          id: 'a2',
          key_hash: 'abcd00000000000000...',
          slug: 'cli',
          name: 'CLI',
          tier: 'standard',
          status: 'active',
          created_at: '2026-08-09T01:00:00.000Z',
          last_used_at: null,
          rate_limit_per_min: 30,
          rate_limit_per_day: 500,
        },
      ]),
    );

    const env = await buildTestEnv();
    const keys = await listAgentKeys(env);

    expect(keys[0]?.lastUsedAt).toBe('2026-08-09T02:15:00.000Z');
    expect(keys[1]?.lastUsedAt).toBeNull();

    const sql = executeMock.mock.calls[0]?.[0].sql as string;
    expect(sql).toContain('requests');
    expect(sql).toContain('max(r.created_at)');
    expect(sql).toContain('agent_id = a.id');
  });

  it('listAgentKeys reports null lastUsedAt for agents with no request rows', async () => {
    executeMock.mockResolvedValue(
      resultSet([
        {
          id: 'a1',
          key_hash: 'abcdef0123456789...',
          slug: 'cursor',
          name: 'Cursor',
          tier: 'standard',
          status: 'active',
          created_at: '2026-08-09T00:00:00.000Z',
          last_used_at: null,
          rate_limit_per_min: 30,
          rate_limit_per_day: 500,
        },
      ]),
    );

    const env = await buildTestEnv();
    const keys = await listAgentKeys(env);

    expect(keys[0]?.lastUsedAt).toBeNull();
  });

  it('renameAgent updates the name in Turso and rewrites the KV record under the same key hash', async () => {
    const env = await buildTestEnv();
    const agentKv = env.AGENT_KEYS as unknown as MemoryKV;
    const hash = 'hash1';
    executeMock
      .mockResolvedValueOnce(resultSet([agentRow({ id: 'agent-1', name: 'Old Name' })]))
      .mockResolvedValueOnce(resultSet());

    const renamed = await renameAgent('agent-1', 'Claude Code Laptop', env);

    expect(renamed).toMatchObject({ id: 'agent-1', slug: 'cli', name: 'Claude Code Laptop' });
    const updateCall = executeMock.mock.calls[1]?.[0];
    expect(updateCall).toMatchObject({
      sql: expect.stringContaining('update agents set name = ?'),
      args: ['Claude Code Laptop', 'agent-1'],
    });
    const cached = JSON.parse(agentKv.data.get(hash) ?? '{}');
    expect(cached.name).toBe('Claude Code Laptop');
    expect(cached.slug).toBe('cli');
  });

  it('renameAgent returns null when the agent does not exist', async () => {
    executeMock.mockResolvedValue(resultSet());

    const env = await buildTestEnv();
    await expect(renameAgent('missing', 'New Name', env)).resolves.toBeNull();
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('logRequest inserts a row and swallows database errors', async () => {
    executeMock.mockResolvedValue(resultSet());

    const env = await buildTestEnv();
    await logRequest(
      { agentId: 'a1', toolName: 'anchor_search', status: 'success', latencyMs: 42, createdAt: '2026-08-09T00:00:00Z' },
      env,
    );

    const insertCall = executeMock.mock.calls[0]?.[0];
    expect(insertCall.sql).toContain('insert into requests');
    expect(insertCall.args).toContain('a1');
    expect(insertCall.args).toContain('anchor_search');
    expect(insertCall.args).toContain('success');

    executeMock.mockRejectedValue(new Error('db unavailable'));
    await expect(
      logRequest({ agentId: 'a1', toolName: 'anchor_guide', status: 'error', errorCode: 'INTERNAL_ERROR', latencyMs: 5, createdAt: '2026-08-09T00:00:00Z' }, env),
    ).resolves.toBeUndefined();
  });

  it('queryUsageSummary computes today/month totals, active key count, and by-capability usage', async () => {
    const now = new Date();
    const todayIso = now.toISOString();

    executeMock
      .mockResolvedValueOnce(resultSet([{ c: 2 }])) // active count
      .mockResolvedValueOnce(
        resultSet([
          { tool_name: 'anchor_search', created_at: todayIso },
          { tool_name: 'anchor_search', created_at: todayIso },
          { tool_name: 'anchor_dev_search', created_at: '2026-08-01T00:00:00Z' },
          { tool_name: 'anchor_recall', created_at: todayIso },
          { tool_name: 'anchor_guide', created_at: todayIso },
        ]),
      );

    const env = await buildTestEnv();
    const summary = await queryUsageSummary(env);

    expect(summary.requestsToday).toBe(4);
    expect(summary.requestsThisMonth).toBe(5);
    expect(summary.activeKeyCount).toBe(2);
    expect(summary.byCapability.search).toEqual({ count: 2, lastUsedAt: todayIso });
    expect(summary.byCapability.devSearch).toEqual({ count: 1, lastUsedAt: '2026-08-01T00:00:00Z' });
    expect(summary.byCapability.memory).toEqual({ count: 1, lastUsedAt: todayIso });
  });

  it('queryActivity maps rows to items with errorCode and agentSlug', async () => {
    executeMock.mockResolvedValue(
      resultSet([
        {
          id: 'r1',
          tool_name: 'anchor_search',
          status: 'error',
          error_code: 'SEARCH_UNAVAILABLE',
          latency_ms: 12,
          created_at: '2026-08-09T00:00:00Z',
          agent_slug: 'cursor',
        },
        {
          id: 'r2',
          tool_name: 'anchor_guide',
          status: 'success',
          error_code: null,
          latency_ms: 3,
          created_at: '2026-08-08T00:00:00Z',
          agent_slug: null,
        },
      ]),
    );

    const env = await buildTestEnv();
    const items = await queryActivity(20, env);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: 'r1',
      tool: 'anchor_search',
      status: 'error',
      errorCode: 'SEARCH_UNAVAILABLE',
      latencyMs: 12,
      createdAt: '2026-08-09T00:00:00Z',
      agentSlug: 'cursor',
    });
    expect(items[1]?.errorCode).toBeUndefined();
    expect(items[1]?.agentSlug).toBe('');
    expect(executeMock.mock.calls[0]?.[0].args).toEqual([20]);
  });
});
