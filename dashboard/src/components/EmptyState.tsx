import type { ReactNode } from 'react';

/**
 * Empty state — frontend.md §4.4: icon + one-line copy + primary action.
 * Used for zero agent keys, zero activity, and any other no-data surface.
 * Always renders as a real empty state, never a construction notice (§2.5).
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-border-strong px-6 py-12 text-center">
      {icon ? (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-card border border-border-default bg-bg-sunken text-text-secondary" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-body-md font-medium text-text-primary">{title}</p>
        {description ? <p className="text-body-sm text-text-secondary">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
