/**
 * Pill-shaped status badge — frontend.md §2.4: body-sm, colored text on a
 * 12%-opacity tint of the same status color. Active = success green;
 * revoked = neutral tertiary gray.
 */
export function StatusBadge({ status }: { status: 'active' | 'revoked' }) {
  const tone =
    status === 'active'
      ? 'bg-status-success/12 text-status-success'
      : 'bg-text-tertiary/12 text-text-tertiary';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-body-sm font-medium ${tone}`}>
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {status === 'active' ? 'Active' : 'Revoked'}
    </span>
  );
}

/** Tier pill — mono, quiet. Part of the agent-key vocabulary, not a label. */
export function TierBadge({ tier }: { tier: 'standard' | 'admin' | 'debug' }) {
  return (
    <span className="rounded-control border border-border-default bg-bg-sunken px-2 py-0.5 font-mono text-mono-sm text-text-secondary">
      {tier}
    </span>
  );
}
