import { safeFetch } from '../utils/safe-fetch';

export type Ecosystem = 'npm' | 'pypi' | 'cargo' | 'go';

export interface RegistryResult {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  url: string;
  title: string;
  snippet: string;
}

const REQUEST_TIMEOUT_MS = 10_000;
const REGISTRY_ALLOWED_HOSTS = ['registry.npmjs.org', 'pypi.org', 'crates.io', 'proxy.golang.org'];

function encodeGoModulePath(modulePath: string): string {
  return modulePath
    .split('/')
    .map((segment) => segment.replace(/[A-Z]/g, (c) => `!${c.toLowerCase()}`))
    .join('/');
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await safeFetch(url, {}, { allowedHosts: REGISTRY_ALLOWED_HOSTS, timeoutMs: REQUEST_TIMEOUT_MS });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function queryRegistry(packageName: string, ecosystem: Ecosystem): Promise<RegistryResult | null> {
  const name = packageName.trim();
  if (name.length === 0) {
    return null;
  }

  switch (ecosystem) {
    case 'npm': {
      const data = await fetchJson<{ name?: string; 'dist-tags'?: Record<string, string> }>(
        `https://registry.npmjs.org/${encodeURIComponent(name)}`,
      );
      if (data === null || typeof data.name !== 'string') {
        return null;
      }
      const version = data['dist-tags']?.latest ?? 'unknown';
      return {
        name: data.name,
        version,
        ecosystem: 'npm',
        url: `https://www.npmjs.com/package/${encodeURIComponent(data.name)}`,
        title: `${data.name} on npm`,
        snippet: `Latest version: ${version}`,
      };
    }
    case 'pypi': {
      const data = await fetchJson<{ info?: { name?: string; version?: string } }>(
        `https://pypi.org/pypi/${encodeURIComponent(name)}/json`,
      );
      const info = data?.info;
      if (data === null || typeof info?.name !== 'string') {
        return null;
      }
      const version = info.version ?? 'unknown';
      return {
        name: info.name,
        version,
        ecosystem: 'pypi',
        url: `https://pypi.org/project/${encodeURIComponent(info.name)}/`,
        title: `${info.name} on PyPI`,
        snippet: `Latest version: ${version}`,
      };
    }
    case 'cargo': {
      const data = await fetchJson<{ crate?: { name?: string; max_version?: string } }>(
        `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`,
      );
      const crate = data?.crate;
      if (data === null || typeof crate?.name !== 'string') {
        return null;
      }
      const version = crate.max_version ?? 'unknown';
      return {
        name: crate.name,
        version,
        ecosystem: 'cargo',
        url: `https://crates.io/crates/${encodeURIComponent(crate.name)}`,
        title: `${crate.name} on crates.io`,
        snippet: `Latest version: ${version}`,
      };
    }
    case 'go': {
      const data = await fetchJson<{ Version?: string }>(
        `https://proxy.golang.org/${encodeGoModulePath(name)}/@latest`,
      );
      if (data === null || typeof data.Version !== 'string') {
        return null;
      }
      return {
        name,
        version: data.Version,
        ecosystem: 'go',
        url: `https://pkg.go.dev/${name}`,
        title: `${name} on pkg.go.dev`,
        snippet: `Latest version: ${data.Version}`,
      };
    }
  }
}
