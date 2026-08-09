/**
 * Data for the three capability pages — frontend.md §3.7 (the predecessor's
 * ToolPageData pattern, adapted). One entry per capability, rendered by
 * `src/pages/docs/CapabilityPage.tsx`.
 *
 * Source of truth for every schema value: `backend.md` §8. Field names,
 * types, defaults, and bounds here must match the MCP input/output shapes
 * exactly. Copy discipline per §2.5: zero tech-stack names, zero hype,
 * "capability" not "tool" (this is human-facing docs, not the protocol
 * reference).
 */

export interface SchemaRow {
  param: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  description: string;
}

export interface SchemaSection {
  group?: string;
  rows: SchemaRow[];
}

export interface OutputField {
  field: string;
  type: string;
  description: string;
}

export interface OutputSection {
  group?: string;
  fields: OutputField[];
}

export interface CodeSample {
  label?: string;
  code: string;
}

export interface ErrorRow {
  code: string;
  cause: string;
  resolution: string;
}

export interface LimitRow {
  item: string;
  limit: string;
}

export interface WorkedExample {
  title: string;
  note: string;
  code: string;
}

export interface CapabilityPageData {
  id: 'search' | 'dev-search' | 'memory';
  route: string;
  name: string;
  description: string;
  bestFor: string[];
  whatItDoes: string;
  problemItSolves: string;
  inputSections: SchemaSection[];
  inputExamples: CodeSample[];
  outputSections: OutputSection[];
  outputExamples: CodeSample[];
  workedExamples: WorkedExample[];
  errors: ErrorRow[];
  limits: LimitRow[];
}

export const capabilityPages: CapabilityPageData[] = [
  {
    id: 'search',
    route: 'search',
    name: 'Search',
    description:
      'Web search with AI summaries — plus the context you already have on the topic, matched in parallel.',
    bestFor: [
      'Answering open questions quickly',
      'Getting a concise summary of current information',
      'Checking what you already know before deciding',
    ],
    whatItDoes:
      'Search runs a web search, filters out low-content and paywalled pages, and returns an AI summary of the strongest results. Every call also looks up your persistent memory in parallel: anything you have stored on the topic comes back as related_memories, so your agent sees what it already knew next to what is new.',
    problemItSolves:
      'A raw search returns a list of links. Your agent would have to open each one, read it, and reconcile it with context you established weeks ago. Search collapses that into a single answer — the summary, the sources, and your own prior knowledge in one response.',
    inputSections: [
      {
        rows: [
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
            description: 'Which fields to match against: url, title, or body. Defaults to all three.',
          },
          {
            param: 'max_results',
            type: 'integer',
            required: false,
            defaultValue: '10',
            description: 'How many results to return. Between 1 and 20.',
          },
        ],
      },
    ],
    inputExamples: [
      {
        label: 'anchor_search',
        code: `{
  "query": "how to add HTTP caching to a SvelteKit app",
  "max_results": 5
}`,
      },
    ],
    outputSections: [
      {
        fields: [
          {
            field: 'results',
            type: 'Result[]',
            description:
              'Matched pages, ordered by relevance. Each item: url, title, snippet, and a domainPriority score.',
          },
          {
            field: 'summary',
            type: 'string',
            description: 'An AI-generated summary of the findings.',
          },
          {
            field: 'related_memories',
            type: 'MemoryMatch[]',
            description:
              'Related context from your persistent memory. Always present — may be an empty array. Each item: id, content, tags, similarity, created_at.',
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
      },
    ],
    outputExamples: [
      {
        code: `{
  "results": [
    {
      "url": "developer.mozilla.org/en-US/docs/Web/HTTP/Caching",
      "title": "HTTP caching - MDN Web Docs",
      "snippet": "HTTP caching is the fastest win for repeat visits. Cache-Control and revalidation control what stays fresh.",
      "domainPriority": 90
    }
  ],
  "summary": "HTTP caching is driven by Cache-Control headers and revalidation rules, which control how long a response stays fresh.",
  "related_memories": [
    {
      "id": "7c3a1d5e-9f4b-4a2d-8c6e-2b0f1a3d5c7e",
      "content": "Prefer stale-while-revalidate for our API responses.",
      "tags": ["conventions"],
      "similarity": 0.91,
      "created_at": "2026-08-02T14:03:00Z"
    }
  ],
  "_meta": {
    "provider_used": "search-primary",
    "platform_category": "search"
  }
}`,
      },
    ],
    workedExamples: [
      {
        title: 'Ask, and get the context you already have',
        note: 'The web search and the memory lookup run in parallel, so a topic you have stored returns both new sources and the relevant memory in one response.',
        code: `{
  "query": "best practice for HTTP caching in a SvelteKit app",
  "max_results": 5
}
→ related_memories surfaces: "Prefer stale-while-revalidate for our API responses."`,
      },
    ],
    errors: [
      {
        code: 'SEARCH_UNAVAILABLE',
        cause: 'All search sources are temporarily unavailable.',
        resolution:
          'Try again shortly. Anchor falls back between sources automatically before ever surfacing this.',
      },
      {
        code: 'RATE_LIMITED',
        cause: 'The per-minute or per-day call cap for this agent key was reached.',
        resolution: 'Wait for the window to reset, or raise the limit for this key in Settings.',
      },
      {
        code: 'QUOTA_EXCEEDED',
        cause: 'The shared AI capacity budget is temporarily exhausted.',
        resolution: 'Wait and retry. Anchor switches to its backup path automatically before this surfaces.',
      },
      {
        code: 'INVALID_PARAMS',
        cause: 'An argument failed validation — for example a query over 2,000 characters or a max_results above 20.',
        resolution: 'Fix the argument and retry. The response includes field-level detail.',
      },
    ],
    limits: [
      { item: 'Query length', limit: '2,000 characters' },
      { item: 'max_results', limit: '1–20 (default 10)' },
      { item: 'Call rate', limit: '30 per minute, 500 per day, per agent key' },
    ],
  },
  {
    id: 'dev-search',
    route: 'dev-search',
    name: 'Dev Search',
    description:
      'Package-aware answers for developers — names, versions, and ecosystems resolved from your query.',
    bestFor: [
      'Checking whether a package exists and its latest version',
      'Looking up a library against your own project manifest',
      'Developer questions where ecosystem context matters',
    ],
    whatItDoes:
      'Dev Search biases results toward the developer experience. When a query looks like a single package name, the matching registry is queried directly for the current version. If you supply your project manifest, results that reference dependencies already in your project are ranked higher.',
    problemItSolves:
      'A generic search does not know npm from PyPI, and cannot tell whether a result is relevant to the packages you actually use. Dev Search resolves package facts directly from the registries and ranks results against your own manifest, so the answer fits your stack instead of being a generic page list.',
    inputSections: [
      {
        rows: [
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
            description:
              'The package ecosystem to bias toward: npm, pypi, cargo, go, or other. When the query looks like a single package name, this registry is queried directly.',
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
      },
    ],
    inputExamples: [
      {
        label: 'anchor_dev_search',
        code: `{
  "query": "zod",
  "ecosystem": "npm"
}`,
      },
    ],
    outputSections: [
      {
        fields: [
          {
            field: 'results',
            type: 'Result[]',
            description:
              'Matched pages, ordered by relevance. Each item: url, title, snippet, and an optional registryMatch with the resolved name, version, and ecosystem.',
          },
          {
            field: 'summary',
            type: 'string',
            description: 'An AI-generated summary of the findings.',
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
            description: 'The kind of work behind the response.',
          },
        ],
      },
    ],
    outputExamples: [
      {
        code: `{
  "results": [
    {
      "url": "registry.npmjs.org/zod",
      "title": "zod",
      "snippet": "TypeScript-first schema validation with static type inference.",
      "registryMatch": {
        "name": "zod",
        "version": "3.25.76",
        "ecosystem": "npm"
      }
    }
  ],
  "summary": "zod is a TypeScript-first schema validation library; the latest version is 3.25.76.",
  "_meta": {
    "provider_used": "search-primary",
    "platform_category": "search"
  }
}`,
      },
    ],
    workedExamples: [
      {
        title: 'Resolve a package version',
        note: 'A single-token query is treated as a package lookup, so the registry answers directly with the current version rather than a page of search results.',
        code: `{
  "query": "tsx",
  "ecosystem": "npm"
}
→ registryMatch: { "name": "tsx", "version": "4.20.3", "ecosystem": "npm" }`,
      },
      {
        title: 'Search against your own project',
        note: 'Paste a package.json into project_manifest and results that reference dependencies already in the project move to the top.',
        code: `{
  "query": "esbuild plugins",
  "project_manifest": "{ \\"dependencies\\": { \\"esbuild\\": \\"^0.25.0\\" } }"
}`,
      },
    ],
    errors: [
      {
        code: 'SEARCH_UNAVAILABLE',
        cause: 'All search sources are temporarily unavailable.',
        resolution:
          'Try again shortly. Anchor falls back between sources automatically before ever surfacing this.',
      },
      {
        code: 'RATE_LIMITED',
        cause: 'The per-minute or per-day call cap for this agent key was reached.',
        resolution: 'Wait for the window to reset, or raise the limit for this key in Settings.',
      },
      {
        code: 'QUOTA_EXCEEDED',
        cause: 'The shared AI capacity budget is temporarily exhausted.',
        resolution: 'Wait and retry. Anchor switches to its backup path automatically before this surfaces.',
      },
      {
        code: 'INVALID_PARAMS',
        cause: 'An argument failed validation — for example an unknown ecosystem value.',
        resolution: 'Fix the argument and retry. The response includes field-level detail.',
      },
    ],
    limits: [
      { item: 'Query length', limit: '2,000 characters' },
      { item: 'max_results', limit: '1–20 (default 10)' },
      { item: 'Call rate', limit: '30 per minute, 500 per day, per agent key' },
    ],
  },
  {
    id: 'memory',
    route: 'memory',
    name: 'Memory',
    description: 'What you learn is kept. Any agent recalls it, in any runtime.',
    bestFor: [
      'Recording decisions and conventions once',
      'Retrieving context across sessions',
      'Sharing what you know across every runtime you connect',
    ],
    whatItDoes:
      'Remember stores a piece of context — a decision, a convention, an answer — under tags you choose. Recall retrieves the stored context most similar to a query, ordered by how closely it matches. Everything you remember is shared: write it from one runtime, recall it from any other.',
    problemItSolves:
      'Every session, you re-explain everything. Agent context resets when a session ends, so the same decisions get re-derived each time. Memory gives your agents a persistent record of what you have already established — one write, recalled forever.',
    inputSections: [
      {
        group: 'anchor_remember',
        rows: [
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
      },
      {
        group: 'anchor_recall',
        rows: [
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
      },
    ],
    inputExamples: [
      {
        label: 'anchor_remember',
        code: `{
  "content": "The API convention: every endpoint returns { error } on failure, never a bare throw.",
  "tags": ["conventions"]
}`,
      },
      {
        label: 'anchor_recall',
        code: `{
  "query": "how do we surface failures from the API",
  "match_count": 3
}`,
      },
    ],
    outputSections: [
      {
        group: 'anchor_remember',
        fields: [
          {
            field: 'id',
            type: 'string',
            description: 'Identifier of the stored memory.',
          },
          {
            field: 'stored',
            type: 'boolean',
            description: 'Always true on success.',
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
      },
      {
        group: 'anchor_recall',
        fields: [
          {
            field: 'matches',
            type: 'MemoryMatch[]',
            description:
              'Memories ordered by similarity. Each item: id, content, tags, similarity, created_at.',
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
      },
    ],
    outputExamples: [
      {
        label: 'anchor_remember',
        code: `{
  "id": "7c3a1d5e-9f4b-4a2d-8c6e-2b0f1a3d5c7e",
  "stored": true,
  "_meta": {
    "provider_used": "memory-primary",
    "platform_category": "memory"
  }
}`,
      },
      {
        label: 'anchor_recall',
        code: `{
  "matches": [
    {
      "id": "7c3a1d5e-9f4b-4a2d-8c6e-2b0f1a3d5c7e",
      "content": "The API convention: every endpoint returns { error } on failure, never a bare throw.",
      "tags": ["conventions"],
      "similarity": 0.94,
      "created_at": "2026-08-02T14:03:00Z"
    }
  ],
  "_meta": {
    "provider_used": "memory-primary",
    "platform_category": "memory"
  }
}`,
      },
    ],
    workedExamples: [
      {
        title: 'Record a decision once',
        note: 'Stored with tags so it is easy to scan later. The memory is visible to every runtime you connect.',
        code: `{
  "content": "Prefer stale-while-revalidate for our API responses.",
  "tags": ["conventions"]
}
→ { "id": "7c3a1d5e-...", "stored": true }`,
      },
      {
        title: 'Recall it from another runtime',
        note: 'A different agent, a later session, a different runtime — the same memory comes back when the question is similar.',
        code: `{
  "query": "what did we decide about response caching",
  "match_count": 3
}
→ "Prefer stale-while-revalidate for our API responses." (similarity 0.94)`,
      },
    ],
    errors: [
      {
        code: 'MEMORY_UNAVAILABLE',
        cause: 'The memory service failed on a direct read or write.',
        resolution: 'Try again shortly. Background recall never surfaces this — it degrades quietly.',
      },
      {
        code: 'RATE_LIMITED',
        cause: 'The per-minute or per-day call cap for this agent key was reached.',
        resolution: 'Wait for the window to reset, or raise the limit for this key in Settings.',
      },
      {
        code: 'INVALID_PARAMS',
        cause: 'An argument failed validation — for example content over 10,000 characters or more than 10 tags.',
        resolution: 'Fix the argument and retry. The response includes field-level detail.',
      },
    ],
    limits: [
      { item: 'Content length (remember)', limit: '10,000 characters' },
      { item: 'Tags', limit: '10 per memory' },
      { item: 'Query length (recall)', limit: '2,000 characters' },
      { item: 'match_count', limit: '1–50 (default 10)' },
      { item: 'Call rate', limit: '30 per minute, 500 per day, per agent key' },
    ],
  },
];
