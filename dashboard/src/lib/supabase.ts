import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client for the dashboard.
 *
 * ANON KEY ONLY — the `service_role` key (backend.md §7) is marked "never
 * expose to any client-facing surface" and must never appear in client code.
 * If you are about to paste a `service_role` key here: stop. It is for the
 * worker only and is not available in the browser bundle.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase environment variables are not set. Copy .env.example to .env and ' +
      'fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (anon key only).',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
