import type { Context } from '../context';
import { filterMetaForTier, type PublicMeta } from '../auth/permissions';
import { resolveMemoryScope } from '../auth/ownership';
import { PlatformError } from '../utils/errors';
import { captureError } from '../utils/monitoring';
import { embedText } from '../ai/gemini';
import { writeMemory, matchMemories, type MemoryMatch } from '../storage/supabase';

const DEFAULT_MATCH_THRESHOLD = 0.75;
const DEFAULT_MATCH_COUNT = 10;

export interface RememberInput {
  content: string;
  tags?: string[];
}

export interface RecallInput {
  query: string;
  match_threshold?: number;
  match_count?: number;
}

export interface RememberToolResult {
  id: string;
  stored: true;
  _meta: PublicMeta;
}

export interface RecallToolResult {
  matches: MemoryMatch[];
  _meta: PublicMeta;
}

export async function handleRemember(input: RememberInput, ctx: Context): Promise<RememberToolResult> {
  const { ownerId } = resolveMemoryScope(ctx);
  try {
    const embedding = await embedText(input.content, ctx.env);
    const { id } = await writeMemory(
      {
        ownerId,
        agentId: ctx.agentId,
        content: input.content,
        embedding,
        tags: input.tags ?? [],
        sourceTool: 'anchor_remember',
      },
      ctx.env,
    );
    const meta = filterMetaForTier({ provider_used: 'gemini', platform_category: 'memory' }, ctx.agentTier);
    return { id, stored: true, _meta: meta };
  } catch (err) {
    captureError('tools/memory.ts::handleRemember', err, { agentId: ctx.agentId });
    throw new PlatformError('MEMORY_UNAVAILABLE', 'Failed to store memory.');
  }
}

export async function handleRecall(input: RecallInput, ctx: Context): Promise<RecallToolResult> {
  const { ownerId } = resolveMemoryScope(ctx);
  try {
    const embedding = await embedText(input.query, ctx.env);
    const matches = await matchMemories(
      embedding,
      {
        ownerId,
        matchThreshold: input.match_threshold ?? DEFAULT_MATCH_THRESHOLD,
        matchCount: input.match_count ?? DEFAULT_MATCH_COUNT,
      },
      ctx.env,
    );
    const meta = filterMetaForTier({ provider_used: 'gemini', platform_category: 'memory' }, ctx.agentTier);
    return { matches, _meta: meta };
  } catch (err) {
    captureError('tools/memory.ts::handleRecall', err, { agentId: ctx.agentId });
    throw new PlatformError('MEMORY_UNAVAILABLE', 'Failed to recall memories.');
  }
}
