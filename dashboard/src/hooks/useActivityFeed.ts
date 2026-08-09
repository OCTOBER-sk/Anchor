import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchActivity } from '../lib/api';
import type { ActivityItem } from '../lib/api';

export interface UseActivityFeedResult {
  data: ActivityItem[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 30_000;
const DEFAULT_LIMIT = 20;

/**
 * GET /api/usage/activity?limit=20 with a 30s poll while the dashboard is
 * mounted (frontend.md §4.3 useActivityFeed). Polls update silently —
 * `isLoading` only reflects the initial fetch.
 */
export function useActivityFeed(): UseActivityFeedResult {
  const [data, setData] = useState<ActivityItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const items = await fetchActivity(DEFAULT_LIMIT);
      setData(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Could not load activity.'));
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
