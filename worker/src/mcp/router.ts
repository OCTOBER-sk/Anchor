import { z } from 'zod';
import type { Context } from '../context';
import { PlatformError } from '../utils/errors';
import { handleSearch } from '../tools/search';
import { handleDevSearch } from '../tools/devsearch';
import { handleRemember, handleRecall } from '../tools/memory';
import {
  SearchInputSchema,
  DevSearchInputSchema,
  RememberInputSchema,
  RecallInputSchema,
  GuideInputSchema,
} from './schemas';

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType;
  handler: (args: unknown, ctx: Context) => Promise<unknown> | unknown;
}

export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
}

function stubHandler(toolName: string, phase: number) {
  return (_args: unknown, _ctx: Context): Promise<unknown> =>
    Promise.resolve({
      stub: true,
      tool: toolName,
      message: `Not implemented yet — Phase ${phase}`,
    });
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: 'anchor_search',
    description:
      'Web search with AI summarization, dork operators, phantom-answer suppression, and automatic injection of related memories.',
    schema: SearchInputSchema,
    handler: (args, ctx) => handleSearch(args as Parameters<typeof handleSearch>[0], ctx),
  },
  {
    name: 'anchor_dev_search',
    description: 'Package-registry-aware developer search, biased toward your project manifest when supplied.',
    schema: DevSearchInputSchema,
    handler: (args, ctx) => handleDevSearch(args as Parameters<typeof handleDevSearch>[0], ctx),
  },
  {
    name: 'anchor_remember',
    description: 'Store a persistent memory (with a semantic embedding) that any connected agent can recall later.',
    schema: RememberInputSchema,
    handler: (args, ctx) => handleRemember(args as Parameters<typeof handleRemember>[0], ctx),
  },
  {
    name: 'anchor_recall',
    description: 'Query persistent vector memory for memories semantically similar to the given query.',
    schema: RecallInputSchema,
    handler: (args, ctx) => handleRecall(args as Parameters<typeof handleRecall>[0], ctx),
  },
  {
    name: 'anchor_guide',
    description: 'Returns usage documentation for the other four Anchor tools.',
    schema: GuideInputSchema,
    handler: stubHandler('anchor_guide', 3),
  },
];

function formatZodIssues(error: z.ZodError): string {
  const details = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  return details.join('; ');
}

export function buildToolsList(): Array<{ name: string; description: string; inputSchema: unknown }> {
  return TOOL_REGISTRY.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.schema.toJSONSchema(),
  }));
}

export async function dispatchToolCall(name: string, args: unknown, ctx: Context): Promise<ToolCallResult> {
  const tool = TOOL_REGISTRY.find((entry) => entry.name === name);
  if (!tool) {
    throw new PlatformError('INVALID_PARAMS', `Unknown tool: "${name}".`);
  }

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    throw new PlatformError('INVALID_PARAMS', formatZodIssues(parsed.error));
  }

  const result = await tool.handler(parsed.data, ctx);
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  return { content: [{ type: 'text', text }] };
}
