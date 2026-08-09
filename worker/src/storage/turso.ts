import { createClient, type Client } from '@libsql/client/web';
import type { AgentRecord, AgentTier, Env } from '../context';
import { getAgentRecord, setAgentRecord } from './kv';

export interface NewAgentRecord {
  keyHash: string;
  slug: string;
  ownerId: string;
  tier?: AgentTier;
  rateLimits?: { perMinute: number; perDay: number };
}

const AGENT_COLUMNS =
  'id, key_hash, slug, owner_id, tier, rate_limit_per_min, rate_limit_per_day, status, created_at, last_used_at';

interface AgentRow {
  id: string;
  key_hash: string;
  slug: string;
  owner_id: string;
  tier: AgentTier;
  rate_limit_per_min: number;
  rate_limit_per_day: number;
  status: 'active' | 'revoked';
  created_at: string;
  last_used_at: string | null;
}

function makeClient(env: Env): Client {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

function rowToAgentRecord(row: AgentRow): AgentRecord {
  return {
    id: row.id,
    slug: row.slug,
    ownerId: row.owner_id,
    tier: row.tier,
    status: row.status,
    rateLimits: { perMinute: row.rate_limit_per_min, perDay: row.rate_limit_per_day },
  };
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
  const agent: AgentRecord = {
    id: crypto.randomUUID(),
    slug: record.slug,
    ownerId: record.ownerId,
    tier: record.tier ?? 'standard',
    status: 'active',
    rateLimits: record.rateLimits ?? { perMinute: 30, perDay: 500 },
  };
  await client.execute({
    sql: 'insert into agents (id, key_hash, slug, owner_id, tier, rate_limit_per_min, rate_limit_per_day, status) values (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      agent.id,
      record.keyHash,
      agent.slug,
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
