import { describe, it, expect } from 'vitest';
import type { Env } from '../src/context';
import { handleRequest } from '../src/mcp/server';
import { buildTestEnv, TEST_AGENT_KEY } from './test-utils';

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: { tools?: Array<{ name: string; description: string; inputSchema: unknown }> };
  error?: { code: number; message: string };
}

describe('tools/list', () => {
  it('returns exactly 5 tools under anchor_* naming', async () => {
    const env: Env = await buildTestEnv();
    const request = new Request('https://anchor-mcp.test.workers.dev/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_AGENT_KEY}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    const response = await handleRequest(request, env);
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
    const env: Env = await buildTestEnv();
    const request = new Request('https://anchor-mcp.test.workers.dev/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_AGENT_KEY}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    const response = await handleRequest(request, env);
    const res = (await response.json()) as RpcResponse;

    for (const tool of res.result?.tools ?? []) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(typeof tool.inputSchema).toBe('object');
      expect(tool.inputSchema).not.toBeNull();
    }
  });
});
