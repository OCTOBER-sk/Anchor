import type { AgentTier } from '../context';

export type PlatformCategory = 'search' | 'memory' | 'cache';

export interface RawMeta {
  provider_used: string;
  platform_category: PlatformCategory;
  [key: string]: unknown;
}

export interface PublicMeta {
  provider_used: string;
  platform_category: PlatformCategory;
  [key: string]: unknown;
}

const GENERIC_LABELS: Record<PlatformCategory, string> = {
  search: 'search-primary',
  memory: 'memory-store',
  cache: 'response-cache',
};

export function canSeeProviderNames(tier: AgentTier): boolean {
  return tier === 'admin' || tier === 'debug';
}

export function filterMetaForTier(meta: RawMeta, tier: AgentTier): PublicMeta {
  if (canSeeProviderNames(tier)) {
    return { ...meta };
  }
  return { ...meta, provider_used: GENERIC_LABELS[meta.platform_category] };
}
