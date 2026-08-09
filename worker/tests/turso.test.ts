import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client, ResultSet } from '@libsql/client/web';
import { createClient } from '@libsql/client/web';
import { lookupAgent, createAgent, listAgents, revokeAgent } from '../src/storage/turso';
import { buildTestEnv, createMemoryKV, TEST_AGENT, type MemoryKV } from './test-utils';
import type { Env } from '../src/context';

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
});
