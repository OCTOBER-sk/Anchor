import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAgentKeys } from '../hooks/useAgentKeys';
import type { AgentKey } from '../lib/api';
import { formatRelativeTime, formatShortDate } from '../lib/time';
import { CreateKeyModal } from './CreateKeyModal';
import { EmptyState } from './EmptyState';
import { ErrorCard } from './ErrorCard';
import { Skeleton } from './Skeleton';
import { StatusBadge, TierBadge } from './StatusBadge';

function KeyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11l9-9" />
      <path d="M17 5l3 3" />
      <path d="M14 8l2 2" />
    </svg>
  );
}

function AgentKeyRow({
  agentKey,
  onRevoke,
}: {
  agentKey: AgentKey;
  onRevoke: (key: AgentKey) => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-body-md font-medium text-text-primary">{agentKey.name}</span>
          <StatusBadge status={agentKey.status} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <code className="font-mono text-mono-sm text-text-tertiary">{agentKey.keyPrefix}</code>
          <TierBadge tier={agentKey.tier} />
          <span className="text-body-sm text-text-tertiary">
            {agentKey.lastUsedAt ? `Last used ${formatRelativeTime(agentKey.lastUsedAt).toLowerCase()}` : 'Never used'}
          </span>
          <span className="text-body-sm text-text-tertiary">Created {formatShortDate(agentKey.createdAt)}</span>
        </div>
      </div>
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => onRevoke(agentKey)}
          disabled={agentKey.status !== 'active'}
          className="btn-secondary btn-small disabled:cursor-not-allowed disabled:opacity-40"
        >
          Revoke
        </button>
      </div>
    </div>
  );
}

function RevokeConfirmModal({
  agentKey,
  isRevoking,
  errorMessage,
  onCancel,
  onConfirm,
}: {
  agentKey: AgentKey | null;
  isRevoking: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (agentKey === null) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1880] px-6">
      <div role="dialog" aria-modal="true" aria-labelledby="revoke-key-title" className="card w-full max-w-sm p-6">
        <h2 id="revoke-key-title" className="font-display font-semibold text-display-md text-text-primary">
          Revoke “{agentKey.name}”?
        </h2>
        <p className="mt-2 text-body-sm text-text-secondary">
          Runtimes using this key will lose access immediately.
        </p>
        {errorMessage ? (
          <p className="mt-4 rounded-card border border-status-error bg-[#B91C1C1F] px-4 py-3 text-body-sm text-status-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={isRevoking} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isRevoking}
            className="inline-flex items-center justify-center gap-2 rounded-control bg-status-error px-5 py-3 font-body text-body-md font-medium text-bg-base transition-colors hover:bg-status-error disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRevoking ? 'Revoking…' : 'Revoke'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Agent key list — frontend.md §3.4 / §5A.3. Rows with name, masked prefix,
 * tier + status badges, relative last-used and created date, revoke action.
 * Empty state drives new users into onboarding.
 */
export function AgentKeysList() {
  const { data, isLoading, error, refetch, createKey, revokeKey } = useAgentKeys();
  const [modalOpen, setModalOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AgentKey | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  async function handleRevoke() {
    if (revokeTarget === null) return;
    setIsRevoking(true);
    setRevokeError(null);
    try {
      await revokeKey(revokeTarget.id);
      setRevokeTarget(null);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Could not revoke the agent key. Please try again.');
    } finally {
      setIsRevoking(false);
    }
  }

  const showEmpty = !isLoading && error === null && data !== null && data.length === 0;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-display-md text-text-primary">Agent keys</h2>
        <button type="button" onClick={() => setModalOpen(true)} className="btn-primary btn-small">
          New agent key
        </button>
      </div>

      <div className="mt-4">
        {error ? (
          <ErrorCard message={error.message} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="card divide-y divide-border-default">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 px-6 py-5">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <EmptyState
            icon={<KeyIcon />}
            title="No agent keys yet"
            description="Create a key to connect a runtime."
            action={
              <Link to="/dashboard/onboarding" className="btn-primary btn-small">
                Connect a runtime
              </Link>
            }
          />
        ) : data !== null ? (
          <div className="card divide-y divide-border-default">
            {data.map((agentKey) => (
              <AgentKeyRow key={agentKey.id} agentKey={agentKey} onRevoke={setRevokeTarget} />
            ))}
          </div>
        ) : null}
      </div>

      <CreateKeyModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={createKey} />
      <RevokeConfirmModal
        agentKey={revokeTarget}
        isRevoking={isRevoking}
        errorMessage={revokeError}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => void handleRevoke()}
      />
    </section>
  );
}
