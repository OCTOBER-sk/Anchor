import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { ConfigMissingState } from '../components/ConfigMissingState';
import { getSupabase } from '../lib/supabase';

type CallbackState =
  | { phase: 'exchanging' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; firstLogin: boolean };

/**
 * Magic-link redirect handler (frontend.md §3.3): exchanges the `code` query
 * param for a session via supabase.auth.exchangeCodeForSession, then routes
 * to onboarding on first login or the dashboard on returning visits.
 *
 * First-login detection choice: a `onboarding_completed` flag in the user's
 * `user_metadata`, set when the onboarding flow's FinishButton is reached
 * (F6). Chosen over profiles-row existence because the profiles table is
 * still being shaped by F4/F7; a metadata flag is owned entirely by the
 * auth flow and needs no DB read on the callback path.
 */
export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<CallbackState>({ phase: 'exchanging' });
  const [configMissing, setConfigMissing] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');

    if (!code && !tokenHash) {
      setState({ phase: 'error', message: 'No sign-in code was present in the callback URL.' });
      return;
    }

    let cancelled = false;

    async function exchange() {
      let supabase;
      try {
        supabase = getSupabase();
      } catch {
        if (cancelled) return;
        setConfigMissing(true);
        return;
      }

      const { data, error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash as string });

      if (cancelled) return;

      if (error) {
        setState({ phase: 'error', message: error.message });
        return;
      }

      const onboardingCompleted =
        data.user?.user_metadata?.onboarding_completed === true;
      setState({ phase: 'done', firstLogin: !onboardingCompleted });
    }

    void exchange();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (state.phase !== 'done') return;
    const timer = window.setTimeout(() => {
      void navigate(state.firstLogin ? '/dashboard/onboarding' : '/dashboard', { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state, navigate]);

  if (configMissing) {
    return <ConfigMissingState />;
  }

  if (state.phase === 'error') {
    return <Navigate to="/login" replace />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div
          role="status"
          aria-label="Signing you in"
          className="h-8 w-8 rounded-full border-2 border-border-accent border-t-accent animate-spin"
        />
        <p className="text-body-sm text-text-secondary">Signing you in…</p>
      </div>
    </main>
  );
}
