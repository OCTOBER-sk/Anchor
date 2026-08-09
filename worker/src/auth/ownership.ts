import type { Context } from '../context';

export const DEFAULT_OWNER_ID = 'anchor-deployment-owner';

export function resolveMemoryScope(_ctx: Context): { ownerId: string; sharedWith: string[] } {
  return { ownerId: DEFAULT_OWNER_ID, sharedWith: [DEFAULT_OWNER_ID] };
}
