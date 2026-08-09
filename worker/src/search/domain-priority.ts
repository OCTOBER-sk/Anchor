import type { ProviderResultItem } from './dev-router';

interface DomainScoreRule {
  match: RegExp;
  score: number;
}

const DOMAIN_RULES: DomainScoreRule[] = [
  { match: /developer\.mozilla\.org$/, score: 95 },
  { match: /learn\.microsoft\.com$/, score: 90 },
  { match: /^docs\./, score: 80 },
  { match: /^developers\./, score: 80 },
  { match: /^developer\./, score: 80 },
  { match: /^help\./, score: 80 },
  { match: /^support\./, score: 80 },
  { match: /github\.com$/, score: 85 },
  { match: /stackoverflow\.com$/, score: 75 },
  { match: /stackexchange\.com$/, score: 75 },
  { match: /wikipedia\.org$/, score: 70 },
  { match: /medium\.com$/, score: 50 },
  { match: /dev\.to$/, score: 50 },
  { match: /hashnode\.dev$/, score: 50 },
  { match: /w3schools\.com$/, score: 45 },
  { match: /geeksforgeeks\.org$/, score: 45 },
  { match: /(fiverr|upwork|seoclerks)\.com$/, score: 10 },
];

export function scoreDomainPriority(url: string): number {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = url.toLowerCase();
  }
  const bare = host.replace(/^www\./, '');
  for (const rule of DOMAIN_RULES) {
    if (rule.match.test(bare)) {
      return rule.score;
    }
  }
  return 60;
}

export function reorderByDomainPriority<T extends ProviderResultItem>(
  results: T[],
): Array<T & { domainPriority: number }> {
  return results
    .map((item) => ({ ...item, domainPriority: scoreDomainPriority(item.url) }))
    .sort((a, b) => b.domainPriority - a.domainPriority);
}
