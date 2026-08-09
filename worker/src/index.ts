import type { Env } from './context';
import { MAX_JSON_BODY_BYTES } from './utils/errors';
import { ping } from './utils/keepalive';
import { handleRequest } from './mcp/server';

const MAX_AGE = 86400;

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  if (origin !== null && allowedOrigins(env).includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': String(MAX_AGE),
      Vary: 'Origin',
    };
  }
  return {};
}

function withCors(response: Response, cors: Record<string, string>): Response {
  if (Object.keys(cors).length === 0) {
    return response;
  }
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(cors)) {
    headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function bodyTooLarge(cors: Record<string, string>): Response {
  return Response.json(
    { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request: body too large' } },
    { status: 413, headers: cors },
  );
}

function guideResponse(cors: Record<string, string>): Response {
  const guide = [
    '# Anchor MCP',
    '',
    'Remote MCP server (JSON-RPC 2.0 over Streamable HTTP, protocol 2025-11-25).',
    'Three capabilities behind one agent key and one endpoint:',
    '  - Search (with automatic recall injection of related memories)',
    '  - Dev Search (package-registry-aware developer search)',
    '  - Memory (persistent vector memory shared across agent runtimes)',
    '',
    'For tool-level usage documentation, call the anchor_guide tool.',
    '',
  ].join('\n');
  return new Response(guide, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...cors } });
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(env, origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/mcp') {
      const declaredLength = Number(request.headers.get('Content-Length') ?? '0');
      if (declaredLength > MAX_JSON_BODY_BYTES) {
        return bodyTooLarge(cors);
      }
      const body = await request.arrayBuffer();
      if (body.byteLength > MAX_JSON_BODY_BYTES) {
        return bodyTooLarge(cors);
      }
      const guardedRequest = new Request(request, { body });
      const response = await handleRequest(guardedRequest, env);
      return withCors(response, cors);
    }

    if (request.method === 'GET' && url.pathname === '/guide') {
      return guideResponse(cors);
    }

    return new Response('Not found', { status: 404, headers: cors });
  },

  async scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await ping(env);
  },
} satisfies ExportedHandler<Env>;
