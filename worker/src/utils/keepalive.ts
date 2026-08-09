import type { Env } from '../context';

export async function ping(env: Env): Promise<void> {
  console.log('keepalive ping (stub — Phase 6)');
}
