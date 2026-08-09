import type { AgentRecord, Context, Env } from '../context';
import { buildContext } from '../context';
import { PlatformError, toJsonRpcError, type JsonRpcError } from '../utils/errors';
import { captureError } from '../utils/monitoring';
import { isValidKeyFormat } from '../auth/keys';
import { verifyAgentKey } from '../auth/verify';
import { checkAndIncrement } from '../auth/ratelimit';
import { buildToolsList, dispatchToolCall } from './router';
import { logRequest } from '../storage/turso';

export const PROTOCOL_VERSION = '2025-11-25';

const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const AUTH_ERROR_CODE = -32001;

const AUTH_FAILURE_MESSAGE = 'Authentication failed.';

export interface InitializeResult {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo: { name: string; version: string };
}

interface Envelope {
  id: string | number;
  method: string;
  params: unknown;
}

function parseEnvelope(body: unknown): Envelope | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  const obj = body as Record<string, unknown>;
  if (obj.jsonrpc !== '2.0') {
    return null;
  }
  if (typeof obj.method !== 'string' || obj.method.length === 0) {
    return null;
  }
  if (typeof obj.id !== 'string' && typeof obj.id !== 'number') {
    return null;
  }
  return { id: obj.id, method: obj.method, params: obj.params };
}

function jsonRpcSuccess(id: string | number, result: unknown): Response {
  return Response.json({ jsonrpc: '2.0', id, result });
}

function jsonRpcFailure(id: string | number | null, error: JsonRpcError): Response {
  return Response.json({ jsonrpc: '2.0', id, error });
}

export async function handleInitialize(_params: unknown): Promise<InitializeResult> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: { name: 'anchor-mcp', version: '1.0.0' },
  };
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (header === null) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

async function authenticate(request: Request, env: Env): Promise<AgentRecord | null> {
  const key = extractBearerToken(request);
  if (key === null || !isValidKeyFormat(key)) {
    return null;
  }
  let agent: AgentRecord | null;
  try {
    agent = await verifyAgentKey(key, env);
  } catch (err) {
    captureError('mcp/server.ts::authenticate', err, { stage: 'verify' });
    return null;
  }
  if (agent === null || agent.status !== 'active') {
    return null;
  }
  return agent;
}

function authFailure(id: string | number | null): Response {
  return jsonRpcFailure(id, { code: AUTH_ERROR_CODE, message: AUTH_FAILURE_MESSAGE });
}

async function handleToolsCall(id: string | number, params: unknown, ctx: Context): Promise<Response> {
  const args = (params ?? {}) as { name?: unknown; arguments?: unknown };
  if (typeof args.name !== 'string' || args.name.length === 0) {
    return jsonRpcFailure(id, toJsonRpcError('INVALID_PARAMS', 'Missing or invalid tool name.'));
  }

  const toolName = args.name;
  const startedAt = Date.now();
  let status: 'success' | 'error';
  let errorCode: string | undefined;
  let finalResponse: Response;

  try {
    const result = await dispatchToolCall(toolName, args.arguments ?? {}, ctx);
    status = 'success';
    finalResponse = jsonRpcSuccess(id, result);
  } catch (err) {
    status = 'error';
    if (err instanceof PlatformError) {
      errorCode = err.code;
      finalResponse = jsonRpcFailure(id, toJsonRpcError(err.code, err.detail));
    } else {
      captureError('mcp/server.ts::handleToolsCall', err, { toolName });
      errorCode = 'INTERNAL_ERROR';
      finalResponse = jsonRpcFailure(id, toJsonRpcError('INTERNAL_ERROR'));
    }
  }

  // Append to the request log. Fire-and-forget — logging must never break the
  // MCP call, so the promise is intentionally not awaited.
  void logRequest(
    {
      agentId: ctx.agentId,
      toolName,
      status,
      errorCode,
      latencyMs: Date.now() - startedAt,
      createdAt: new Date().toISOString(),
    },
    ctx.env,
  );

  return finalResponse;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonRpcFailure(null, { code: JSONRPC_INVALID_REQUEST, message: 'Invalid Request' });
  }

  const envelope = parseEnvelope(body);
  if (!envelope) {
    return jsonRpcFailure(null, { code: JSONRPC_INVALID_REQUEST, message: 'Invalid Request' });
  }

  const { id, method, params } = envelope;

  try {
    const agent = await authenticate(request, env);
    if (agent === null) {
      return authFailure(id);
    }

    const ctx = buildContext(request, env, agent);

    const rateResult = await checkAndIncrement(agent.id, agent.rateLimits, env);
    if (!rateResult.allowed) {
      const base = toJsonRpcError('RATE_LIMITED');
      return jsonRpcFailure(id, {
        ...base,
        data: { ...(base.data as Record<string, unknown>), resetAtMinute: rateResult.resetAtMinute, resetAtDay: rateResult.resetAtDay },
      });
    }

    switch (method) {
      case 'initialize':
        return jsonRpcSuccess(id, await handleInitialize(params));
      case 'tools/list':
        return jsonRpcSuccess(id, { tools: buildToolsList() });
      case 'tools/call':
        return handleToolsCall(id, params, ctx);
      default:
        return jsonRpcFailure(id, { code: JSONRPC_METHOD_NOT_FOUND, message: 'Method not found' });
    }
  } catch (err) {
    captureError('mcp/server.ts::handleRequest', err, { method });
    return jsonRpcFailure(id, toJsonRpcError('INTERNAL_ERROR'));
  }
}
