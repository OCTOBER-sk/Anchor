import { Skeleton } from './Skeleton';

/**
 * One glanceable usage stat — frontend.md §3.4 UsageStatCard. Flat card, no
 * shadow, real numbers only. Skeleton while the first fetch is in flight.
 */
export function UsageStatCard({ label, value, isLoading }: { label: string; value: number; isLoading?: boolean }) {
  return (
    <div className="card p-6">
      <p className="text-body-sm text-text-tertiary">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : (
        <p className="mt-2 font-display font-medium text-display-md leading-none text-text-primary">{value}</p>
      )}
    </div>
  );
}
