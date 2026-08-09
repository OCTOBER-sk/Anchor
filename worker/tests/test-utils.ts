import type { AgentRecord, Env } from '../src/context';
import { hashAgentKey } from '../src/auth/verify';

export const TEST_AGENT_KEY = 'anchor_testagent_0123456789abcdef0123456789abcdef';

export const TEST_AGENT: AgentRecord = {
  id: 'test-agent-id',
  slug: 'testagent',
  ownerId: 'anchor-owner',
  tier: 'standard',
  status: 'active',
  rateLimits: { perMinute: 30, perDay: 500 },
};

export interface MemoryKV {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  delete: (key: string) => Promise<void>;
  data: Map<string, string>;
  puts: Array<{ key: string; value: string }>;
  deletes: string[];
}

export function createMemoryKV(): MemoryKV {
  const data = new Map<string, string>();
  const kv: MemoryKV = {
    data,
    puts: [],
    deletes: [],
    async get(key) {
      return data.has(key) ? (data.get(key) ?? null) : null;
    },
    async put(key, value) {
      data.set(key, value);
      kv.puts.push({ key, value });
    },
    async delete(key) {
      data.delete(key);
      kv.deletes.push(key);
    },
  };
  return kv;
}

export async function buildTestEnv(overrides: Partial<Env> = {}): Promise<Env> {
  const agentKv = createMemoryKV();
  const keyHash = await hashAgentKey(TEST_AGENT_KEY);
  await agentKv.put(keyHash, JSON.stringify(TEST_AGENT));

  const env: Env = {
    AGENT_KEYS: agentKv as unknown as KVNamespace,
    RATE_LIMIT: createMemoryKV() as unknown as KVNamespace,
    RESPONSE_CACHE: createMemoryKV() as unknown as KVNamespace,
    TURSO_DATABASE_URL: 'libsql://test.turso.io',
    TURSO_AUTH_TOKEN: 'test-token',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test',
    CEREBRAS_API_KEY: 'csk-test',
    GEMINI_API_KEY: 'AIza-test',
    TAVILY_API_KEY: 'tvly-test',
    APIFY_API_TOKEN: 'apify_api_test',
    ALLOWED_ORIGINS: 'https://claude.ai',
    ...overrides,
  };
  return env;
}
