import { describe, it, expect } from 'vitest';
import type { Env } from '../src/context';
import { handleRequest } from '../src/mcp/server';

interface RpcError {
  code: number;
  message: string;
  data?: { platformCode?: string; [key: string]: unknown };
}

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: RpcError;
}

function fakeEnv(): Env {
  return {
    AGENT_KEYS: null as unknown as KVNamespace,
    RATE_LIMIT: null as unknown as KVNamespace,
    RESPONSE_CACHE: null as unknown as KVNamespace,
    TURSO_DATABASE_URL: 'libsql://test.turso.io',
    TURSO_AUTH_TOKEN: 'test',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test',
    CEREBRAS_API_KEY: 'csk-test',
    GEMINI_API_KEY: 'AIza-test',
    TAVILY_API_KEY: 'tvly-test',
    APIFY_API_TOKEN: 'apify_api_test',
    ALLOWED_ORIGINS: 'https://claude.ai',
  };
}

async function rpc(body: unknown): Promise<RpcResponse> {
  const request = new Request('https://anchor-mcp.test.workers.dev/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const response = await handleRequest(request, fakeEnv());
  expect(response.status).toBe(200);
  return (await response.json()) as RpcResponse;
}

describe('initialize', () => {
  it('round-trips and asserts protocol version 2025-11-25', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0' },
      },
    });

    expect(res.error).toBeUndefined();
    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    expect(res.result).toMatchObject({
      protocolVersion: '2025-11-25',
      capabilities: { tools: {} },
      serverInfo: { name: 'anchor-mcp', version: '1.0.0' },
    });
  });

  it('rejects a malformed envelope with -32600 Invalid Request', async () => {
    const res = await rpc({ id: 7, method: 'initialize' });
    expect(res.error?.code).toBe(-32600);
    expect(res.error?.message).toBe('Invalid Request');
  });

  it('rejects an unknown method with -32601 Method not found', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/unknown' });
    expect(res.error?.code).toBe(-32601);
    expect(res.error?.message).toBe('Method not found');
    expect(res.id).toBe(3);
  });
});
