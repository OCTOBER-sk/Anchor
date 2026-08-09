import type { Context } from '../context';
import { captureError } from '../utils/monitoring';
import { complete } from './cerebras';
import { generateContent } from './gemini';

export type AITaskType = 'summarize' | 'classify';
export type AITaskCategory = 'search' | 'memory' | 'cache';

export interface AIDispatchResult {
  text?: string;
  embedding?: number[];
  providerUsed: 'cerebras' | 'gemini';
  platformCategory: AITaskCategory;
}

export class AIProviderError extends Error {
  readonly provider: 'cerebras' | 'gemini';
  readonly status?: number;
  readonly detail?: string;

  constructor(
    message: string,
    opts: { provider: 'cerebras' | 'gemini'; status?: number; detail?: string; cause?: unknown },
  ) {
    super(message, { cause: opts.cause });
    this.name = 'AIProviderError';
    this.provider = opts.provider;
    this.status = opts.status;
    this.detail = opts.detail;
  }
}

const MAX_TOKENS_BY_TASK: Record<AITaskType, number> = {
  summarize: 300,
  classify: 60,
};

export async function dispatchAI(task: AITaskType, input: string, ctx: Context): Promise<AIDispatchResult> {
  const maxTokens = MAX_TOKENS_BY_TASK[task];
  try {
    const text = await complete(input, { maxTokens }, ctx.env);
    return { text, providerUsed: 'cerebras', platformCategory: 'search' };
  } catch (cerebrasErr) {
    captureError('ai/router.ts::dispatchAI', cerebrasErr, { task, stage: 'cerebras', agentId: ctx.agentId });
    try {
      const text = await generateContent(input, { maxTokens }, ctx.env);
      return { text, providerUsed: 'gemini', platformCategory: 'search' };
    } catch (geminiErr) {
      captureError('ai/router.ts::dispatchAI', geminiErr, { task, stage: 'gemini', agentId: ctx.agentId });
      throw new AIProviderError(`Both AI providers failed for task "${task}".`, {
        provider: 'gemini',
        cause: geminiErr,
      });
    }
  }
}
