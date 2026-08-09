import type { Context } from '../context';
import { filterMetaForTier, type PublicMeta } from '../auth/permissions';
import { runSearchPipeline } from '../search/dev-router';
import { queryRegistry, type Ecosystem, type RegistryResult } from '../search/registries';
import { biasByProjectContext, parseProjectManifest } from '../search/project-context';
import { reorderByDomainPriority } from '../search/domain-priority';

const DEFAULT_MAX_RESULTS = 10;

export interface DevSearchInput {
  query: string;
  ecosystem?: 'npm' | 'pypi' | 'cargo' | 'go' | 'other';
  project_manifest?: string;
  max_results?: number;
}

export interface RegistryMatch {
  name: string;
  version: string;
  ecosystem: Ecosystem;
}

export interface DevSearchResultItem {
  url: string;
  title: string;
  snippet: string;
  registryMatch?: RegistryMatch;
}

export interface DevSearchToolResult {
  results: DevSearchResultItem[];
  summary: string;
  _meta: PublicMeta;
}

function looksLikePackageName(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    return false;
  }
  if (/\s/.test(trimmed)) {
    return false;
  }
  if (/^[\d._-]+$/.test(trimmed)) {
    return false;
  }
  return /^[A-Za-z0-9@._/-]+$/.test(trimmed);
}

function resolveEcosystem(explicit: DevSearchInput['ecosystem'], packageLike: boolean): Ecosystem | null {
  if (explicit === 'npm' || explicit === 'pypi' || explicit === 'cargo' || explicit === 'go') {
    return explicit;
  }
  if (explicit === 'other') {
    return null;
  }
  return packageLike ? 'npm' : null;
}

function registryToResultItem(registry: RegistryResult): DevSearchResultItem {
  return {
    url: registry.url,
    title: registry.title,
    snippet: registry.snippet,
    registryMatch: { name: registry.name, version: registry.version, ecosystem: registry.ecosystem },
  };
}

function dedupeByUrl(items: DevSearchResultItem[]): DevSearchResultItem[] {
  const seen = new Set<string>();
  const out: DevSearchResultItem[] = [];
  for (const item of items) {
    const key = item.url.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function handleDevSearch(input: DevSearchInput, ctx: Context): Promise<DevSearchToolResult> {
  const maxResults = input.max_results ?? DEFAULT_MAX_RESULTS;
  const manifest = input.project_manifest !== undefined ? parseProjectManifest(input.project_manifest) : null;
  const packageLike = looksLikePackageName(input.query);
  const ecosystem = resolveEcosystem(input.ecosystem, packageLike);

  const pipelinePromise = runSearchPipeline(input.query, { maxResults }, ctx);
  const registryPromise = packageLike && ecosystem !== null ? queryRegistry(input.query, ecosystem) : Promise.resolve(null);

  const [searchResult, registry] = await Promise.all([pipelinePromise, registryPromise]);

  let merged: DevSearchResultItem[] = searchResult.results.map((item) => ({
    url: item.url,
    title: item.title,
    snippet: item.snippet,
  }));

  if (registry !== null) {
    merged = [registryToResultItem(registry), ...merged];
  }

  const deduped = dedupeByUrl(merged);
  const reordered = reorderByDomainPriority(deduped);
  const biased = biasByProjectContext(reordered, manifest);

  const results = biased.slice(0, maxResults).map(({ domainPriority: _domainPriority, ...rest }) => rest);

  const meta = filterMetaForTier({ provider_used: searchResult.providerUsed, platform_category: 'search' }, ctx.agentTier);

  return { results, summary: searchResult.summary, _meta: meta };
}
