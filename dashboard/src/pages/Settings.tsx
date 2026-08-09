import { useEffect, useRef, useState } from 'react';

import { AgentKeysList } from '../components/AgentKeysList';
import { Skeleton } from '../components/Skeleton';
import { useAgentKeys } from '../hooks/useAgentKeys';
import { useProfile } from '../hooks/useProfile';
import { useSession } from '../hooks/useSession';
import { getSupabase } from '../lib/supabase';

/**
 * Profile section — frontend.md §3.6. Email is read-only (it is the auth
 * identity); phone is profile metadata only (§0.1), stored via the profiles
 * table + RLS.
 */
function ProfileSection() {
  const { session } = useSession();
  const { profile, isLoading, error, refetch, savePhone } = useProfile();
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const initialized = useRef(false);

  const email = session?.user?.email ?? '';

  useEffect(() => {
    if (!initialized.current && profile !== null) {
      setPhone(profile.phone ?? '');
      initialized.current = true;
    }
  }, [profile]);

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await savePhone(phone);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section>
      <h2 className="font-display font-semibold text-display-md text-text-primary">Profile</h2>
      <div className="card mt-4 divide-y divide-border-default">
        <div className="p-6">
          <p className="text-body-sm text-text-tertiary">Email</p>
          <p className="mt-1 text-body-md font-medium text-text-primary">{email}</p>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-body-sm font-medium text-text-primary">
              Phone <span className="font-normal text-text-tertiary">(optional)</span>
            </p>
            {saved ? <p className="shrink-0 text-body-sm text-status-success">Saved</p> : null}
          </div>
          <p className="mt-1 text-body-sm text-text-secondary">Optional — stored with your profile.</p>

          {isLoading && profile === null ? (
            <Skeleton className="mt-3 h-11 sm:max-w-xs" />
          ) : error !== null ? (
            <div className="mt-3">
              <p className="text-body-sm text-status-error">{error.message}</p>
              <button type="button" onClick={() => void refetch()} className="btn-secondary btn-small mt-3">
                Try again
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                id="settings-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setSaved(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleSave();
                }}
                className="input sm:max-w-xs"
                placeholder="+1 555 000 0000"
              />
              <button type="button" onClick={() => void handleSave()} disabled={isSaving} className="btn-secondary sm:shrink-0">
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}

          {saveError ? <p className="mt-2 text-body-sm text-status-error">{saveError}</p> : null}
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
      <h2 className="font-display font-semibold text-display-md text-text-primary">Danger zone</h2>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1880] px-6">
          <div role="dialog" aria-modal="true" aria-labelledby="revoke-all-title" className="card w-full max-w-sm p-6">
            <h3 id="revoke-all-title" className="font-display font-semibold text-display-md text-text-primary">
              Revoke all {activeCount} agent {activeCount === 1 ? 'key' : 'keys'}?
            </h3>
            <p className="mt-2 text-body-sm text-text-secondary">
              Runtimes using them lose access immediately.
            </p>
            {revokeError ? (
              <p className="mt-4 rounded-card border border-status-error bg-[#B91C1C1F] px-4 py-3 text-body-sm text-status-error" role="alert">
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
 * Settings — frontend.md §3.6. A Configure surface: profile (email + phone),
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
