import type { ProviderResultItem } from './dev-router';

export interface ProjectManifest {
  name?: string;
  dependencies: string[];
}

const JSON_DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

function collectJsonDependencies(value: unknown, out: Set<string>): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return;
  }
  for (const section of JSON_DEP_SECTIONS) {
    const deps = (value as Record<string, unknown>)[section];
    if (deps === null || typeof deps !== 'object') {
      continue;
    }
    for (const [name, spec] of Object.entries(deps as Record<string, unknown>)) {
      if (typeof name === 'string' && name.length > 0 && typeof spec === 'string') {
        out.add(name);
      }
    }
  }
}

function parseToml(raw: string, out: Set<string>): void {
  const lines = raw.split('\n');
  let inDependencies = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inDependencies = /^\[(dependencies|dev-dependencies|dependencies\.)/i.test(trimmed);
      continue;
    }
    if (inDependencies) {
      const nameMatch = /^name\s*=\s*"([^"]+)"/.exec(trimmed);
      if (nameMatch?.[1]) {
        out.add(nameMatch[1]);
        continue;
      }
      const requiresMatch = /^requires\s*=\s*"([^"]+)"/.exec(trimmed);
      if (requiresMatch?.[1]) {
        out.add(requiresMatch[1]);
      }
    }
  }
}

export function parseProjectManifest(raw: string): ProjectManifest {
  const dependencies = new Set<string>();
  let name: string | undefined;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.name === 'string') {
        name = obj.name;
      }
      collectJsonDependencies(parsed, dependencies);
    }
  } catch {
    // Not JSON — treat as TOML-ish (Cargo.toml / pyproject.toml).
    parseToml(raw, dependencies);
  }

  return { name, dependencies: [...dependencies] };
}

export function biasByProjectContext<T extends ProviderResultItem>(
  results: T[],
  manifest: ProjectManifest | null,
): T[] {
  if (manifest === null || manifest.dependencies.length === 0) {
    return results;
  }
  const deps = manifest.dependencies.map((dep) => dep.toLowerCase());
  const scored = results.map((item) => {
    const haystack = `${item.url} ${item.title} ${item.snippet}`.toLowerCase();
    let score = 0;
    for (const dep of deps) {
      if (haystack.includes(dep)) {
        score += 1;
      }
    }
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.item);
}
