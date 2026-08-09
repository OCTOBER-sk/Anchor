import { describe, it, expect } from 'vitest';
import type { Env } from '../src/context';
import { handleRequest } from '../src/mcp/server';

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: { tools?: Array<{ name: string; description: string; inputSchema: unknown }> };
  error?: { code: number; message: string };
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

describe('tools/list', () => {
  it('returns exactly 5 tools under anchor_* naming', async () => {
    const request = new Request('https://anchor-mcp.test.workers.dev/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    const response = await handleRequest(request, fakeEnv());
    expect(response.status).toBe(200);

    const res = (await response.json()) as RpcResponse;
    expect(res.error).toBeUndefined();

    const tools = res.result?.tools ?? [];
    expect(tools).toHaveLength(5);

    const names = tools.map((tool) => tool.name);
    expect(names.sort()).toEqual(['anchor_dev_search', 'anchor_guide', 'anchor_recall', 'anchor_remember', 'anchor_search']);

    for (const name of names) {
      expect(name).toMatch(/^anchor_/);
    }
  });

  it('exposes a non-empty description and input schema for every tool', async () => {
    const request = new Request('https://anchor-mcp.test.workers.dev/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    const response = await handleRequest(request, fakeEnv());
    const res = (await response.json()) as RpcResponse;

    for (const tool of res.result?.tools ?? []) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(typeof tool.inputSchema).toBe('object');
      expect(tool.inputSchema).not.toBeNull();
    }
  });
});
