import type { SearchProvider } from './dev-router';

export type DorkOperatorType = 'site' | 'filetype' | 'intitle' | 'exclude' | 'quoted';

export interface DorkOperator {
  type: DorkOperatorType;
  value: string;
  supportedProviders: SearchProvider[];
}

export interface ParsedQuery {
  cleanQuery: string;
  operators: DorkOperator[];
}

const OPERATOR_SUPPORT: Record<DorkOperatorType, SearchProvider[]> = {
  site: ['ddg', 'tavily', 'apify'],
  filetype: ['ddg', 'tavily'],
  intitle: ['tavily'],
  exclude: ['ddg', 'tavily'],
  quoted: ['ddg', 'tavily', 'apify'],
};

function tokenize(query: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(query)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(`"${match[1]}"`);
    } else if (match[2] !== undefined) {
      tokens.push(match[2]);
    }
  }
  return tokens;
}

function matchOperator(token: string): DorkOperator | null {
  const lower = token.toLowerCase();
  if (lower.startsWith('site:') && token.length > 'site:'.length) {
    return { type: 'site', value: token.slice('site:'.length), supportedProviders: OPERATOR_SUPPORT.site };
  }
  if (lower.startsWith('filetype:') && token.length > 'filetype:'.length) {
    return { type: 'filetype', value: token.slice('filetype:'.length), supportedProviders: OPERATOR_SUPPORT.filetype };
  }
  if (lower.startsWith('intitle:') && token.length > 'intitle:'.length) {
    return { type: 'intitle', value: token.slice('intitle:'.length), supportedProviders: OPERATOR_SUPPORT.intitle };
  }
  if (token.startsWith('-') && token.length > 1) {
    return { type: 'exclude', value: token.slice(1), supportedProviders: OPERATOR_SUPPORT.exclude };
  }
  if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
    return { type: 'quoted', value: token.slice(1, -1), supportedProviders: OPERATOR_SUPPORT.quoted };
  }
  return null;
}

export function parseDorkOperators(query: string): ParsedQuery {
  const tokens = tokenize(query);
  const cleanTokens: string[] = [];
  const operators: DorkOperator[] = [];
  for (const token of tokens) {
    const operator = matchOperator(token);
    if (operator !== null) {
      operators.push(operator);
    } else {
      cleanTokens.push(token);
    }
  }
  return { cleanQuery: cleanTokens.join(' ').trim(), operators };
}

function formatOperator(op: DorkOperator): string {
  switch (op.type) {
    case 'site':
      return `site:${op.value}`;
    case 'filetype':
      return `filetype:${op.value}`;
    case 'intitle':
      return `intitle:${op.value}`;
    case 'exclude':
      return `-${op.value}`;
    case 'quoted':
      return `"${op.value}"`;
  }
}

export function applyDorkOperators(providerQuery: string, operators: DorkOperator[], provider?: SearchProvider): string {
  const applicable =
    provider === undefined ? operators : operators.filter((op) => op.supportedProviders.includes(provider));
  const suffix = applicable.map(formatOperator).join(' ');
  const base = providerQuery.trim();
  if (suffix.length === 0) {
    return base;
  }
  return base.length > 0 ? `${base} ${suffix}` : suffix;
}
