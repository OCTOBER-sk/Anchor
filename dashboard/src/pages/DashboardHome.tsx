import { useActivityFeed } from '../hooks/useActivityFeed';
import { useUsageSummary } from '../hooks/useUsageSummary';
import type { UseUsageSummaryResult } from '../hooks/useUsageSummary';
import type { UseActivityFeedResult } from '../hooks/useActivityFeed';
import type { ActivityTool } from '../lib/api';
import { ActivityFeed } from '../components/ActivityFeed';
import { AgentKeysList } from '../components/AgentKeysList';
import { CapabilityUsageCard, type CapabilityId } from '../components/CapabilityUsageCard';
import { ErrorCard } from '../components/ErrorCard';
import { UsageStatCard } from '../components/UsageStatCard';

const CAPABILITIES: Array<{
  id: CapabilityId;
  name: string;
  description: string;
  tools: ActivityTool[];
}> = [
  {
    id: 'search',
    name: 'Search',
    description: 'Web search with summaries',
    tools: ['anchor_search'],
  },
  {
    id: 'devSearch',
    name: 'Dev Search',
    description: 'Package-aware answers',
    tools: ['anchor_dev_search'],
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent recall',
    tools: ['anchor_remember', 'anchor_recall'],
  },
];

/**
 * Usage summary row — frontend.md §3.4: three glanceable stats from the
 * real API, skeletons while the first fetch is in flight.
 */
function UsageSummaryRow({ usage }: { usage: UseUsageSummaryResult }) {
  if (usage.error) {
    return <ErrorCard message={usage.error.message} onRetry={() => void usage.refetch()} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <UsageStatCard label="Requests today" value={usage.data?.requestsToday ?? 0} isLoading={usage.isLoading} />
      <UsageStatCard label="Requests this month" value={usage.data?.requestsThisMonth ?? 0} isLoading={usage.isLoading} />
      <UsageStatCard label="Active agent keys" value={usage.data?.activeKeyCount ?? 0} isLoading={usage.isLoading} />
    </div>
  );
}

/**
 * Capability usage grid — frontend.md §3.4: one differentiated card per
 * capability (call count, last used, sparkline from recent activity).
 */
function CapabilityUsageGrid({
  usage,
  activity,
}: {
  usage: UseUsageSummaryResult;
  activity: UseActivityFeedResult;
}) {
  if (usage.error) {
    return <ErrorCard message={usage.error.message} onRetry={() => void usage.refetch()} />;
  }

  const loading = usage.isLoading || activity.isLoading;

  return (
    <section>
      <h2 className="font-display font-semibold text-display-md text-text-primary">Capabilities</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {CAPABILITIES.map((capability) => {
          const byCapability = usage.data?.byCapability[capability.id] ?? { count: 0, lastUsedAt: null };
          const sparklineItems = (activity.data ?? []).filter((item) => capability.tools.includes(item.tool));
          return (
            <CapabilityUsageCard
              key={capability.id}
              id={capability.id}
              name={capability.name}
              description={capability.description}
              count={byCapability.count}
              lastUsedAt={byCapability.lastUsedAt}
              sparklineItems={sparklineItems}
              isLoading={loading}
            />
          );
        })}
      </div>
    </section>
  );
}

/**
 * Dashboard home — frontend.md §3.4. A Monitor surface: glanceable usage
 * hierarchy, no hero, no marketing framing. Every number comes from the real
 * API; loading/error/empty states per §4.4 are handled per-section. Usage
 * and activity are each fetched once and shared across sections.
 */
export function DashboardHome() {
  const usage = useUsageSummary();
  const activity = useActivityFeed();

  return (
    <div className="space-y-12">
      <UsageSummaryRow usage={usage} />
      <CapabilityUsageGrid usage={usage} activity={activity} />
      <AgentKeysList />
      <ActivityFeed />
    </div>
  );
}
