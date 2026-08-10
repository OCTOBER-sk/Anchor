import { useActivityFeed } from '../hooks/useActivityFeed';
import type { ActivityItem, ActivityTool } from '../lib/api';
import { formatRelativeTime } from '../lib/time';
import { EmptyState } from './EmptyState';
import { ErrorCard } from './ErrorCard';
import { Skeleton } from './Skeleton';

/** Capability name shown for each activity tool — §2.5: "capability" never "tool". */
const TOOL_LABELS: Record<ActivityTool, string> = {
  anchor_search: 'Search',
  anchor_dev_search: 'Dev Search',
  anchor_remember: 'Memory',
  anchor_recall: 'Memory',
  anchor_guide: 'Guide',
};

function ActivityIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function StatusPill({ status }: { status: ActivityItem['status'] }) {
  const tone =
    status === 'success'
      ? 'bg-status-success/12 text-status-success'
      : 'bg-status-error/12 text-status-error';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-body-sm font-medium ${tone}`}>
      {status === 'success' ? 'Success' : 'Failed'}
    </span>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-md font-medium text-text-primary">{TOOL_LABELS[item.tool]}</span>
          <StatusPill status={item.status} />
        </div>
        <p className="mt-1 text-body-sm text-text-tertiary">
          <span className="font-mono text-mono-sm">{item.agentSlug || '—'}</span>
          {item.errorCode ? <> · {item.errorCode}</> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-body-sm text-text-tertiary">
        <span className="font-mono text-mono-sm">{item.latencyMs}ms</span>
        <span>{formatRelativeTime(item.createdAt)}</span>
      </div>
    </div>
  );
}

/**
 * Activity feed — frontend.md §3.4 / §4.1. Reverse-chronological request log
 * (tool, status, latency, relative time, agent slug). Empty state points new
 * users at connecting a runtime.
 */
export function ActivityFeed() {
  const { data, isLoading, error, refetch } = useActivityFeed();

  const showEmpty = !isLoading && error === null && data !== null && data.length === 0;

  return (
    <section>
      <h2 className="font-display font-semibold text-display-md text-text-primary">Activity</h2>

      <div className="mt-4">
        {error ? (
          <ErrorCard message={error.message} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="card divide-y divide-border-default">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <EmptyState
            icon={<ActivityIcon />}
            title="No activity yet"
            description="Connect a runtime to get started."
          />
        ) : data !== null ? (
          <div className="card divide-y divide-border-default">
            {data.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
