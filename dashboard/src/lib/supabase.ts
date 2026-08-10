import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy Supabase client for the dashboard — frontend.md §4.2.
 *
 * ANON KEY ONLY — the `service_role` key is marked "never expose to any
 * client-facing surface" and must never appear in client code.
 *
 * The client is created lazily so that pages which never touch auth (the
 * landing, the docs) keep working even when the dashboard environment is not
 * configured. Config is only enforced the moment auth is actually used.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Dashboard environment is not configured. Copy .env.example to .env and ' +
        'set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (anon key only).',
    );
  }

  client = createClient(url, anonKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
  });
  return client;
}
