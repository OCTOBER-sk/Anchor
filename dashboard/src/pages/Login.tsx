import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { ConfigMissingState } from '../components/ConfigMissingState';
import { useSession } from '../hooks/useSession';
import { getSupabase } from '../lib/supabase';

type Status = 'idle' | 'sent' | 'error';

export function Login() {
  const { session, loading: sessionLoading, error: sessionError } = useSession();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (sessionError) {
    return <ConfigMissingState />;
  }

  if (!sessionLoading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setStatus('idle');
    setErrorMessage(null);

    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setSubmitting(false);
      setErrorMessage(null);
      setStatus('error');
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({ email });

    setSubmitting(false);

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }

    setStatus('sent');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="card p-8">
          <div className="text-center mb-8">
            <Link to="/" className="font-display font-medium text-display-md text-text-primary">
              Anchor
            </Link>
            <p className="mt-2 text-body-sm text-text-secondary">The memory layer for your AI agents</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="login-email" className="block text-body-sm text-text-secondary">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="input"
            />

            <button type="submit" disabled={submitting || email.trim().length === 0} className="btn-primary w-full">
              {submitting ? 'Sending…' : 'Send magic link'}
            </button>
          </form>

          {status === 'sent' && (
            <p className="mt-4 text-body-sm text-status-success">Check your email for the sign-in link.</p>
          )}

          {status === 'error' && errorMessage && (
            <p className="mt-4 text-body-sm text-status-error">{errorMessage}</p>
          )}
        </div>

        <p className="mt-6 text-body-sm text-text-tertiary text-center">
          Need the worker endpoint? See the{' '}
          <Link to="/docs/quickstart" className="text-accent hover:text-accent-hover">
            quickstart
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
