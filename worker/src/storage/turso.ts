import { createClient, type Client } from '@libsql/client/web';
import type { AgentRecord, AgentTier, Env } from '../context';
import { validateFetchUrl, safeFetch } from '../utils/safe-fetch';
import { captureError } from '../utils/monitoring';
import { getAgentRecord, setAgentRecord } from './kv';

export interface NewAgentRecord {
  keyHash: string;
  ownerId: string;
  name?: string;
  slug?: string;
  tier?: AgentTier;
  rateLimits?: { perMinute: number; perDay: number };
}

export interface RequestLogEntry {
  agentId: string;
  toolName: string;
  status: 'success' | 'error';
  errorCode?: string;
  latencyMs: number;
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

export interface ActivityItem {
  id: string;
  tool: 'anchor_search' | 'anchor_dev_search' | 'anchor_remember' | 'anchor_recall' | 'anchor_guide';
  status: 'success' | 'error';
  errorCode?: string;
  latencyMs: number;
  createdAt: string;
  agentSlug: string;
}

export interface AgentKeyRow {
  id: string;
  name: string;
  slug: string;
  keyPrefix: string;
  tier: AgentTier;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt: string | null;
  rateLimitPerMin: number;
  rateLimitPerDay: number;
}

const AGENT_COLUMNS =
  'id, key_hash, slug, name, owner_id, tier, rate_limit_per_min, rate_limit_per_day, status, created_at, last_used_at';

const TURSO_ALLOWED_SCHEMES = ['https', 'wss', 'libsql'];
const TURSO_ALLOWED_HOSTS = ['*.turso.io'];
const TURSO_TIMEOUT_MS = 15_000;

interface AgentRow {
  id: string;
  key_hash: string;
  slug: string;
  name: string;
  owner_id: string;
  tier: AgentTier;
  rate_limit_per_min: number;
  rate_limit_per_day: number;
  status: 'active' | 'revoked';
  created_at: string;
  last_used_at: string | null;
}

function toUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

export function tursoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  const body = init?.body ?? (input instanceof Request ? input.body : undefined);
  const method = init?.method ?? (input instanceof Request ? input.method : undefined);
  const requestInit: RequestInit = { method, headers, body, ...init };
  return safeFetch(toUrl(input), requestInit, {
    allowedSchemes: TURSO_ALLOWED_SCHEMES,
    allowedHosts: TURSO_ALLOWED_HOSTS,
    timeoutMs: TURSO_TIMEOUT_MS,
  });
}

function makeClient(env: Env): Client {
  if (!validateFetchUrl(env.TURSO_DATABASE_URL, { allowedSchemes: TURSO_ALLOWED_SCHEMES, allowedHosts: TURSO_ALLOWED_HOSTS })) {
    throw new Error('Blocked by SSRF guard: invalid Turso database URL.');
  }
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN, fetch: tursoFetch });
}

function rowToAgentRecord(row: AgentRow): AgentRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name ?? '',
    ownerId: row.owner_id,
    tier: row.tier,
    status: row.status,
    rateLimits: { perMinute: row.rate_limit_per_min, perDay: row.rate_limit_per_day },
  };
}

// §5A.1 slug derivation: lowercase, URL-safe (non-alphanumeric runs become a
// single '-'), leading/trailing and repeated dashes trimmed/collapsed.
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'agent';
}

async function existingSlugs(env: Env): Promise<Set<string>> {
  try {
    const client = makeClient(env);
    const result = await client.execute({ sql: 'select slug from agents' });
    return new Set(result.rows.map((r) => String((r as unknown as { slug: string }).slug)));
  } catch (err) {
    captureError('storage/turso.ts::existingSlugs', err);
    return new Set();
  }
}

// Derives a unique URL-safe slug from a display name, appending -2, -3, ...
// on collision with an existing agent slug.
export async function deriveUniqueSlug(name: string, env: Env): Promise<string> {
  const slugs = await existingSlugs(env);
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (slugs.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

export async function lookupAgent(keyHash: string, env: Env): Promise<AgentRecord | null> {
  const client = makeClient(env);
  const result = await client.execute({
    sql: `select ${AGENT_COLUMNS} from agents where key_hash = ? limit 1`,
    args: [keyHash],
  });
  if (result.rows.length === 0) {
    return null;
  }
  return rowToAgentRecord(result.rows[0] as unknown as AgentRow);
}

export async function createAgent(record: NewAgentRecord, env: Env): Promise<AgentRecord> {
  const client = makeClient(env);
  const slug = record.slug ?? (await deriveUniqueSlug(record.name ?? '', env));
  const agent: AgentRecord = {
    id: crypto.randomUUID(),
    slug,
    name: record.name ?? '',
    ownerId: record.ownerId,
    tier: record.tier ?? 'standard',
    status: 'active',
    rateLimits: record.rateLimits ?? { perMinute: 30, perDay: 500 },
  };
  await client.execute({
    sql: 'insert into agents (id, key_hash, slug, name, owner_id, tier, rate_limit_per_min, rate_limit_per_day, status) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      agent.id,
      record.keyHash,
      agent.slug,
      agent.name,
      agent.ownerId,
      agent.tier,
      agent.rateLimits.perMinute,
      agent.rateLimits.perDay,
      agent.status,
    ],
  });
  await setAgentRecord(record.keyHash, agent, env);
  return agent;
}

// §5A.1 / frontend.md §4.1 PATCH /api/agent-keys/:id — renames the display
// name in Turso and rewrites the KV agent record under the SAME key hash
// (only the name field changes; slug embedded in the key string is fixed).
export async function renameAgent(agentId: string, name: string, env: Env): Promise<AgentRecord | null> {
  const client = makeClient(env);
  const result = await client.execute({
    sql: `select ${AGENT_COLUMNS} from agents where id = ? limit 1`,
    args: [agentId],
  });
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0] as unknown as AgentRow;
  const cached = await getAgentRecord(row.key_hash, env);
  const updated: AgentRecord = { ...(cached ?? rowToAgentRecord(row)), name };
  await client.execute({
    sql: 'update agents set name = ? where id = ?',
    args: [name, agentId],
  });
  await setAgentRecord(row.key_hash, updated, env);
  return updated;
}

export async function getAgentById(agentId: string, env: Env): Promise<AgentRecord | null> {
  const client = makeClient(env);
  const result = await client.execute({
    sql: `select ${AGENT_COLUMNS} from agents where id = ? limit 1`,
    args: [agentId],
  });
  if (result.rows.length === 0) {
    return null;
  }
  return rowToAgentRecord(result.rows[0] as unknown as AgentRow);
}

export async function listAgents(env: Env): Promise<AgentRecord[]> {
  const client = makeClient(env);
  const result = await client.execute({
    sql: `select ${AGENT_COLUMNS} from agents order by created_at desc`,
  });
  return result.rows.map((row) => rowToAgentRecord(row as unknown as AgentRow));
}

export async function revokeAgent(agentId: string, env: Env): Promise<void> {
  const client = makeClient(env);
  const result = await client.execute({
    sql: `select ${AGENT_COLUMNS} from agents where id = ? limit 1`,
    args: [agentId],
  });
  if (result.rows.length === 0) {
    return;
  }
  const row = result.rows[0] as unknown as AgentRow;
  await client.execute({
    sql: "update agents set status = 'revoked' where id = ?",
    args: [agentId],
  });
  const cached = await getAgentRecord(row.key_hash, env);
  if (cached !== null) {
    await setAgentRecord(row.key_hash, { ...cached, status: 'revoked' }, env);
  }
}

export async function listAgentKeys(env: Env): Promise<AgentKeyRow[]> {
  const client = makeClient(env);
  // lastUsedAt is derived at read time from the append-only requests log
  // (frontend.md §4.1) — the agents.last_used_at column is never populated
  // live. Only the name field is edited via PATCH; slug and key_hash are fixed.
  const result = await client.execute({
    sql: `select a.id, a.key_hash, a.slug, a.name, a.tier, a.status, a.created_at,
             (select max(r.created_at) from requests r where r.agent_id = a.id) as last_used_at,
             a.rate_limit_per_min, a.rate_limit_per_day
          from agents a order by a.created_at desc`,
  });
  return result.rows.map((row) => {
    const r = row as unknown as {
      id: string;
      key_hash: string;
      slug: string;
      name: string;
      tier: AgentTier;
      status: 'active' | 'revoked';
      created_at: string;
      last_used_at: string | null;
      rate_limit_per_min: number;
      rate_limit_per_day: number;
    };
    return {
      id: r.id,
      name: r.name ?? '',
      slug: r.slug,
      // keyPrefix masks the raw secret: only the first 8 hex chars of the
      // stored key hash are shown. The raw key is never re-served (frontend.md §4.1).
      keyPrefix: `anchor_${r.slug}_${r.key_hash.slice(0, 8)}…`,
      tier: r.tier,
      status: r.status,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      rateLimitPerMin: r.rate_limit_per_min,
      rateLimitPerDay: r.rate_limit_per_day,
    };
  });
}

// Append-only request log — fire-and-forget from mcp/server.ts. Failures are
// logged via captureError but never thrown, so logging never breaks an MCP call.
export async function logRequest(entry: RequestLogEntry, env: Env): Promise<void> {
  try {
    const client = makeClient(env);
    await client.execute({
      sql: 'insert into requests (id, agent_id, tool_name, status, error_code, latency_ms, created_at) values (?, ?, ?, ?, ?, ?, ?)',
      args: [
        crypto.randomUUID(),
        entry.agentId,
        entry.toolName,
        entry.status,
        entry.errorCode ?? null,
        entry.latencyMs,
        entry.createdAt,
      ],
    });
  } catch (err) {
    captureError('storage/turso.ts::logRequest', err, { toolName: entry.toolName });
  }
}

// Map a tool name to its product capability. anchor_guide is a system tool
// and is excluded from byCapability but still counted in the totals.
function capabilityOf(toolName: string): 'search' | 'devSearch' | 'memory' | null {
  switch (toolName) {
    case 'anchor_search':
      return 'search';
    case 'anchor_dev_search':
      return 'devSearch';
    case 'anchor_remember':
    case 'anchor_recall':
      return 'memory';
    default:
      return null;
  }
}

export async function queryUsageSummary(env: Env): Promise<UsageSummary> {
  const client = makeClient(env);
  const now = new Date();
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayDate = now.toISOString().slice(0, 10);

  const [activeRes, monthRowsArr] = await Promise.all([
    client.execute({ sql: "select count(*) as c from agents where status = 'active'" }),
    client.execute({ sql: 'select tool_name, created_at from requests where created_at >= ?', args: [monthStartIso] }),
  ]);

  const activeKeyCount = Number((activeRes.rows[0] as unknown as { c: number } | undefined)?.c ?? 0);
  const monthRows = monthRowsArr.rows as unknown as Array<{ tool_name: string; created_at: string }>;

  const byCapability: UsageSummary['byCapability'] = {
    search: { count: 0, lastUsedAt: null },
    devSearch: { count: 0, lastUsedAt: null },
    memory: { count: 0, lastUsedAt: null },
  };

  let requestsToday = 0;
  let requestsThisMonth = 0;

  for (const row of monthRows) {
    requestsThisMonth += 1;
    if (row.created_at.slice(0, 10) === todayDate) {
      requestsToday += 1;
    }
    const cap = capabilityOf(row.tool_name);
    if (cap !== null) {
      byCapability[cap].count += 1;
      if (byCapability[cap].lastUsedAt === null || row.created_at > byCapability[cap].lastUsedAt) {
        byCapability[cap].lastUsedAt = row.created_at;
      }
    }
  }

  return { requestsToday, requestsThisMonth, activeKeyCount, byCapability };
}

export async function queryActivity(limit: number, env: Env): Promise<ActivityItem[]> {
  const client = makeClient(env);
  const result = await client.execute({
    sql: `select r.id, r.tool_name, r.status, r.error_code, r.latency_ms, r.created_at, a.slug as agent_slug
          from requests r left join agents a on a.id = r.agent_id
          order by r.created_at desc limit ?`,
    args: [limit],
  });
  return result.rows.map((row) => {
    const r = row as unknown as {
      id: string;
      tool_name: string;
      status: 'success' | 'error';
      error_code: string | null;
      latency_ms: number;
      created_at: string;
      agent_slug: string | null;
    };
    const item: ActivityItem = {
      id: r.id,
      tool: r.tool_name as ActivityItem['tool'],
      status: r.status,
      latencyMs: r.latency_ms,
      createdAt: r.created_at,
      agentSlug: r.agent_slug ?? '',
    };
    if (r.error_code !== null && r.error_code !== undefined && r.error_code !== '') {
      item.errorCode = r.error_code;
    }
    return item;
  });
}
