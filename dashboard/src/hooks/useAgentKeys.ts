import { useCallback, useEffect, useState } from 'react';

import { createAgentKey, fetchAgentKeys, renameAgentKey, revokeAgentKey } from '../lib/api';
import type { AgentKey, CreatedAgentKey } from '../lib/api';

export interface UseAgentKeysResult {
  data: AgentKey[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  /** POST — resolves with the raw key, which the caller shows exactly once. */
  createKey: (name: string) => Promise<CreatedAgentKey>;
  /** DELETE — optimistic `status: 'revoked'` with rollback on failure. */
  revokeKey: (id: string) => Promise<void>;
  /** PATCH — optimistic rename (display name only, slug is fixed) with rollback on failure. */
  renameKey: (id: string, name: string) => Promise<void>;
}

/**
 * Agent key list + mutations — frontend.md §4.3 (useAgentKeys). No polling:
 * the list is refetched on demand after create/revoke. The raw key is
 * returned to the caller once and is never held in hook state.
 */
export function useAgentKeys(): UseAgentKeysResult {
  const [data, setData] = useState<AgentKey[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      const keys = await fetchAgentKeys();
      setData(keys);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Could not load agent keys.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createKey = useCallback(async (name: string): Promise<CreatedAgentKey> => {
    const created = await createAgentKey(name);
    await refetch();
    return created;
  }, [refetch]);

  const revokeKey = useCallback(
    async (id: string): Promise<void> => {
      const previous = data;
      setData((current) =>
        current === null ? current : current.map((key) => (key.id === id ? { ...key, status: 'revoked' } : key)),
      );
      setError(null);
      try {
        await revokeAgentKey(id);
      } catch (err) {
        // Roll back the optimistic update to the last authoritative snapshot.
        setData(previous);
        throw err;
      }
    },
    [data],
  );

  const renameKey = useCallback(
    async (id: string, name: string): Promise<void> => {
      const previous = data;
      setData((current) =>
        current === null ? current : current.map((key) => (key.id === id ? { ...key, name } : key)),
      );
      setError(null);
      try {
        await renameAgentKey(id, name);
      } catch (err) {
        // Roll back to the last authoritative name (the snapshot holds the
        // pre-edit value) rather than leaving a stale display name in place.
        setData(previous);
        throw err;
      }
    },
    [data],
  );

  return { data, isLoading, error, refetch, createKey, revokeKey, renameKey };
}
