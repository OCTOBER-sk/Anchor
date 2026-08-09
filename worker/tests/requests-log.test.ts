import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../src/context';
import { handleRequest } from '../src/mcp/server';
import { buildTestEnv, TEST_AGENT_KEY } from './test-utils';

vi.mock('../src/storage/turso', () => ({
  lookupAgent: vi.fn(),
  createAgent: vi.fn(),
  listAgents: vi.fn(),
  revokeAgent: vi.fn(),
  logRequest: vi.fn(),
}));

import * as turso from '../src/storage/turso';

const logRequestMock = vi.mocked(turso.logRequest);

interface RpcError {
  code: number;
  message: string;
  data?: { platformCode?: string; [key: string]: unknown };
}

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: Record<string, unknown>;
  error?: RpcError;
}

beforeEach(() => {
  logRequestMock.mockReset();
  logRequestMock.mockResolvedValue(undefined);
});

function callTool(name: string, args: unknown): Promise<RpcResponse> {
  return (async () => {
    const env: Env = await buildTestEnv();
    const request = new Request('https://anchor-mcp.test.workers.dev/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_AGENT_KEY}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    const response = await handleRequest(request, env);
    expect(response.status).toBe(200);
    return (await response.json()) as RpcResponse;
  })();
}

describe('requests logging on tools/call', () => {
  it('logs a success row after a successful tool call without breaking the response', async () => {
    const res = await callTool('anchor_guide', {});

    expect(res.error).toBeUndefined();
    expect(logRequestMock).toHaveBeenCalledTimes(1);
    const entry = logRequestMock.mock.calls[0]![0];
    expect(entry).toMatchObject({
      agentId: 'test-agent-id',
      toolName: 'anchor_guide',
      status: 'success',
      errorCode: undefined,
    });
    expect(typeof entry.latencyMs).toBe('number');
    expect(typeof entry.createdAt).toBe('string');
  });

  it('logs an error row with the platform error code after a failed tool call', async () => {
    const res = await callTool('anchor_does_not_exist', {});

    expect(res.error?.code).toBe(-32602);
    expect(res.error?.data?.platformCode).toBe('INVALID_PARAMS');
    expect(logRequestMock).toHaveBeenCalledTimes(1);
    const entry = logRequestMock.mock.calls[0]![0];
    expect(entry).toMatchObject({
      agentId: 'test-agent-id',
      toolName: 'anchor_does_not_exist',
      status: 'error',
      errorCode: 'INVALID_PARAMS',
    });
  });

  it('still returns the MCP result even when logging fails', async () => {
    logRequestMock.mockRejectedValue(new Error('log db unavailable'));

    const res = await callTool('anchor_guide', {});

    expect(res.error).toBeUndefined();
  });
});
