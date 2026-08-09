import { useCallback, useEffect, useState } from 'react';

import { getSupabase } from '../lib/supabase';

/**
 * Profile (phone) read/write — frontend.md §4.2 / §4.3 (useProfile).
 *
 * The phone number lives in a `profiles` table (id = the Supabase auth user
 * id, phone text) and is written via PostgREST with the anon key + RLS
 * policy `id = auth.uid()`. It is metadata only — never used for SMS or
 * anything functional in v1 (§0.1).
 *
 * Error messages are sanitized: the dashboard environment is gated upstream
 * (DashboardShell renders the clean config-missing state when unconfigured),
 * so failures here are runtime ones and never surface raw Supabase detail.
 */
export interface Profile {
  id: string;
  phone: string | null;
}

export interface UseProfileResult {
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  savePhone: (phone: string) => Promise<void>;
}

const GENERIC_PROFILE_ERROR = 'Could not load your profile.';

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData.user;
      if (!user) {
        setProfile(null);
        return;
      }
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      setProfile({ id: user.id, phone: data?.phone ?? null });
      setError(null);
    } catch {
      setError(new Error(GENERIC_PROFILE_ERROR));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const savePhone = useCallback(
    async (phone: string) => {
      const supabase = getSupabase();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData.user;
      if (!user) throw new Error('Not signed in.');

      const { error: upsertError } = await supabase.from('profiles').upsert({ id: user.id, phone: phone.trim() });
      if (upsertError) throw new Error('Could not save your profile. Please try again.');

      await refetch();
    },
    [refetch],
  );

  return { profile, isLoading, error, refetch, savePhone };
}
