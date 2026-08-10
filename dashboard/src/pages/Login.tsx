import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { ConfigMissingState } from '../components/ConfigMissingState';
import { useSession } from '../hooks/useSession';
import { getSupabase } from '../lib/supabase';

type Mode = 'signin' | 'signup';

export function Login() {
  const { session, loading: sessionLoading, error: sessionError } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (sessionError) {
    return <ConfigMissingState />;
  }

  if (!sessionLoading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  function switchMode(next: Mode) {
    setMode(next);
    setErrorMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setSubmitting(false);
      return;
    }

    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { phone: phone.trim() },
            },
          });

    setSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="card p-8">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center">
              <img src="/logo.svg" alt="Anchor" className="h-7 w-auto" />
            </Link>
            <p className="mt-2 text-body-sm text-text-secondary">The memory layer for your AI agents</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
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
            </div>

            <div>
              <label htmlFor="login-password" className="block text-body-sm text-text-secondary">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </div>

            {isSignup && (
              <div>
                <label htmlFor="login-phone" className="block text-body-sm text-text-secondary">
                  Phone <span className="text-text-tertiary">(optional)</span>
                </label>
                <input
                  id="login-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+91 98765 43210"
                  className="input"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || email.trim().length === 0 || password.length === 0}
              className="btn-primary w-full"
            >
              {submitting ? 'Submitting…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {errorMessage && <p className="mt-4 text-body-sm text-status-error">{errorMessage}</p>}

          <p className="mt-6 text-center text-body-sm text-text-tertiary">
            {isSignup ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-accent hover:text-accent-hover"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New to Anchor?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-accent hover:text-accent-hover"
                >
                  Create an account
                </button>
              </>
            )}
          </p>
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
