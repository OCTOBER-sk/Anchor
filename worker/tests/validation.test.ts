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
  result?: { content?: Array<{ type: string; text: string }> };
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

async function callTool(name: string, args: unknown): Promise<RpcResponse> {
  const request = new Request('https://anchor-mcp.test.workers.dev/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const response = await handleRequest(request, fakeEnv());
  expect(response.status).toBe(200);
  return (await response.json()) as RpcResponse;
}

describe('tools/call argument validation', () => {
  it('rejects anchor_search max_results above 20 with INVALID_PARAMS (-32602)', async () => {
    const res = await callTool('anchor_search', { query: 'cloudflare workers cpu limits', max_results: 21 });
    expect(res.result).toBeUndefined();
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.data?.platformCode).toBe('INVALID_PARAMS');
  });

  it('rejects anchor_recall match_threshold above 1 with INVALID_PARAMS (-32602)', async () => {
    const res = await callTool('anchor_recall', { query: 'deployment notes', match_threshold: 1.5 });
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.data?.platformCode).toBe('INVALID_PARAMS');
  });

  it('rejects anchor_recall match_count above 50 with INVALID_PARAMS (-32602)', async () => {
    const res = await callTool('anchor_recall', { query: 'deployment notes', match_count: 51 });
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.data?.platformCode).toBe('INVALID_PARAMS');
  });

  it('rejects anchor_remember content above 10000 chars with INVALID_PARAMS (-32602)', async () => {
    const res = await callTool('anchor_remember', { content: 'x'.repeat(10001) });
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.data?.platformCode).toBe('INVALID_PARAMS');
  });

  it('rejects an unknown tool name with INVALID_PARAMS (-32602)', async () => {
    const res = await callTool('anchor_does_not_exist', {});
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.data?.platformCode).toBe('INVALID_PARAMS');
  });

  it('accepts valid arguments and returns a clearly-marked stub result', async () => {
    const res = await callTool('anchor_search', { query: 'cloudflare workers cpu limits' });
    expect(res.error).toBeUndefined();
    expect(res.result?.content?.[0]?.text).toContain('anchor_search');
    expect(res.result?.content?.[0]?.text).toContain('"stub": true');
  });

  it('applies schema defaults for omitted optional fields', async () => {
    const res = await callTool('anchor_recall', { query: 'deployment notes' });
    expect(res.error).toBeUndefined();
    expect(res.result?.content?.[0]?.text).toContain('anchor_recall');
  });
});
