import type { ReactNode } from 'react';

import type { ActivityItem } from '../lib/api';
import { formatRelativeTime } from '../lib/time';
import { ActivitySparkline } from './ActivitySparkline';
import { Skeleton } from './Skeleton';

export type CapabilityId = 'search' | 'devSearch' | 'memory';

const iconProps = {
  className: 'h-6 w-6',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const capabilityIcons: Record<CapabilityId, () => ReactNode> = {
  search: () => (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M8 11h6" />
    </svg>
  ),
  devSearch: () => (
    <svg {...iconProps}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  ),
  memory: () => (
    <svg {...iconProps}>
      <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" />
    </svg>
  ),
};

/**
 * One capability's usage card — frontend.md §3.4 CapabilityUsageCard:
 * call count, last-used (relative), and a hand-rolled sparkline of recent
 * activity. Skeleton while the first fetch is in flight.
 */
export function CapabilityUsageCard({
  id,
  name,
  description,
  count,
  lastUsedAt,
  sparklineItems,
  isLoading,
}: {
  id: CapabilityId;
  name: string;
  description: string;
  count: number;
  lastUsedAt: string | null;
  sparklineItems: ActivityItem[];
  isLoading?: boolean;
}) {
  return (
    <article className="card-hoverable flex flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-text-secondary" aria-hidden="true">
            {capabilityIcons[id]()}
          </span>
          <div>
            <h3 className="font-body text-body-md font-semibold text-text-primary">{name}</h3>
            <p className="mt-0.5 text-body-sm text-text-tertiary">{description}</p>
          </div>
        </div>
        <ActivitySparkline items={sparklineItems} />
      </div>

      <div className="flex items-end justify-between border-t border-border-default pt-4">
        <div>
          {isLoading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <p className="font-display font-semibold text-display-md leading-none text-text-primary">{count}</p>
          )}
          <p className="mt-1 text-body-sm text-text-tertiary">calls this month</p>
        </div>
        <p className="text-body-sm text-text-secondary">
          {isLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : lastUsedAt ? (
            <>Last used {formatRelativeTime(lastUsedAt).toLowerCase()}</>
          ) : (
            'Not used yet'
          )}
        </p>
      </div>
    </article>
  );
}
