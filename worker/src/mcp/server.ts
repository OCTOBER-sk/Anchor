import type { Env, Context } from '../context';
import { PlatformError, toJsonRpcError, type JsonRpcError } from '../utils/errors';
import { captureError } from '../utils/monitoring';
import { buildToolsList, dispatchToolCall } from './router';

export const PROTOCOL_VERSION = '2025-11-25';

const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;

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

async function handleToolsCall(id: string | number, params: unknown, env: Env): Promise<Response> {
  const args = (params ?? {}) as { name?: unknown; arguments?: unknown };
  if (typeof args.name !== 'string' || args.name.length === 0) {
    return jsonRpcFailure(id, toJsonRpcError('INVALID_PARAMS', 'Missing or invalid tool name.'));
  }

  const ctx: Context = {
    env,
    agentId: 'phase1-stub-agent',
    agentTier: 'standard',
    requestId: crypto.randomUUID(),
  };

  try {
    const result = await dispatchToolCall(args.name, args.arguments ?? {}, ctx);
    return jsonRpcSuccess(id, result);
  } catch (err) {
    if (err instanceof PlatformError) {
      return jsonRpcFailure(id, toJsonRpcError(err.code, err.detail));
    }
    captureError('mcp/server.ts::handleToolsCall', err, { toolName: args.name });
    return jsonRpcFailure(id, toJsonRpcError('INTERNAL_ERROR'));
  }
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
    switch (method) {
      case 'initialize':
        return jsonRpcSuccess(id, await handleInitialize(params));
      case 'tools/list':
        return jsonRpcSuccess(id, { tools: buildToolsList() });
      case 'tools/call':
        return handleToolsCall(id, params, env);
      default:
        return jsonRpcFailure(id, { code: JSONRPC_METHOD_NOT_FOUND, message: 'Method not found' });
    }
  } catch (err) {
    captureError('mcp/server.ts::handleRequest', err, { method });
    return jsonRpcFailure(id, toJsonRpcError('INTERNAL_ERROR'));
  }
}
