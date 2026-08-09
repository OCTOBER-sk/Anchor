export const MAX_QUERY_LENGTH = 2000;

export const SEARCH_IN_VALUES = ['url', 'title', 'body'] as const;

export type SearchInValue = (typeof SEARCH_IN_VALUES)[number];

export function isValidSearchIn(value: unknown): value is SearchInValue {
  return typeof value === 'string' && (SEARCH_IN_VALUES as readonly string[]).includes(value);
}
