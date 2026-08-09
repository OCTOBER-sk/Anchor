import type { Env } from '../context';

export interface MemoryEntry {
  ownerId: string;
  agentId: string;
  content: string;
  embedding: number[];
  tags: string[];
  sourceTool: 'anchor_remember';
}

export interface MemoryMatch {
  id: string;
  content: string;
  tags: string[];
  similarity: number;
  created_at: string;
}

export interface MatchOpts {
  ownerId: string;
  matchThreshold: number;
  matchCount: number;
}

export interface MatchLiteOpts {
  ownerId: string;
}

const AUTO_RECALL_MATCH_THRESHOLD = 0.72;
const AUTO_RECALL_MATCH_COUNT = 4;

function supabaseRestUrl(env: Env, path: string): string {
  return `${env.SUPABASE_URL}/rest/v1${path}`;
}

function supabaseHeaders(env: Env, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

export async function writeMemory(entry: MemoryEntry, env: Env): Promise<{ id: string }> {
  const response = await fetch(supabaseRestUrl(env, '/memories'), {
    method: 'POST',
    headers: supabaseHeaders(env, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      owner_id: entry.ownerId,
      agent_id: entry.agentId,
      content: entry.content,
      embedding: entry.embedding,
      tags: entry.tags,
      source_tool: entry.sourceTool,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase insert failed with HTTP ${response.status}`);
  }

  const rows = (await response.json()) as Array<{ id?: unknown }>;
  const row = rows[0];
  if (row === undefined || typeof row.id !== 'string') {
    throw new Error('Supabase insert returned no id');
  }
  return { id: row.id };
}

async function callMatchMemories(
  embedding: number[],
  matchThreshold: number,
  matchCount: number,
  ownerId: string,
  env: Env,
): Promise<MemoryMatch[]> {
  const response = await fetch(supabaseRestUrl(env, '/rpc/match_memories'), {
    method: 'POST',
    headers: supabaseHeaders(env),
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_owner_id: ownerId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase match_memories failed with HTTP ${response.status}`);
  }

  const rows = (await response.json()) as Array<{
    id: unknown;
    content: unknown;
    tags?: unknown;
    similarity: unknown;
    created_at: unknown;
  }>;

  return rows.map((row) => ({
    id: String(row.id),
    content: String(row.content),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    similarity: Number(row.similarity),
    created_at: String(row.created_at),
  }));
}

export async function matchMemories(embedding: number[], opts: MatchOpts, env: Env): Promise<MemoryMatch[]> {
  return callMatchMemories(embedding, opts.matchThreshold, opts.matchCount, opts.ownerId, env);
}

export async function matchMemoriesLite(embedding: number[], opts: MatchLiteOpts, env: Env): Promise<MemoryMatch[]> {
  return callMatchMemories(embedding, AUTO_RECALL_MATCH_THRESHOLD, AUTO_RECALL_MATCH_COUNT, opts.ownerId, env);
}

export async function pingKeepalive(env: Env): Promise<void> {
  const response = await fetch(supabaseRestUrl(env, '/memories?select=id&limit=1'), {
    method: 'GET',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase keepalive ping failed with HTTP ${response.status}`);
  }
}
