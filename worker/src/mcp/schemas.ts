import { z } from 'zod';
import { MAX_QUERY_LENGTH, SEARCH_IN_VALUES } from './validation';

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(MAX_QUERY_LENGTH),
  search_in: z.array(z.enum(SEARCH_IN_VALUES)).optional().default(['url', 'title', 'body']),
  max_results: z.number().int().min(1).max(20).optional().default(10),
});

export const DevSearchInputSchema = z.object({
  query: z.string().min(1).max(MAX_QUERY_LENGTH),
  ecosystem: z.enum(['npm', 'pypi', 'cargo', 'go', 'other']).optional(),
  project_manifest: z.string().optional(),
  max_results: z.number().int().min(1).max(20).optional().default(10),
});

export const RememberInputSchema = z.object({
  content: z.string().min(1).max(10000),
  tags: z.array(z.string()).max(10).optional().default([]),
});

export const RecallInputSchema = z.object({
  query: z.string().min(1).max(MAX_QUERY_LENGTH),
  match_threshold: z.number().min(0).max(1).optional().default(0.75),
  match_count: z.number().int().min(1).max(50).optional().default(10),
});

export const GuideInputSchema = z.object({});
