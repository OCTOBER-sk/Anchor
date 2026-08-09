import type { AgentRecord, Env } from '../context';
import { captureError } from '../utils/monitoring';
import { getAgentRecord, setAgentRecord } from '../storage/kv';
import { lookupAgent } from '../storage/turso';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashAgentKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyAgentKey(key: string, env: Env): Promise<AgentRecord | null> {
  const keyHash = await hashAgentKey(key);

  const cached = await getAgentRecord(keyHash, env);
  if (cached !== null) {
    return cached;
  }

  let record: AgentRecord | null;
  try {
    record = await lookupAgent(keyHash, env);
  } catch (err) {
    captureError('auth/verify.ts::verifyAgentKey', err, { stage: 'turso-fallback', agentHash: keyHash });
    return null;
  }
  if (record === null) {
    return null;
  }

  await setAgentRecord(keyHash, record, env);
  return record;
}
