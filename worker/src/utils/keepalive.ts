import type { Env } from '../context';
import { pingKeepalive } from '../storage/supabase';
import { captureError } from '../utils/monitoring';

export async function ping(env: Env): Promise<void> {
  try {
    await pingKeepalive(env);
  } catch (err) {
    captureError('utils/keepalive.ts::ping', err);
  }
}
