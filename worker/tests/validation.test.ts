import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Env } from '../src/context';
import { handleRequest } from '../src/mcp/server';
import { buildTestEnv, TEST_AGENT_KEY, mockSearchResult } from './test-utils';

vi.mock('../src/search/dev-router', () => ({
  runSearchPipeline: vi.fn(),
}));

import { runSearchPipeline } from '../src/search/dev-router';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

async function callTool(name: string, args: unknown): Promise<RpcResponse> {
  const env: Env = await buildTestEnv();
  const request = new Request('https://anchor-mcp.test.workers.dev/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_AGENT_KEY}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const response = await handleRequest(request, env);
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

  it('accepts valid arguments and returns the §8 anchor_search output shape via the real handler', async () => {
    vi.mocked(runSearchPipeline).mockResolvedValue(mockSearchResult());

    const res = await callTool('anchor_search', { query: 'cloudflare workers cpu limits' });

    expect(res.error).toBeUndefined();
    const text = res.result?.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text) as {
      results: unknown[];
      summary: string;
      related_memories: unknown[];
      _meta: Record<string, unknown>;
    };
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(typeof parsed.summary).toBe('string');
    expect(parsed.related_memories).toEqual([]);
    expect(parsed._meta).toMatchObject({ platform_category: 'search', provider_used: 'search-primary' });
  });

  it('applies schema defaults for omitted optional fields', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes(':embedContent')) {
        return new Response(JSON.stringify({ embedding: { values: new Array(768).fill(0.1) } }), { status: 200 });
      }
      if (url.includes('/rpc/match_memories')) {
        return new Response(
          JSON.stringify([
            { id: 'mem-1', content: 'deployment notes', tags: [], similarity: 0.9, created_at: '2026-08-01T00:00:00Z' },
          ]),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await callTool('anchor_recall', { query: 'deployment notes' });

    expect(res.error).toBeUndefined();
    const text = res.result?.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text) as { matches: unknown[]; _meta: Record<string, unknown> };
    expect(parsed.matches).toHaveLength(1);
    expect(parsed._meta).toMatchObject({ platform_category: 'memory' });

    const rpcCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/rpc/match_memories'));
    expect(rpcCall).toBeDefined();
    const body = JSON.parse(String(rpcCall?.[1]?.body)) as { match_threshold: number; match_count: number };
    expect(body.match_threshold).toBe(0.75);
    expect(body.match_count).toBe(10);
  });
});
