import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

export interface UseSessionResult {
  session: Session | null;
  loading: boolean;
}

/**
 * Wraps supabase.auth.getSession() + onAuthStateChange (frontend.md §4.2).
 * `loading` is true until the initial session resolution completes — the
 * DashboardShell gates on this so it never flashes a redirect before Supabase
 * has answered.
 */
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

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

  return { session, loading };
}
