import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchUsageSummary } from '../lib/api';
import type { UsageSummary } from '../lib/api';

export interface UseUsageSummaryResult {
  data: UsageSummary | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 60_000;

/**
 * GET /api/usage/summary with a 60s poll while the dashboard is mounted
 * (frontend.md §4.3 useUsageSummary). Polls update silently — `isLoading`
 * only reflects the initial fetch, so re-renders never flash skeletons.
 */
export function useUsageSummary(): UseUsageSummaryResult {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const summary = await fetchUsageSummary();
      setData(summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Could not load usage.'));
    } finally {
      busyRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
