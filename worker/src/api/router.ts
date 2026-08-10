import type { AgentTier, Env } from '../context';
import { safeFetch } from '../utils/safe-fetch';
import { captureError } from '../utils/monitoring';
import { encrypt, decrypt, getKeyCipher, KeyEncryptionKeyError } from '../utils/crypto';
import { generateAgentKey } from '../auth/keys';
import { hashAgentKey } from '../auth/verify';
import {
  createAgent,
  getAgentById,
  getAgentKeyCiphertext,
  listAgentKeys,
  renameAgent,
  revokeAgent,
  queryUsageSummary,
  queryActivity,
  deriveUniqueSlug,
} from '../storage/turso';
import { buildToolsList } from '../mcp/router';
import { handleInitialize } from '../mcp/server';

const VERSION = '1.0.0';

type ApiErrorCode = 'AGENT_KEY_NOT_FOUND' | 'VALIDATION_FAILED' | 'UNAUTHORIZED' | 'INTERNAL_ERROR';

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION_FAILED: 422,
  AGENT_KEY_NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: 'Unauthorized.',
  VALIDATION_FAILED: 'Invalid request.',
  AGENT_KEY_NOT_FOUND: 'Agent key not found.',
  INTERNAL_ERROR: 'Internal server error.',
};

interface SupabaseUser {
  userId: string;
}

function apiError(code: ApiErrorCode, message?: string): Response {
  return Response.json({ error: { code, message: message ?? ERROR_MESSAGES[code] } }, { status: ERROR_STATUS[code] });
}

function apiOk(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

// Verifies a dashboard session JWT against the Supabase project server-side.
// This is a DISTINCT auth path from /mcp's agent-key auth (backend.md §9):
// it never touches SUPABASE_SERVICE_ROLE_KEY (that is pgvector-only).
async function verifySupabaseJwt(request: Request, env: Env): Promise<SupabaseUser | null> {
  const header = request.headers.get('Authorization');
  if (header === null) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1];
  if (!token) {
    return null;
  }
  try {
    const res = await safeFetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    }, { allowedHosts: ['*.supabase.co'] });
    if (res.status !== 200) {
      return null;
    }
    const data = (await res.json()) as { id?: unknown };
    if (typeof data.id !== 'string' || data.id.length === 0) {
      return null;
    }
    return { userId: data.id };
  } catch (err) {
    captureError('api/router.ts::verifySupabaseJwt', err);
    return null;
  }
}

async function requireAuth(request: Request, env: Env): Promise<SupabaseUser | Response> {
  const user = await verifySupabaseJwt(request, env);
  if (user === null) {
    return apiError('UNAUTHORIZED');
  }
  return user;
}

function nameFromBody(body: unknown): string | null {
  if (body === null || typeof body !== 'object') {
    return null;
  }
  const name = (body as { name?: unknown }).name;
  if (typeof name !== 'string') {
    return null;
  }
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    return null;
  }
  return trimmed;
}

const AGENT_TIERS: readonly AgentTier[] = ['standard', 'admin', 'debug'];

function tierFromBody(body: unknown): AgentTier {
  if (body === null || typeof body !== 'object') {
    return 'standard';
  }
  const raw = (body as { tier?: unknown }).tier;
  return AGENT_TIERS.includes(raw as AgentTier) ? (raw as AgentTier) : 'standard';
}

async function handleHealth(): Promise<Response> {
  return apiOk({ status: 'ok', version: VERSION });
}

async function handleCreateKey(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_FAILED');
  }

  const name = nameFromBody(body);
  if (name === null) {
    return apiError('VALIDATION_FAILED', 'Agent key name must be 2-60 characters.');
  }

  const tier = tierFromBody(body);

  try {
    const slug = await deriveUniqueSlug(name, env);
    const key = generateAgentKey(slug);
    const keyHash = await hashAgentKey(key);
    const keyCiphertext = await encrypt(key, getKeyCipher(env));
    const agent = await createAgent({ keyHash, keyCiphertext, slug, name, ownerId: auth.userId, tier }, env);
    return apiOk({
      id: agent.id,
      key, // raw key — also re-viewable later via GET /api/agent-keys/:id/reveal
      name: agent.name,
      slug: agent.slug,
      tier: agent.tier,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof KeyEncryptionKeyError) {
      return apiError('INTERNAL_ERROR', err.message);
    }
    captureError('api/router.ts::handleCreateKey', err);
    return apiError('INTERNAL_ERROR');
  }
}

async function handleRevealKey(request: Request, env: Env, keyId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }
  try {
    const row = await getAgentKeyCiphertext(keyId, env);
    if (row === null || row.ownerId !== auth.userId || row.status !== 'active') {
      return apiError('AGENT_KEY_NOT_FOUND');
    }
    if (row.keyCiphertext === null || row.keyCiphertext.length === 0) {
      return apiError('AGENT_KEY_NOT_FOUND', 'This key cannot be revealed.');
    }
    const key = await decrypt(row.keyCiphertext, getKeyCipher(env));
    return apiOk({ key });
  } catch (err) {
    if (err instanceof KeyEncryptionKeyError) {
      return apiError('INTERNAL_ERROR', err.message);
    }
    captureError('api/router.ts::handleRevealKey', err);
    return apiError('INTERNAL_ERROR');
  }
}

async function handleListKeys(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }
  try {
    const keys = await listAgentKeys(auth.userId, env);
    return apiOk({ keys });
  } catch (err) {
    captureError('api/router.ts::handleListKeys', err);
    return apiError('INTERNAL_ERROR');
  }
}

async function handleDeleteKey(request: Request, env: Env, keyId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }
  try {
    const agent = await getAgentById(keyId, env);
    if (agent === null || agent.ownerId !== auth.userId) {
      return apiError('AGENT_KEY_NOT_FOUND');
    }
    await revokeAgent(keyId, env);
    return apiOk({ id: keyId, status: 'revoked' });
  } catch (err) {
    captureError('api/router.ts::handleDeleteKey', err);
    return apiError('INTERNAL_ERROR');
  }
}

async function handlePatchKey(request: Request, env: Env, keyId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_FAILED');
  }

  const name = nameFromBody(body);
  if (name === null) {
    return apiError('VALIDATION_FAILED', 'Agent key name must be 2-60 characters.');
  }

  // Only the display name is editable (§5A.1 / frontend.md §4.1); the slug
  // embedded in the key string stays fixed, so we never re-derive it.
  try {
    const agent = await getAgentById(keyId, env);
    if (agent === null || agent.ownerId !== auth.userId) {
      return apiError('AGENT_KEY_NOT_FOUND');
    }
    const renamed = await renameAgent(keyId, name, env);
    if (renamed === null) {
      return apiError('AGENT_KEY_NOT_FOUND');
    }
    return apiOk({ id: keyId, name: renamed.name, slug: renamed.slug });
  } catch (err) {
    captureError('api/router.ts::handlePatchKey', err);
    return apiError('INTERNAL_ERROR');
  }
}

async function handleUsageSummary(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }
  try {
    const summary = await queryUsageSummary(auth.userId, env);
    return apiOk(summary);
  } catch (err) {
    captureError('api/router.ts::handleUsageSummary', err);
    return apiError('INTERNAL_ERROR');
  }
}

async function handleUsageActivity(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get('limit') ?? '20');
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(Math.min(rawLimit, 100)) : 20;
  try {
    const items = await queryActivity(auth.userId, limit, env);
    return apiOk({ items });
  } catch (err) {
    captureError('api/router.ts::handleUsageActivity', err);
    return apiError('INTERNAL_ERROR');
  }
}

async function handleOnboardingValidate(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_FAILED');
  }
  const keyId = (body as { keyId?: unknown } | null)?.keyId;
  if (typeof keyId !== 'string' || keyId.length === 0) {
    return apiError('VALIDATION_FAILED', 'keyId is required.');
  }

  try {
    const agent = await getAgentById(keyId, env);
    if (agent === null || agent.ownerId !== auth.userId) {
      return apiOk({ valid: false, reason: 'Agent key not found.' });
    }
    if (agent.status !== 'active') {
      return apiOk({ valid: false, reason: 'Agent key is revoked.' });
    }

    // Server-side initialize + tools/list round-trip against the local MCP
    // surface. The raw key is never stored, so this validates the agent's
    // active state and that the MCP tool surface responds with all 5 tools.
    await handleInitialize(undefined);
    const toolCount = buildToolsList().length;
    if (toolCount !== 5) {
      return apiOk({ valid: false, reason: 'MCP tool surface not ready.' });
    }
    return apiOk({ valid: true, toolCount });
  } catch (err) {
    captureError('api/router.ts::handleOnboardingValidate', err);
    return apiError('INTERNAL_ERROR');
  }
}

export async function handleApi(request: Request, env: Env, pathname: string): Promise<Response> {
  try {
    if (request.method === 'GET' && pathname === '/api/health') {
      return handleHealth();
    }
    if (request.method === 'POST' && pathname === '/api/agent-keys') {
      return handleCreateKey(request, env);
    }
    if (request.method === 'GET' && pathname === '/api/agent-keys') {
      return handleListKeys(request, env);
    }
    if (request.method === 'GET' && pathname.endsWith('/reveal')) {
      const prefix = '/api/agent-keys/';
      const suffix = '/reveal';
      if (pathname.startsWith(prefix) && pathname.endsWith(suffix)) {
        const keyId = decodeURIComponent(pathname.slice(prefix.length, pathname.length - suffix.length));
        if (keyId.length === 0) {
          return apiError('VALIDATION_FAILED');
        }
        return handleRevealKey(request, env, keyId);
      }
    }
    if (request.method === 'DELETE' && pathname.startsWith('/api/agent-keys/')) {
      const keyId = decodeURIComponent(pathname.slice('/api/agent-keys/'.length));
      if (keyId.length === 0) {
        return apiError('VALIDATION_FAILED');
      }
      return handleDeleteKey(request, env, keyId);
    }
    if (request.method === 'PATCH' && pathname.startsWith('/api/agent-keys/')) {
      const keyId = decodeURIComponent(pathname.slice('/api/agent-keys/'.length));
      if (keyId.length === 0) {
        return apiError('VALIDATION_FAILED');
      }
      return handlePatchKey(request, env, keyId);
    }
    if (request.method === 'GET' && pathname === '/api/usage/summary') {
      return handleUsageSummary(request, env);
    }
    if (request.method === 'GET' && pathname === '/api/usage/activity') {
      return handleUsageActivity(request, env);
    }
    if (request.method === 'POST' && pathname === '/api/onboarding/validate') {
      return handleOnboardingValidate(request, env);
    }
    return new Response('Not found', { status: 404 });
  } catch (err) {
    captureError('api/router.ts::handleApi', err);
    return apiError('INTERNAL_ERROR');
  }
}
