export type AgentTier = 'standard' | 'admin' | 'debug';

export interface AgentRecord {
  id: string;
  slug: string;
  ownerId: string;
  tier: AgentTier;
  status: 'active' | 'revoked';
  rateLimits: { perMinute: number; perDay: number };
}

export interface Env {
  AGENT_KEYS: KVNamespace;
  RATE_LIMIT: KVNamespace;
  RESPONSE_CACHE: KVNamespace;
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CEREBRAS_API_KEY: string;
  GEMINI_API_KEY: string;
  TAVILY_API_KEY: string;
  TAVILY_RESERVE_CREDITS?: string;
  APIFY_API_TOKEN: string;
  ALLOWED_ORIGINS?: string;
}

export interface Context {
  env: Env;
  agentId: string;
  agentTier: AgentTier;
  requestId: string;
}

export function buildContext(req: Request, env: Env, agent: AgentRecord): Context {
  return {
    env,
    agentId: agent.id,
    agentTier: agent.tier,
    requestId: req.headers.get('cf-request-id') ?? crypto.randomUUID(),
  };
}
