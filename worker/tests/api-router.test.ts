import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentRecord, Env } from '../src/context';
import { handleApi } from '../src/api/router';

vi.mock('../src/storage/turso', () => ({
  deriveUniqueSlug: vi.fn(),
  createAgent: vi.fn(),
  getAgentById: vi.fn(),
  getAgentKeyCiphertext: vi.fn(),
  listAgentKeys: vi.fn(),
  renameAgent: vi.fn(),
  revokeAgent: vi.fn(),
  queryUsageSummary: vi.fn(),
  queryActivity: vi.fn(),
  slugify: vi.fn(),
  logRequest: vi.fn(),
}));

import * as turso from '../src/storage/turso';
import { encrypt, getKeyCipher } from '../src/utils/crypto';
import { hashAgentKey } from '../src/auth/verify';
import { buildTestEnv, TEST_AGENT } from './test-utils';

const deriveUniqueSlugMock = vi.mocked(turso.deriveUniqueSlug);
const createAgentMock = vi.mocked(turso.createAgent);
const getAgentByIdMock = vi.mocked(turso.getAgentById);
const getAgentKeyCiphertextMock = vi.mocked(turso.getAgentKeyCiphertext);
const listAgentKeysMock = vi.mocked(turso.listAgentKeys);
const renameAgentMock = vi.mocked(turso.renameAgent);
const revokeAgentMock = vi.mocked(turso.revokeAgent);
const queryUsageSummaryMock = vi.mocked(turso.queryUsageSummary);
const queryActivityMock = vi.mocked(turso.queryActivity);

const VALID_TOKEN = 'supabase-jwt-token';
const VALID_TOKEN_2 = 'supabase-jwt-token-2';
const userId = 'dash-user-1';
const userId2 = 'dash-user-2';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${VALID_TOKEN}`, 'Content-Type': 'application/json', ...extra };
}

const baseSecret = '1234567890abcdef1234567890abcdef';

beforeEach(() => {
  vi.resetAllMocks();
  deriveUniqueSlugMock.mockResolvedValue('cursor');
  listAgentKeysMock.mockResolvedValue([]);
  queryUsageSummaryMock.mockResolvedValue({
    requestsToday: 0,
    requestsThisMonth: 0,
    activeKeyCount: 0,
    byCapability: {
      search: { count: 0, lastUsedAt: null },
      devSearch: { count: 0, lastUsedAt: null },
      memory: { count: 0, lastUsedAt: null },
    },
  });
  queryActivityMock.mockResolvedValue([]);

  // Supabase /auth/v1/user returns 200 with the user id for the valid token,
  // and 401 otherwise. safeFetch() ultimately calls global fetch.
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const token = headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null;
    if (url.includes('/auth/v1/user')) {
      if (token === VALID_TOKEN) {
        return new Response(JSON.stringify({ id: userId, email: 'dev@example.com' }), { status: 200 });
      }
      if (token === VALID_TOKEN_2) {
        return new Response(JSON.stringify({ id: userId2, email: 'other@example.com' }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401 });
    }
    return new Response('not found', { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function buildAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return { ...TEST_AGENT, ownerId: userId, ...overrides };
}

describe('api router — health', () => {
  it('GET /api/health requires no auth and returns ok', async () => {
    const env: Env = await buildTestEnv();
    const request = new Request('https://anchor-mcp.test.workers.dev/api/health');
    const response = await handleApi(request, env, '/api/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok', version: '1.0.0' });
  });
});

describe('api router — auth rejection (Supabase JWT)', () => {
  it('rejects an endpoint without a bearer token with 401 UNAUTHORIZED', async () => {
    const env: Env = await buildTestEnv();
    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' } });
  });

  it('rejects an invalid token with 401 UNAUTHORIZED', async () => {
    const env: Env = await buildTestEnv();
    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'GET',
      headers: { Authorization: 'Bearer bad-token', 'Content-Type': 'application/json' },
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(401);
  });
});

describe('api router — agent keys', () => {
  it('POST /api/agent-keys creates a key, returns the raw key once, and derives the slug', async () => {
    const env: Env = await buildTestEnv();
    const created: AgentRecord = { ...buildAgent(), id: 'key-1', slug: 'cursor', name: 'Cursor — work' };
    createAgentMock.mockResolvedValue(created);
    deriveUniqueSlugMock.mockResolvedValue('cursor');

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Cursor — work' }),
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; key: string; name: string; slug: string; tier: string; createdAt: string };
    expect(body.slug).toBe('cursor');
    expect(body.name).toBe('Cursor — work');
    expect(body.tier).toBe('standard');
    expect(body.key).toMatch(/^anchor_cursor_[0-9a-f]{32}$/);
  });

  it('POST /api/agent-keys stores an explicit tier of admin and echoes it back', async () => {
    const env: Env = await buildTestEnv();
    const created: AgentRecord = { ...buildAgent(), id: 'key-1', slug: 'cursor', tier: 'admin' };
    createAgentMock.mockResolvedValue(created);

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Cursor', tier: 'admin' }),
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { tier: string };
    expect(body.tier).toBe('admin');
    expect(createAgentMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cursor', tier: 'admin' }), env);
  });

  it('POST /api/agent-keys defaults a missing tier to standard', async () => {
    const env: Env = await buildTestEnv();
    const created: AgentRecord = { ...buildAgent(), id: 'key-1', slug: 'cursor' };
    createAgentMock.mockResolvedValue(created);

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Cursor' }),
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(200);
    expect(createAgentMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cursor', tier: 'standard' }), env);
  });

  it('POST /api/agent-keys defaults an invalid tier to standard', async () => {
    const env: Env = await buildTestEnv();
    const created: AgentRecord = { ...buildAgent(), id: 'key-1', slug: 'cursor' };
    createAgentMock.mockResolvedValue(created);

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Cursor', tier: 'premium' }),
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(200);
    expect(createAgentMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cursor', tier: 'standard' }), env);
  });

  it('POST /api/agent-keys rejects a name shorter than 2 chars with 422', async () => {
    const env: Env = await buildTestEnv();
    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'X' }),
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(createAgentMock).not.toHaveBeenCalled();
  });

  it('POST /api/agent-keys rejects a name longer than 60 chars with 422', async () => {
    const env: Env = await buildTestEnv();
    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'a'.repeat(61) }),
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(422);
  });

  it('POST /api/agent-keys fails with a clear error when KEY_ENC_KEY is missing', async () => {
    const env: Env = await buildTestEnv({ KEY_ENC_KEY: '' });
    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Cursor' }),
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/KEY_ENC_KEY/);
    expect(createAgentMock).not.toHaveBeenCalled();
  });

  it('GET /api/agent-keys returns masked prefixes and never a raw key', async () => {
    const env: Env = await buildTestEnv();
    listAgentKeysMock.mockResolvedValue([
      {
        id: 'key-1',
        name: 'Cursor',
        slug: 'cursor',
        keyPrefix: `anchor_cursor_${baseSecret.slice(0, 8)}…`,
        tier: 'standard',
        status: 'active',
        createdAt: '2026-08-09T00:00:00.000Z',
        lastUsedAt: null,
        rateLimitPerMin: 30,
        rateLimitPerDay: 500,
      },
    ]);

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'GET',
      headers: authHeaders(),
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { keys: Array<Record<string, unknown>> };
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0]?.keyPrefix).toBe(`anchor_cursor_${baseSecret.slice(0, 8)}…`);
    expect(body.keys[0]?.key).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(baseSecret);
    expect(listAgentKeysMock).toHaveBeenCalledWith(userId, env);
  });

  it('GET /api/agent-keys passes the authenticated user id as the owner filter', async () => {
    const env: Env = await buildTestEnv();
    listAgentKeysMock.mockResolvedValue([]);

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      method: 'GET',
      headers: { Authorization: `Bearer ${VALID_TOKEN_2}`, 'Content-Type': 'application/json' },
    });
    const response = await handleApi(request, env, '/api/agent-keys');

    expect(response.status).toBe(200);
    expect(listAgentKeysMock).toHaveBeenCalledWith(userId2, env);
  });

  it('GET /api/agent-keys returns only the calling account\u2019s keys', async () => {
    const env: Env = await buildTestEnv();
    // The mock storage returns different key sets per owner, simulating two
    // accounts; the route must forward the caller\u2019s id so each account
    // only ever sees its own keys.
    listAgentKeysMock.mockImplementation((ownerId: string) =>
      Promise.resolve(
        ownerId === userId
          ? [{ id: 'key-1', name: 'A', slug: 'a', keyPrefix: 'anchor_a_aaaa…', tier: 'standard', status: 'active', createdAt: '2026-08-09T00:00:00.000Z', lastUsedAt: null, rateLimitPerMin: 30, rateLimitPerDay: 500 }]
          : [{ id: 'key-2', name: 'B', slug: 'b', keyPrefix: 'anchor_b_bbbb…', tier: 'standard', status: 'active', createdAt: '2026-08-09T00:00:00.000Z', lastUsedAt: null, rateLimitPerMin: 30, rateLimitPerDay: 500 }],
      ),
    );

    const reqA = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', { headers: authHeaders() });
    const resA = await handleApi(reqA, env, '/api/agent-keys');
    const bodyA = (await resA.json()) as { keys: Array<{ id: string }> };
    expect(bodyA.keys.map((k) => k.id)).toEqual(['key-1']);

    const reqB = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys', {
      headers: { Authorization: `Bearer ${VALID_TOKEN_2}`, 'Content-Type': 'application/json' },
    });
    const resB = await handleApi(reqB, env, '/api/agent-keys');
    const bodyB = (await resB.json()) as { keys: Array<{ id: string }> };
    expect(bodyB.keys.map((k) => k.id)).toEqual(['key-2']);
  });

  it('DELETE /api/agent-keys/:id revokes a key for the caller', async () => {
    const env: Env = await buildTestEnv();
    getAgentByIdMock.mockResolvedValue(buildAgent({ id: 'key-1' }));
    revokeAgentMock.mockResolvedValue(undefined);

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-1', {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-1');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 'key-1', status: 'revoked' });
    expect(revokeAgentMock).toHaveBeenCalledWith('key-1', env);
  });

  it('DELETE /api/agent-keys/:id returns 404 AGENT_KEY_NOT_FOUND for a foreign id', async () => {
    const env: Env = await buildTestEnv();
    getAgentByIdMock.mockResolvedValue(buildAgent({ id: 'key-2', ownerId: 'someone-else' })); // owned by someone else

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-2', {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-2');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: 'AGENT_KEY_NOT_FOUND', message: 'Agent key not found.' } });
    expect(revokeAgentMock).not.toHaveBeenCalled();
  });

  it('PATCH /api/agent-keys/:id renames an agent key for the caller', async () => {
    const env: Env = await buildTestEnv();
    getAgentByIdMock.mockResolvedValue(buildAgent({ id: 'key-1', name: 'Old Name' }));
    renameAgentMock.mockResolvedValue({ ...buildAgent({ id: 'key-1', name: 'Claude Code Laptop' }) });

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-1', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Claude Code Laptop' }),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-1');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 'key-1', name: 'Claude Code Laptop', slug: 'testagent' });
    expect(renameAgentMock).toHaveBeenCalledWith('key-1', 'Claude Code Laptop', env);
  });

  it('PATCH /api/agent-keys/:id returns 404 AGENT_KEY_NOT_FOUND for a foreign id', async () => {
    const env: Env = await buildTestEnv();
    getAgentByIdMock.mockResolvedValue(buildAgent({ id: 'key-2', ownerId: 'someone-else' }));

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-2', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Renamed' }),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-2');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: 'AGENT_KEY_NOT_FOUND', message: 'Agent key not found.' } });
    expect(renameAgentMock).not.toHaveBeenCalled();
  });

  it('PATCH /api/agent-keys/:id returns 422 VALIDATION_FAILED for a short name', async () => {
    const env: Env = await buildTestEnv();

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-1', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'X' }),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-1');

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: { code: 'VALIDATION_FAILED', message: 'Agent key name must be 2-60 characters.' } });
    expect(renameAgentMock).not.toHaveBeenCalled();
  });

  it('PATCH /api/agent-keys/:id returns 422 VALIDATION_FAILED for a long name', async () => {
    const env: Env = await buildTestEnv();

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-1', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'a'.repeat(61) }),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-1');

    expect(response.status).toBe(422);
    expect(renameAgentMock).not.toHaveBeenCalled();
  });
});

describe('api router — reveal key', () => {
  it('requires auth and returns 401 UNAUTHORIZED without a bearer token', async () => {
    const env: Env = await buildTestEnv();
    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-1/reveal', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-1/reveal');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' } });
    expect(getAgentKeyCiphertextMock).not.toHaveBeenCalled();
  });

  it('returns the raw key that hashes to the stored key_hash', async () => {
    const env: Env = await buildTestEnv();
    const rawKey = 'anchor_reveal_0123456789abcdef0123456789abcdef';
    const keyHash = await hashAgentKey(rawKey);
    const ciphertext = await encrypt(rawKey, getKeyCipher(env));
    getAgentKeyCiphertextMock.mockResolvedValue({
      id: 'key-1',
      keyHash,
      ownerId: userId,
      status: 'active',
      keyCiphertext: ciphertext,
    });

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-1/reveal', {
      method: 'GET',
      headers: authHeaders(),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-1/reveal');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { key: string };
    expect(body.key).toBe(rawKey);
    expect(await hashAgentKey(body.key)).toBe(keyHash);
    expect(getAgentKeyCiphertextMock).toHaveBeenCalledWith('key-1', env);
  });

  it('returns 404 AGENT_KEY_NOT_FOUND for a legacy row with no ciphertext', async () => {
    const env: Env = await buildTestEnv();
    getAgentKeyCiphertextMock.mockResolvedValue({
      id: 'key-1',
      keyHash: 'hash1',
      ownerId: userId,
      status: 'active',
      keyCiphertext: null,
    });

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-1/reveal', {
      method: 'GET',
      headers: authHeaders(),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-1/reveal');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'AGENT_KEY_NOT_FOUND', message: 'This key cannot be revealed.' },
    });
  });

  it('returns 404 AGENT_KEY_NOT_FOUND for a row owned by someone else', async () => {
    const env: Env = await buildTestEnv();
    getAgentKeyCiphertextMock.mockResolvedValue({
      id: 'key-2',
      keyHash: 'hash2',
      ownerId: 'someone-else',
      status: 'active',
      keyCiphertext: 'c2VjcmV0',
    });

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-2/reveal', {
      method: 'GET',
      headers: authHeaders(),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-2/reveal');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: 'AGENT_KEY_NOT_FOUND', message: 'Agent key not found.' } });
  });

  it('returns 404 AGENT_KEY_NOT_FOUND for a revoked key', async () => {
    const env: Env = await buildTestEnv();
    getAgentKeyCiphertextMock.mockResolvedValue({
      id: 'key-1',
      keyHash: 'hash1',
      ownerId: userId,
      status: 'revoked',
      keyCiphertext: 'c2VjcmV0',
    });

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-1/reveal', {
      method: 'GET',
      headers: authHeaders(),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-1/reveal');

    expect(response.status).toBe(404);
  });

  it('returns 404 AGENT_KEY_NOT_FOUND when the row does not exist', async () => {
    const env: Env = await buildTestEnv();
    getAgentKeyCiphertextMock.mockResolvedValue(null);

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/missing/reveal', {
      method: 'GET',
      headers: authHeaders(),
    });
    const response = await handleApi(request, env, '/api/agent-keys/missing/reveal');

    expect(response.status).toBe(404);
  });

  it('returns 500 with a clear error when KEY_ENC_KEY is missing', async () => {
    const env: Env = await buildTestEnv({ KEY_ENC_KEY: '' });
    getAgentKeyCiphertextMock.mockResolvedValue({
      id: 'key-1',
      keyHash: 'hash1',
      ownerId: userId,
      status: 'active',
      keyCiphertext: 'c2VjcmV0',
    });

    const request = new Request('https://anchor-mcp.test.workers.dev/api/agent-keys/key-1/reveal', {
      method: 'GET',
      headers: authHeaders(),
    });
    const response = await handleApi(request, env, '/api/agent-keys/key-1/reveal');

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/KEY_ENC_KEY/);
  });
});

describe('api router — usage', () => {
  it('GET /api/usage/summary returns the per-capability summary', async () => {
    const env: Env = await buildTestEnv();
    const summary = {
      requestsToday: 10,
      requestsThisMonth: 40,
      activeKeyCount: 3,
      byCapability: {
        search: { count: 20, lastUsedAt: '2026-08-09T00:00:00Z' },
        devSearch: { count: 10, lastUsedAt: null },
        memory: { count: 5, lastUsedAt: '2026-08-08T00:00:00Z' },
      },
    };
    queryUsageSummaryMock.mockResolvedValue(summary);

    const request = new Request('https://anchor-mcp.test.workers.dev/api/usage/summary', { headers: authHeaders() });
    const response = await handleApi(request, env, '/api/usage/summary');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(summary);
    expect(queryUsageSummaryMock).toHaveBeenCalledWith(userId, env);
  });

  it('GET /api/usage/summary is scoped to the authenticated user\u2019s requests and keys', async () => {
    const env: Env = await buildTestEnv();
    queryUsageSummaryMock.mockImplementation((ownerId: string) =>
      Promise.resolve({
        requestsToday: ownerId === userId ? 7 : 2,
        requestsThisMonth: ownerId === userId ? 30 : 5,
        activeKeyCount: ownerId === userId ? 4 : 1,
        byCapability: {
          search: { count: ownerId === userId ? 10 : 1, lastUsedAt: null },
          devSearch: { count: 0, lastUsedAt: null },
          memory: { count: 0, lastUsedAt: null },
        },
      }),
    );

    const reqA = new Request('https://anchor-mcp.test.workers.dev/api/usage/summary', { headers: authHeaders() });
    const resA = await handleApi(reqA, env, '/api/usage/summary');
    const bodyA = (await resA.json()) as { requestsToday: number; activeKeyCount: number };
    expect(bodyA.requestsToday).toBe(7);
    expect(bodyA.activeKeyCount).toBe(4);
    expect(queryUsageSummaryMock).toHaveBeenCalledWith(userId, env);

    const reqB = new Request('https://anchor-mcp.test.workers.dev/api/usage/summary', {
      headers: { Authorization: `Bearer ${VALID_TOKEN_2}`, 'Content-Type': 'application/json' },
    });
    const resB = await handleApi(reqB, env, '/api/usage/summary');
    const bodyB = (await resB.json()) as { requestsToday: number; activeKeyCount: number };
    expect(bodyB.requestsToday).toBe(2);
    expect(bodyB.activeKeyCount).toBe(1);
    expect(queryUsageSummaryMock).toHaveBeenCalledWith(userId2, env);
  });

  it('GET /api/usage/activity returns items and honors the limit parameter', async () => {
    const env: Env = await buildTestEnv();
    const items: Array<{
      id: string;
      tool: 'anchor_search' | 'anchor_dev_search' | 'anchor_remember' | 'anchor_recall' | 'anchor_guide';
      status: 'success' | 'error';
      latencyMs: number;
      createdAt: string;
      agentSlug: string;
    }> = [
      {
        id: 'r1',
        tool: 'anchor_search',
        status: 'success',
        latencyMs: 20,
        createdAt: '2026-08-09T00:00:00Z',
        agentSlug: 'cursor',
      },
    ];
    queryActivityMock.mockResolvedValue(items);

    const request = new Request('https://anchor-mcp.test.workers.dev/api/usage/activity?limit=1', { headers: authHeaders() });
    const response = await handleApi(request, env, '/api/usage/activity');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
    expect(queryActivityMock).toHaveBeenCalledWith(userId, 1, env);
  });

  it('GET /api/usage/activity is scoped to the authenticated user\u2019s requests', async () => {
    const env: Env = await buildTestEnv();
    queryActivityMock.mockImplementation((ownerId: string) =>
      Promise.resolve(
        ownerId === userId
          ? [{ id: 'r1', tool: 'anchor_search', status: 'success', latencyMs: 20, createdAt: '2026-08-09T00:00:00Z', agentSlug: 'cursor' }]
          : [{ id: 'r9', tool: 'anchor_guide', status: 'success', latencyMs: 3, createdAt: '2026-08-09T00:00:00Z', agentSlug: 'other' }],
      ),
    );

    const reqA = new Request('https://anchor-mcp.test.workers.dev/api/usage/activity', { headers: authHeaders() });
    const resA = await handleApi(reqA, env, '/api/usage/activity');
    const bodyA = (await resA.json()) as { items: Array<{ id: string; agentSlug: string }> };
    expect(bodyA.items).toEqual([{ id: 'r1', agentSlug: 'cursor', tool: 'anchor_search', status: 'success', latencyMs: 20, createdAt: '2026-08-09T00:00:00Z' }]);
    expect(queryActivityMock).toHaveBeenCalledWith(userId, 20, env);

    const reqB = new Request('https://anchor-mcp.test.workers.dev/api/usage/activity', {
      headers: { Authorization: `Bearer ${VALID_TOKEN_2}`, 'Content-Type': 'application/json' },
    });
    const resB = await handleApi(reqB, env, '/api/usage/activity');
    const bodyB = (await resB.json()) as { items: Array<{ id: string }> };
    expect(bodyB.items.map((i) => i.id)).toEqual(['r9']);
    expect(queryActivityMock).toHaveBeenCalledWith(userId2, 20, env);
  });
});

describe('api router — onboarding validate', () => {
  it('returns valid: true with toolCount 5 for an active key', async () => {
    const env: Env = await buildTestEnv();
    getAgentByIdMock.mockResolvedValue(buildAgent({ id: 'key-1' }));

    const request = new Request('https://anchor-mcp.test.workers.dev/api/onboarding/validate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ keyId: 'key-1' }),
    });
    const response = await handleApi(request, env, '/api/onboarding/validate');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ valid: true, toolCount: 5 });
  });

  it('returns valid: false (soft-fail 200) for a missing key', async () => {
    const env: Env = await buildTestEnv();
    getAgentByIdMock.mockResolvedValue(null);

    const request = new Request('https://anchor-mcp.test.workers.dev/api/onboarding/validate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ keyId: 'missing' }),
    });
    const response = await handleApi(request, env, '/api/onboarding/validate');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { valid: boolean; reason: string };
    expect(body.valid).toBe(false);
    expect(typeof body.reason).toBe('string');
  });

  it('returns valid: false for a revoked key', async () => {
    const env: Env = await buildTestEnv();
    getAgentByIdMock.mockResolvedValue(buildAgent({ id: 'key-1', status: 'revoked' }));

    const request = new Request('https://anchor-mcp.test.workers.dev/api/onboarding/validate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ keyId: 'key-1' }),
    });
    const response = await handleApi(request, env, '/api/onboarding/validate');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { valid: boolean };
    expect(body.valid).toBe(false);
  });
});
