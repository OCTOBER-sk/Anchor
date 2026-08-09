/**
 * Data for the API reference page — frontend.md §3.7. Structured from
 * `backend.md` §8 (the single source of truth) and rendered by
 * `src/pages/docs/ApiReferencePage.tsx`.
 *
 * Consistency rule (§3.7): tool names and descriptions here must match what
 * a connected runtime actually receives — the `TOOL_REGISTRY` in
 * `worker/src/mcp/router.ts` (which is what `tools/list` returns) and the
 * substantive descriptions in `worker/src/tools/guide.ts` GUIDE_CONTENT.
 * The two word-level adjustments below (recall/remember descriptions) keep
 * the page inside §2.5's zero-tech-leakage rule while preserving the exact
 * substance of those sources — no drift in meaning.
 *
 * This is the one docs surface where the MCP protocol's own vocabulary is
 * used: "tool", "protocol version", "JSON-RPC", "Streamable HTTP".
 */

export interface ParamRow {
  param: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  description: string;
}

export interface OutputField {
  field: string;
  type: string;
  description: string;
}

export interface ToolRefData {
  name: string;
  description: string;
  behavior: string[];
  inputRows: ParamRow[];
  inputExample: string;
  outputFields: OutputField[];
  outputExample: string;
}

export interface ErrorRow {
  code: string;
  jsonrpc: string;
  when: string;
  message: string;
}

export const protocolVersion = '2025-11-25';

export const authenticationData = {
  headerExample: 'Authorization: Bearer anchor_<slug>_<hex>',
  keyFormat: 'anchor_<slug>_<hex>',
  notes: [
    'Every request to the MCP endpoint must include the Authorization header above.',
    'The key is a URL-safe slug identifying the runtime, followed by a 32-character hex secret.',
    'Create and manage keys from the dashboard. The raw key is shown exactly once, at creation — never again.',
  ],
};

export const transportData = {
  rows: [
    { item: 'Endpoint', value: 'POST /mcp' },
    { item: 'Protocol', value: 'JSON-RPC 2.0 over Streamable HTTP' },
    { item: 'Protocol version', value: protocolVersion },
    { item: 'Content type', value: 'application/json' },
  ],
  notes: [
    'The endpoint accepts a single request per call. Responses are streamed as JSON-RPC messages.',
    'Initialize first, then list the available tools, then call them by name.',
  ],
};

export interface InitializeRow {
  field: string;
  type: string;
  description: string;
}

export const initializeData = {
  requestExample: `{
  "protocolVersion": "2025-11-25",
  "capabilities": {},
  "clientInfo": { "name": "claude-code", "version": "1.0.0" }
}`,
  responseExample: `{
  "protocolVersion": "2025-11-25",
  "capabilities": { "tools": {} },
  "serverInfo": { "name": "anchor-mcp", "version": "1.0.0" }
}`,
  requestFields: [
    {
      field: 'protocolVersion',
      type: 'string',
      description: 'The MCP protocol version. Set to 2025-11-25.',
    },
    { field: 'capabilities', type: 'object', description: 'Client capabilities. May be empty for a basic client.' },
    {
      field: 'clientInfo',
      type: 'object',
      description: 'Client name and version: { name: string; version: string }.',
    },
  ],
  responseFields: [
    { field: 'protocolVersion', type: 'string', description: 'The negotiated protocol version.' },
    { field: 'capabilities', type: 'object', description: 'Server capabilities: { tools: {} }.' },
    {
      field: 'serverInfo',
      type: 'object',
      description: 'Server name and version: { name: "anchor-mcp", version: "1.0.0" }.',
    },
  ],
};

export interface ToolSummary {
  name: string;
  description: string;
}

export const toolsListData: ToolSummary[] = [
  {
    name: 'anchor_search',
    description:
      'Web search with AI summarization, dork operators, phantom-answer suppression, and automatic injection of related memories.',
  },
  {
    name: 'anchor_dev_search',
    description: 'Package-registry-aware developer search, biased toward your project manifest when supplied.',
  },
  {
    name: 'anchor_remember',
    description: 'Store a persistent memory that any connected agent can recall later.',
  },
  {
    name: 'anchor_recall',
    description: 'Query persistent memory for memories semantically similar to the given query.',
  },
  {
    name: 'anchor_guide',
    description: 'Returns usage documentation for the other four Anchor tools.',
  },
];

export const toolsData: ToolRefData[] = [
  {
    name: 'anchor_search',
    description:
      'Web search with AI summarization, dork operators, phantom-answer suppression, and automatic injection of related memories.',
    behavior: [
      'Dork operators are supported in the query: site:, filetype:, intitle:, -exclude, and quoted phrases.',
      'Low-content pages and paywalled stubs are suppressed before they reach you.',
      'Every call also searches your persistent memory in parallel and returns matches under related_memories. The field is always present — it may be an empty array. A failed recall never fails the search.',
    ],
    inputRows: [
      {
        param: 'query',
        type: 'string',
        required: true,
        defaultValue: null,
        description: 'The search query, up to 2,000 characters.',
      },
      {
        param: 'search_in',
        type: 'string[]',
        required: false,
        defaultValue: '["url", "title", "body"]',
        description: 'Which fields to match: url, title, or body. Defaults to all three.',
      },
      {
        param: 'max_results',
        type: 'integer',
        required: false,
        defaultValue: '10',
        description: 'How many results to return. Between 1 and 20.',
      },
    ],
    inputExample: `{
  "query": "how to add HTTP caching to a SvelteKit app",
  "max_results": 5
}`,
    outputFields: [
      {
        field: 'results',
        type: 'Result[]',
        description: 'Matched pages, ordered by relevance. Each item: url, title, snippet, domainPriority.',
      },
      { field: 'summary', type: 'string', description: 'An AI-generated summary of the findings.' },
      {
        field: 'related_memories',
        type: 'MemoryMatch[]',
        description:
          'Memories related to the query, matched in parallel with the web search. Always present — may be empty. Each item: id, content, tags, similarity, created_at.',
      },
      {
        field: '_meta.provider_used',
        type: 'string',
        description:
          'Label for the data source that served this call — a platform category for standard agents, the full provider label for admin and debug agents.',
      },
      {
        field: '_meta.platform_category',
        type: 'string',
        description: 'The kind of work behind the response: search, memory, or cache.',
      },
    ],
    outputExample: `{
  "results": [
    {
      "url": "developer.mozilla.org/en-US/docs/Web/HTTP/Caching",
      "title": "HTTP caching - MDN Web Docs",
      "snippet": "HTTP caching is the fastest win for repeat visits.",
      "domainPriority": 90
    }
  ],
  "summary": "HTTP caching is driven by Cache-Control headers and revalidation rules.",
  "related_memories": [
    {
      "id": "7c3a1d5e-9f4b-4a2d-8c6e-2b0f1a3d5c7e",
      "content": "Prefer stale-while-revalidate for our API responses.",
      "tags": ["conventions"],
      "similarity": 0.91,
      "created_at": "2026-08-02T14:03:00Z"
    }
  ],
  "_meta": { "provider_used": "search-primary", "platform_category": "search" }
}`,
  },
  {
    name: 'anchor_dev_search',
    description: 'Package-registry-aware developer search, biased toward your project manifest when supplied.',
    behavior: [
      'When the query looks like a single package name, the matching registry is queried directly for the latest version.',
      'If project_manifest is supplied, results that reference dependencies already in the project rank higher.',
    ],
    inputRows: [
      {
        param: 'query',
        type: 'string',
        required: true,
        defaultValue: null,
        description: 'The search query, up to 2,000 characters.',
      },
      {
        param: 'ecosystem',
        type: 'string',
        required: false,
        defaultValue: null,
        description: 'The package ecosystem to bias toward: npm, pypi, cargo, go, or other.',
      },
      {
        param: 'project_manifest',
        type: 'string',
        required: false,
        defaultValue: null,
        description:
          'The raw contents of a project manifest (for example a package.json). When supplied, results referencing dependencies already in your project rank higher.',
      },
      {
        param: 'max_results',
        type: 'integer',
        required: false,
        defaultValue: '10',
        description: 'How many results to return. Between 1 and 20.',
      },
    ],
    inputExample: `{
  "query": "zod",
  "ecosystem": "npm"
}`,
    outputFields: [
      {
        field: 'results',
        type: 'Result[]',
        description:
          'Matched pages, ordered by relevance. Each item: url, title, snippet, and an optional registryMatch with the resolved name, version, and ecosystem.',
      },
      { field: 'summary', type: 'string', description: 'An AI-generated summary of the findings.' },
      {
        field: '_meta.provider_used',
        type: 'string',
        description:
          'Label for the data source that served this call — a platform category for standard agents, the full provider label for admin and debug agents.',
      },
      {
        field: '_meta.platform_category',
        type: 'string',
        description: 'The kind of work behind the response.',
      },
    ],
    outputExample: `{
  "results": [
    {
      "url": "registry.npmjs.org/zod",
      "title": "zod",
      "snippet": "TypeScript-first schema validation with static type inference.",
      "registryMatch": { "name": "zod", "version": "3.25.76", "ecosystem": "npm" }
    }
  ],
  "summary": "zod is a TypeScript-first schema validation library; the latest version is 3.25.76.",
  "_meta": { "provider_used": "search-primary", "platform_category": "search" }
}`,
  },
  {
    name: 'anchor_remember',
    description: 'Store a persistent memory that any connected agent can recall later.',
    behavior: [
      'The content is stored in the shared memory store.',
      'Memory is scoped to your Anchor deployment: a memory written from one runtime is visible to every other runtime you connect.',
    ],
    inputRows: [
      {
        param: 'content',
        type: 'string',
        required: true,
        defaultValue: null,
        description: 'The memory to store. Up to 10,000 characters.',
      },
      {
        param: 'tags',
        type: 'string[]',
        required: false,
        defaultValue: '[]',
        description: 'Up to 10 tags to help organize the memory.',
      },
    ],
    inputExample: `{
  "content": "The API convention: every endpoint returns { error } on failure, never a bare throw.",
  "tags": ["conventions"]
}`,
    outputFields: [
      { field: 'id', type: 'string', description: 'Identifier of the stored memory.' },
      { field: 'stored', type: 'boolean', description: 'Always true on success.' },
      {
        field: '_meta.provider_used',
        type: 'string',
        description:
          'Label for the data source that served this call — a platform category for standard agents, the full provider label for admin and debug agents.',
      },
      {
        field: '_meta.platform_category',
        type: 'string',
        description: 'The kind of work behind the response: memory.',
      },
    ],
    outputExample: `{
  "id": "7c3a1d5e-9f4b-4a2d-8c6e-2b0f1a3d5c7e",
  "stored": true,
  "_meta": { "provider_used": "memory-primary", "platform_category": "memory" }
}`,
  },
  {
    name: 'anchor_recall',
    description: 'Query persistent memory for memories semantically similar to the given query.',
    behavior: [
      'Returns an array of memories ordered by similarity, each with id, content, tags, similarity, and created_at.',
      'Use a higher match_threshold for stricter, closer matches.',
    ],
    inputRows: [
      {
        param: 'query',
        type: 'string',
        required: true,
        defaultValue: null,
        description: 'The query to match against stored memories. Up to 2,000 characters.',
      },
      {
        param: 'match_threshold',
        type: 'number',
        required: false,
        defaultValue: '0.75',
        description: 'Similarity cutoff, from 0 to 1. Higher is stricter.',
      },
      {
        param: 'match_count',
        type: 'integer',
        required: false,
        defaultValue: '10',
        description: 'How many memories to return. Between 1 and 50.',
      },
    ],
    inputExample: `{
  "query": "how do we surface failures from the API",
  "match_count": 3
}`,
    outputFields: [
      {
        field: 'matches',
        type: 'MemoryMatch[]',
        description: 'Memories ordered by similarity. Each item: id, content, tags, similarity, created_at.',
      },
      {
        field: '_meta.provider_used',
        type: 'string',
        description:
          'Label for the data source that served this call — a platform category for standard agents, the full provider label for admin and debug agents.',
      },
      {
        field: '_meta.platform_category',
        type: 'string',
        description: 'The kind of work behind the response: memory.',
      },
    ],
    outputExample: `{
  "matches": [
    {
      "id": "7c3a1d5e-9f4b-4a2d-8c6e-2b0f1a3d5c7e",
      "content": "The API convention: every endpoint returns { error } on failure, never a bare throw.",
      "tags": ["conventions"],
      "similarity": 0.94,
      "created_at": "2026-08-02T14:03:00Z"
    }
  ],
  "_meta": { "provider_used": "memory-primary", "platform_category": "memory" }
}`,
  },
  {
    name: 'anchor_guide',
    description: 'Returns usage documentation for the other four Anchor tools.',
    behavior: [
      'Accepts no parameters.',
      'Returns structured markdown that documents each tool, its parameters, and its behavior.',
      'A newly connected runtime can bootstrap itself from this tool without external documentation.',
    ],
    inputRows: [],
    inputExample: `{}`,
    outputFields: [
      {
        field: 'guide',
        type: 'string',
        description: 'Markdown usage documentation for the other four Anchor tools.',
      },
    ],
    outputExample: `{
  "guide": "# Anchor — Remote MCP Server\\n\\nAnchor exposes three capabilities...\\n\\n## anchor_search\\n..."
}`,
  },
];

export const errorRows: ErrorRow[] = [
  {
    code: 'SEARCH_UNAVAILABLE',
    jsonrpc: '-32000',
    when: 'All search sources are temporarily unavailable.',
    message: 'Search is temporarily unavailable. Try again shortly.',
  },
  {
    code: 'RATE_LIMITED',
    jsonrpc: '-32000',
    when: 'The per-minute or per-day call cap for this agent key was exceeded.',
    message: 'The reset times for both windows are included so the runtime can back off until the window clears.',
  },
  {
    code: 'QUOTA_EXCEEDED',
    jsonrpc: '-32000',
    when: 'The shared AI capacity budget is genuinely exhausted, including the backup path.',
    message: 'AI capacity temporarily exhausted.',
  },
  {
    code: 'MEMORY_UNAVAILABLE',
    jsonrpc: '-32000',
    when: 'The memory service failed on a direct read or write.',
    message: 'Memory service is temporarily unavailable.',
  },
  {
    code: 'INVALID_PARAMS',
    jsonrpc: '-32602',
    when: 'One or more arguments failed validation against the tool schema.',
    message: 'Field-level detail — the caller\u2019s own input, safe to display.',
  },
  {
    code: 'INTERNAL_ERROR',
    jsonrpc: '-32603',
    when: 'An unexpected server error occurred.',
    message: 'A generic message only. Full detail is logged and never exposed to the client.',
  },
  {
    code: 'Authentication failure',
    jsonrpc: '-32001',
    when: 'The agent key was missing, malformed, revoked, or unknown.',
    message: 'Authentication failed. The response never distinguishes the reason.',
  },
];

export const rateLimitData = {
  rows: [
    { item: 'Per minute', value: '30 requests, per agent key' },
    { item: 'Per day', value: '500 requests, per agent key' },
    { item: 'Configured', value: 'Per key at creation, from the dashboard' },
  ],
  notes: [
    'Limits are enforced per agent key, not per runtime.',
    'A rejected request returns RATE_LIMITED with the reset time for each window, so the runtime can wait and retry cleanly.',
  ],
};
