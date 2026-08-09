import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../src/context';
import { handleRequest } from '../src/mcp/server';
import { generateAgentKey } from '../src/auth/keys';
import { hashAgentKey } from '../src/auth/verify';
import { buildTestEnv, TEST_AGENT, TEST_AGENT_KEY, type MemoryKV } from './test-utils';
import anchorWorker from '../src/index';

vi.mock('../src/storage/turso', () => ({
  lookupAgent: vi.fn(),
  createAgent: vi.fn(),
  listAgents: vi.fn(),
  revokeAgent: vi.fn(),
}));

import * as turso from '../src/storage/turso';

interface RpcError {
  code: number;
  message: string;
  data?: { platformCode?: string; resetAtMinute?: string; resetAtDay?: string; [key: string]: unknown };
}

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: Record<string, unknown>;
  error?: RpcError;
}

const lookupAgentMock = vi.mocked(turso.lookupAgent);

beforeEach(() => {
  lookupAgentMock.mockReset();
  lookupAgentMock.mockResolvedValue(null);
  vi.mocked(turso.createAgent).mockReset();
  vi.mocked(turso.listAgents).mockReset();
  vi.mocked(turso.revokeAgent).mockReset();
});

async function sendRpc(body: unknown, key: string | null, env: Env): Promise<RpcResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key !== null) {
    headers.Authorization = `Bearer ${key}`;
  }
  const request = new Request('https://anchor-mcp.test.workers.dev/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const response = await handleRequest(request, env);
  expect(response.status).toBe(200);
  return (await response.json()) as RpcResponse;
}

const INIT = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} };

describe('auth flow', () => {
  it('rejects an unauthenticated POST /mcp request with -32001 through the worker entrypoint', async () => {
    const env = await buildTestEnv();
    const request = new Request('https://anchor-mcp.test.workers.dev/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    const response = await anchorWorker.fetch(request, env, {} as unknown as ExecutionContext);

    expect(response.status).toBe(200);
    const res = (await response.json()) as RpcResponse;
    expect(res.error?.code).toBe(-32001);
    expect(res.error?.message).toBe('Authentication failed.');
    expect(lookupAgentMock).not.toHaveBeenCalled();
  });

  it('authenticates a valid key and dispatches the request', async () => {
    const env = await buildTestEnv();
    const res = await sendRpc(INIT, TEST_AGENT_KEY, env);

    expect(res.error).toBeUndefined();
    expect(res.result?.protocolVersion).toBe('2025-11-25');
    expect(lookupAgentMock).not.toHaveBeenCalled();
  });

  it('rejects a missing Authorization header with -32001', async () => {
    const env = await buildTestEnv();
    const res = await sendRpc(INIT, null, env);

    expect(res.error?.code).toBe(-32001);
    expect(res.error?.message).toBe('Authentication failed.');
    expect(lookupAgentMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed key with zero storage calls (critical test #4a)', async () => {
    const throwingKv = {
      get: async () => {
        throw new Error('storage touched');
      },
      put: async () => {
        throw new Error('storage touched');
      },
      delete: async () => {
        throw new Error('storage touched');
      },
    };
    const env = (await buildTestEnv()) as Env;
    env.AGENT_KEYS = throwingKv as unknown as KVNamespace;
    env.RATE_LIMIT = throwingKv as unknown as KVNamespace;

    const res = await sendRpc(INIT, 'malformed-key', env);

    expect(res.error?.code).toBe(-32001);
    expect(res.error?.message).toBe('Authentication failed.');
    expect(lookupAgentMock).not.toHaveBeenCalled();
  });

  it('rejects a well-formed unknown key after KV miss and Turso miss with a generic message (critical test #4b)', async () => {
    lookupAgentMock.mockResolvedValue(null);

    const env = await buildTestEnv();
    const unknownKey = generateAgentKey('unknownagent');
    const res = await sendRpc(INIT, unknownKey, env);

    expect(res.error?.code).toBe(-32001);
    expect(res.error?.message).toBe('Authentication failed.');
    expect(res.error?.message).not.toContain('unknownagent');
    expect(lookupAgentMock).toHaveBeenCalledTimes(1);
  });

  it('writes back to KV after a successful Turso fallback lookup', async () => {
    lookupAgentMock.mockResolvedValue(TEST_AGENT);

    const env = await buildTestEnv();
    const key = generateAgentKey('freshagent');
    const res = await sendRpc(INIT, key, env);

    expect(res.error).toBeUndefined();
    const agentKv = env.AGENT_KEYS as unknown as MemoryKV;
    const hash = await hashAgentKey(key);
    expect(agentKv.data.has(hash)).toBe(true);
    expect(JSON.parse(agentKv.data.get(hash) ?? '{}').id).toBe(TEST_AGENT.id);
  });

  it('rejects a revoked key (critical test #4c)', async () => {
    const env = await buildTestEnv();
    const agentKv = env.AGENT_KEYS as unknown as MemoryKV;
    const hash = await hashAgentKey(TEST_AGENT_KEY);
    agentKv.data.set(hash, JSON.stringify({ ...TEST_AGENT, status: 'revoked' }));

    const res = await sendRpc(INIT, TEST_AGENT_KEY, env);

    expect(res.error?.code).toBe(-32001);
    expect(res.error?.message).toBe('Authentication failed.');
  });

  it('rejects a key whose record is revoked at the source (Turso)', async () => {
    lookupAgentMock.mockResolvedValue({ ...TEST_AGENT, status: 'revoked' });

    const env = await buildTestEnv();
    const res = await sendRpc(INIT, generateAgentKey('revokedagent'), env);

    expect(res.error?.code).toBe(-32001);
    expect(res.error?.message).toBe('Authentication failed.');
  });

  it('fails closed when Turso is unavailable during a KV-miss fallback', async () => {
    lookupAgentMock.mockRejectedValue(new Error('turso unavailable'));

    const env = await buildTestEnv();
    const res = await sendRpc(INIT, generateAgentKey('someone'), env);

    expect(res.error?.code).toBe(-32001);
    expect(res.error?.message).toBe('Authentication failed.');
  });

  it('returns RATE_LIMITED (-32000) with resetAt fields when the per-minute cap is hit', async () => {
    const env = await buildTestEnv();
    const rateStore = env.RATE_LIMIT as unknown as MemoryKV;
    const now = Date.now();
    rateStore.data.set(
      `ratelimit:${TEST_AGENT.id}`,
      JSON.stringify({ minuteCount: 30, minuteWindowStart: now, dayCount: 0, dayWindowStart: now }),
    );

    const res = await sendRpc(INIT, TEST_AGENT_KEY, env);

    expect(res.error?.code).toBe(-32000);
    expect(res.error?.data?.platformCode).toBe('RATE_LIMITED');
    expect(res.error?.data?.resetAtMinute).toBe(new Date(now + 60_000).toISOString());
    expect(res.error?.data?.resetAtDay).toBe(new Date(now + 86_400_000).toISOString());
  });

  it('rate-limits before tool dispatch so the tool handler never runs', async () => {
    const env = await buildTestEnv();
    const rateStore = env.RATE_LIMIT as unknown as MemoryKV;
    const now = Date.now();
    rateStore.data.set(
      `ratelimit:${TEST_AGENT.id}`,
      JSON.stringify({ minuteCount: 30, minuteWindowStart: now, dayCount: 0, dayWindowStart: now }),
    );

    const res = await sendRpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'anchor_search', arguments: { query: 'x' } } }, TEST_AGENT_KEY, env);

    expect(res.error?.code).toBe(-32000);
    expect(res.result).toBeUndefined();
  });

  it('degrades gracefully when KV is unavailable during rate limiting', async () => {
    const throwingKv = {
      get: async () => {
        throw new Error('storage touched');
      },
      put: async () => {
        throw new Error('storage touched');
      },
      delete: async () => {
        throw new Error('storage touched');
      },
    };
    const env = await buildTestEnv();
    env.RATE_LIMIT = throwingKv as unknown as KVNamespace;
    const res = await sendRpc(INIT, TEST_AGENT_KEY, env);
    expect(res.error).toBeUndefined();
    expect(res.result?.protocolVersion).toBe('2025-11-25');
  });
});
