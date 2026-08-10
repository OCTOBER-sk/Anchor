import { useState } from 'react';

import { AgentKeysList } from '../components/AgentKeysList';
import { useAgentKeys } from '../hooks/useAgentKeys';
import { useSession } from '../hooks/useSession';
import { getSupabase } from '../lib/supabase';

/**
 * Profile section — frontend.md §3.6. Email is read-only (it is the auth
 * identity); phone comes from the signup `user_metadata` and is also
 * read-only.
 */
function ProfileSection() {
  const { session } = useSession();
  const email = session?.user?.email ?? '—';
  const phone = session?.user?.user_metadata?.phone ?? '—';

  return (
    <section>
      <h2 className="font-display font-medium text-display-md text-text-primary">Profile</h2>
      <div className="card mt-4 divide-y divide-border-default">
        <div className="p-6">
          <p className="text-body-sm text-text-tertiary">Email</p>
          <p className="mt-1 text-body-md font-medium text-text-primary">{email}</p>
        </div>
        <div className="p-6">
          <p className="text-body-sm text-text-tertiary">Phone</p>
          <p className="mt-1 text-body-md font-medium text-text-primary">{phone}</p>
        </div>
      </div>
    </section>
  );
}

/**
 * Danger zone — frontend.md §3.6. Revoke-all is confirm-gated; the sign-out
 * button lives here too.
 */
function DangerZone() {
  const { data, refetch, revokeKey } = useAgentKeys();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const activeKeys = (data ?? []).filter((key) => key.status === 'active');
  const activeCount = activeKeys.length;

  async function handleRevokeAll() {
    if (isRevoking) return;
    setIsRevoking(true);
    setRevokeError(null);
    try {
      for (const key of activeKeys) {
        await revokeKey(key.id);
      }
      await refetch();
      setConfirmOpen(false);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Could not revoke the agent keys. Please try again.');
    } finally {
      setIsRevoking(false);
    }
  }

  async function handleSignOut() {
    try {
      await getSupabase().auth.signOut();
    } catch {
      // Configuration failure surfaces upstream as the clean config-missing
      // state; there is nothing left to sign out of here.
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display font-medium text-display-md text-text-primary">Danger zone</h2>
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-body-md font-medium text-text-primary">Revoke all agent keys</p>
          <p className="mt-1 text-body-sm text-text-secondary">Runtimes using these keys will lose access immediately.</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={activeCount === 0}
          className="btn-secondary btn-small shrink-0"
        >
          Revoke all
        </button>
      </div>

      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-body-md font-medium text-text-primary">Sign out</p>
          <p className="mt-1 text-body-sm text-text-secondary">
            Your keys and usage stay available next time you sign in.
          </p>
        </div>
        <button type="button" onClick={() => void handleSignOut()} className="btn-secondary btn-small shrink-0">
          Sign out
        </button>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 px-6">
          <div role="dialog" aria-modal="true" aria-labelledby="revoke-all-title" className="card w-full max-w-sm p-6">
            <h3 id="revoke-all-title" className="font-display font-medium text-display-md text-text-primary">
              Revoke all {activeCount} agent {activeCount === 1 ? 'key' : 'keys'}?
            </h3>
            <p className="mt-2 text-body-sm text-text-secondary">
              Runtimes using them lose access immediately.
            </p>
            {revokeError ? (
              <p className="mt-4 rounded-card border border-status-error bg-status-error/12 px-4 py-3 text-body-sm text-status-error" role="alert">
                {revokeError}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={isRevoking} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRevokeAll()}
                disabled={isRevoking}
                className="inline-flex items-center justify-center gap-2 rounded-control bg-status-error px-5 py-3 font-body text-body-md font-medium text-bg-base transition-colors hover:bg-status-error disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRevoking ? 'Revoking…' : 'Revoke all'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Settings — frontend.md §3.6. A Configure surface: profile (read-only email),
 * agent keys (the shared list + create modal), and a confirm-gated danger
 * zone with sign out.
 */
export function Settings() {
  return (
    <div className="space-y-12">
      <ProfileSection />
      <AgentKeysList />
      <DangerZone />
    </div>
  );
}
