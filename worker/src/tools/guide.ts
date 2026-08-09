import type { Context } from '../context';
import { filterMetaForTier, type PublicMeta } from '../auth/permissions';

export const GUIDE_CONTENT = `# Anchor — Remote MCP Server

Anchor is a remote MCP server (JSON-RPC 2.0 over Streamable HTTP) that exposes
three capabilities through one agent key and one endpoint:

1. **Search** — web search with AI summarization, dork operators, and automatic
   injection of related memories (\`anchor_search\`).
2. **Dev Search** — package-registry-aware developer search
   (\`anchor_dev_search\`).
3. **Memory** — persistent vector memory shared across agent runtimes
   (\`anchor_remember\` / \`anchor_recall\`).

## anchor_search

Web search with AI summarization.

Parameters:
- \`query\` (string, required): the search query, up to 2000 characters.
- \`search_in\` (string[]): which fields to match — \`url\`, \`title\`, or
  \`body\`. Defaults to all three.
- \`max_results\` (number, 1–20): how many results to return. Defaults to 10.

Behavior:
- Supports dork operators in the query: \`site:\`, \`filetype:\`,
  \`intitle:\`, \`-exclude\`, and quoted phrases.
- Low-content placeholder and paywalled results are suppressed before they
  reach you.
- **Automatic recall injection**: every call also searches your persistent
  memory in parallel and returns matches under \`related_memories\`. This field
  is always present — it may be an empty array. A failed recall never fails the
  search; you get your web results either way.

## anchor_dev_search

Developer-focused search that is aware of package registries.

Parameters:
- \`query\` (string, required): the search query.
- \`ecosystem\` (string): \`npm\`, \`pypi\`, \`cargo\`, \`go\`, or \`other\`.
  When the query looks like a single package name, the matching registry is
  queried directly for the latest version.
- \`project_manifest\` (string): the raw contents of a project manifest (for
  example a \`package.json\`). When supplied, results that reference
  dependencies present in your project are ranked higher.
- \`max_results\` (number, 1–20): how many results to return. Defaults to 10.

## anchor_remember

Store a persistent memory that any connected agent can recall later.

Parameters:
- \`content\` (string, required): the memory text, up to 10000 characters.
- \`tags\` (string[], max 10): optional tags to help organize memories.

Behavior:
- The content is embedded and stored in the shared vector store.
- Memory is scoped to your Anchor deployment: a memory written from one agent
  runtime is visible to every other runtime you connect.

## anchor_recall

Query persistent vector memory for memories similar to a query.

Parameters:
- \`query\` (string, required): the search query.
- \`match_threshold\` (number, 0–1): similarity cutoff. Defaults to 0.75.
- \`match_count\` (number, 1–50): how many memories to return. Defaults to 10.

Returns an array of matches ordered by similarity, each with \`id\`,
\`content\`, \`tags\`, \`similarity\`, and \`created_at\`.
`;

export const ADMIN_NOTES = `## For admin/debug agents

When your agent tier is \`admin\` or \`debug\`, the \`_meta.provider_used\` field
on tool results exposes the underlying provider name. Standard-tier agents
receive a platform label instead (for example \`search-primary\`). No action is
needed — this is informational.
`;

export interface GuideToolResult {
  guide: string;
  _meta: PublicMeta;
}

export async function handleGuide(_input: unknown, ctx: Context): Promise<GuideToolResult> {
  const adminNotes = ctx.agentTier === 'admin' || ctx.agentTier === 'debug' ? `\n${ADMIN_NOTES}` : '';
  const meta = filterMetaForTier({ provider_used: 'guide', platform_category: 'cache' }, ctx.agentTier);
  return { guide: `${GUIDE_CONTENT}${adminNotes}`, _meta: meta };
}
