/**
 * Runtime config snippets — frontend.md §5.2.
 *
 * Pure client-side string templating. One function per runtime, all consuming
 * the same two inputs: `endpointUrl` (the deployed worker's /mcp URL,
 * environment-configured) and `agentKey` (the just-created raw key).
 *
 * Every runtime points at the same endpoint with the same
 * `Authorization: Bearer <key>` header (backend.md §2/§9); only the
 * surrounding config-file syntax differs. Formats mirror the shipped
 * Quickstart page so the docs and onboarding never drift.
 */

export type Runtime = 'claude-code' | 'cursor' | 'opencode' | 'hermes' | 'antigravity';

export interface RuntimeOption {
  id: Runtime;
  name: string;
  /** One-line descriptor for the picker card. */
  description: string;
  /** One line: where this runtime's config file/settings lives. */
  where: string;
}

export const RUNTIMES: RuntimeOption[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Command-line coding agent',
    where: 'Create or edit .mcp.json at the project root.',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    description: 'AI code editor',
    where: 'Create or edit .cursor/mcp.json in your project.',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source coding agent',
    where: 'Add the mcp section to your opencode.json.',
  },
  {
    id: 'hermes',
    name: 'Hermes',
    description: 'Agentic research workbench',
    where: 'In the Hermes MCP servers settings, add a server named anchor.',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    description: 'AI-native code editor',
    where: "In Antigravity's MCP servers settings, add a server named anchor.",
  },
];

const SERVER_NAME = 'anchor';

/**
 * The deployed worker's /mcp URL, from the build environment. Null when the
 * dashboard is running without a configured endpoint — callers must render a
 * clean config state rather than fabricating a placeholder value (§2.5).
 */
export function getEndpointUrl(): string | null {
  const value = import.meta.env.VITE_ANCHOR_ENDPOINT;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** The MCP server block shared by every runtime that uses the `mcpServers`
 *  shape (Claude Code, Cursor, Hermes, Antigravity). */
function mcpServersBlock(endpointUrl: string, agentKey: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        [SERVER_NAME]: {
          type: 'http',
          url: endpointUrl,
          headers: { Authorization: `Bearer ${agentKey}` },
        },
      },
    },
    null,
    2,
  );
}

/** OpenCode's own config shape — the mcp section of opencode.json. */
function opencodeBlock(endpointUrl: string, agentKey: string): string {
  return JSON.stringify(
    {
      mcp: {
        [SERVER_NAME]: {
          type: 'http',
          url: endpointUrl,
          headers: { Authorization: `Bearer ${agentKey}` },
        },
      },
    },
    null,
    2,
  );
}

/**
 * Generate the config snippet for a runtime. `endpointUrl` is the full /mcp
 * URL (as configured via VITE_ANCHOR_ENDPOINT) and `agentKey` is the raw key
 * returned once at creation. Never interpolates placeholders — callers pass
 * real values or show the clean config state instead.
 */
export function generateSnippet(runtime: Runtime, endpointUrl: string, agentKey: string): string {
  switch (runtime) {
    case 'opencode':
      return opencodeBlock(endpointUrl, agentKey);
    case 'claude-code':
    case 'cursor':
    case 'hermes':
    case 'antigravity':
      return mcpServersBlock(endpointUrl, agentKey);
  }
}
