import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { getSupabase } from '../lib/supabase';

export interface UseSessionResult {
  session: Session | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Wraps supabase.auth.getSession() + onAuthStateChange (frontend.md §4.2).
 * `loading` is true until the initial session resolution completes — the
 * DashboardShell gates on this so it never flashes a redirect before Supabase
 * has answered.
 *
 * The client is obtained lazily inside the effect, so an unconfigured
 * environment surfaces as a clean `error` state rather than a module-load
 * crash. Consumers render the config-missing state on `error`.
 */
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    let supabase: SupabaseClient;

    try {
      supabase = getSupabase();
    } catch (err) {
      if (!mounted) return;
      setError(err instanceof Error ? err : new Error('Configuration error'));
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading, error };
}
