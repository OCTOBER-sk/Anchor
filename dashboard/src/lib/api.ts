import { getSupabase } from './supabase';

/**
 * Typed dashboard REST wrapper — frontend.md §4.1.
 *
 * Every request attaches the Supabase session JWT as a Bearer token (never
 * an agent key — the dashboard manages keys, so it can't be gated by one).
 * `GET /api/health` is the only unauthenticated endpoint.
 *
 * Non-2xx responses are parsed from the `{error:{code,message}}` shape and
 * mapped to typed ApiErrors. Internal details are never surfaced: all
 * user-facing messages are sanitized here and on the backend.
 */

export type ApiErrorCode = 'UNAUTHORIZED' | 'VALIDATION_FAILED' | 'AGENT_KEY_NOT_FOUND' | 'INTERNAL_ERROR';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface ApiErrorBody {
  error?: { code?: ApiErrorCode; message?: unknown };
}

/* The deployed Worker's root. Empty string = same-origin `/api/*` (the
 * default Pages + Functions deployment). Overridable via VITE_API_URL. */
const API_BASE = import.meta.env.VITE_API_URL ?? '';

const REQUEST_TIMEOUT_MS = 10_000;

const GENERIC_NETWORK_MESSAGE = "We couldn't reach Anchor right now. Please try again in a moment.";
const GENERIC_TIMEOUT_MESSAGE = 'This request took too long. Please try again.';
const GENERIC_SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';
const GENERIC_UNAUTHORIZED_MESSAGE = 'Your session has expired. Please sign in again.';

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    // Environment not configured — the shell gates on this and shows the
    // config-missing state, so no request should reach here without a token.
    return null;
  }
}

function sanitizeMessage(message: unknown): string {
  return typeof message === 'string' && message.length > 0 ? message : GENERIC_SERVER_MESSAGE;
}

function toApiError(status: number, body: unknown): ApiError {
  const parsed = body as ApiErrorBody | null;
  const code = parsed?.error?.code;
  if (code === 'UNAUTHORIZED' || code === 'VALIDATION_FAILED' || code === 'AGENT_KEY_NOT_FOUND' || code === 'INTERNAL_ERROR') {
    return new ApiError(code, sanitizeMessage(parsed?.error?.message), status);
  }
  if (status === 401) {
    return new ApiError('UNAUTHORIZED', GENERIC_UNAUTHORIZED_MESSAGE, status);
  }
  return new ApiError('INTERNAL_ERROR', GENERIC_SERVER_MESSAGE, status);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {};
  const token = await getAccessToken();
  if (token !== null) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw toApiError(response.status, payload);
    }

    return payload as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('INTERNAL_ERROR', GENERIC_TIMEOUT_MESSAGE, 0);
    }
    throw new ApiError('INTERNAL_ERROR', GENERIC_NETWORK_MESSAGE, 0);
  } finally {
    window.clearTimeout(timeout);
  }
}

/* ------------------------------------------------------------------ */
/* Types — mirrors frontend.md §4.1 and worker/src/storage/turso.ts     */
/* ------------------------------------------------------------------ */

export type AgentTier = 'standard' | 'admin' | 'debug';
export type AgentKeyStatus = 'active' | 'revoked';

export interface AgentKey {
  id: string;
  name: string;
  slug: string;
  keyPrefix: string;
  tier: AgentTier;
  status: AgentKeyStatus;
  createdAt: string;
  lastUsedAt: string | null;
  rateLimitPerMin: number;
  rateLimitPerDay: number;
}

/** POST /api/agent-keys response — includes the raw key, returned once. */
export interface CreatedAgentKey {
  id: string;
  key: string;
  name: string;
  slug: string;
  tier: AgentTier;
  createdAt: string;
}

export interface CapabilityUsage {
  count: number;
  lastUsedAt: string | null;
}

export interface UsageSummary {
  requestsToday: number;
  requestsThisMonth: number;
  activeKeyCount: number;
  byCapability: {
    search: CapabilityUsage;
    devSearch: CapabilityUsage;
    memory: CapabilityUsage;
  };
}

export type ActivityTool =
  | 'anchor_search'
  | 'anchor_dev_search'
  | 'anchor_remember'
  | 'anchor_recall'
  | 'anchor_guide';

export interface ActivityItem {
  id: string;
  tool: ActivityTool;
  status: 'success' | 'error';
  errorCode?: string;
  latencyMs: number;
  createdAt: string;
  agentSlug: string;
}

export type OnboardingValidation =
  | { valid: true; toolCount: number }
  | { valid: false; reason: string };

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export async function createAgentKey(name: string): Promise<CreatedAgentKey> {
  return request('/agent-keys', { method: 'POST', body: { name } });
}

export async function fetchAgentKeys(): Promise<AgentKey[]> {
  const data = await request<{ keys: AgentKey[] }>('/agent-keys');
  return data.keys;
}

export async function revokeAgentKey(id: string): Promise<void> {
  await request(`/agent-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchUsageSummary(): Promise<UsageSummary> {
  return request('/usage/summary');
}

export async function fetchActivity(limit = 20): Promise<ActivityItem[]> {
  const data = await request<{ items: ActivityItem[] }>(`/usage/activity?limit=${limit}`);
  return data.items;
}

export async function validateOnboarding(keyId: string): Promise<OnboardingValidation> {
  return request('/onboarding/validate', { method: 'POST', body: { keyId } });
}
