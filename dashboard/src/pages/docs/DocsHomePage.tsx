import { Link } from 'react-router-dom';

import { Prerequisites, Snippet, WhatYouWillAccomplish, PageHeader, Section } from './docs-ui';

/**
 * Docs home — frontend.md §3.7. Introduction: what Anchor is, why it exists,
 * and where to go next. A Learn surface: one idea per section.
 */

const capabilities = [
  {
    to: '/docs/capabilities/search',
    name: 'Search',
    description: 'Web search with AI summaries — plus the context you already have, matched in parallel.',
  },
  {
    to: '/docs/capabilities/dev-search',
    name: 'Dev Search',
    description: 'Package-aware answers for developers — names, versions, and ecosystems from your query.',
  },
  {
    to: '/docs/capabilities/memory',
    name: 'Memory',
    description: 'What you learn is kept. Any agent recalls it, in any runtime.',
  },
];

const glossary = [
  {
    term: 'agent key',
    definition: 'The credential a runtime sends with every call — one per runtime, revocable from the dashboard.',
  },
  {
    term: 'capability',
    definition: 'Search, Dev Search, or Memory — a named surface with a defined contract every connected runtime gets.',
  },
  {
    term: 'runtime',
    definition: 'A tool you already use — Claude Code, Cursor, OpenCode, Hermes, or Antigravity.',
  },
  {
    term: 'auto-recall',
    definition:
      'Search also looks up your stored context on the topic in parallel, returning what you already knew next to the web results.',
  },
  {
    term: 'memory',
    definition: 'A stored decision, convention, or answer that any runtime can recall later, tagged and searchable.',
  },
];

const endpoint = 'https://<your-anchor-endpoint>/mcp';
const agentKey = 'anchor_…';

const claudeCodeConfig = JSON.stringify(
  {
    mcpServers: {
      anchor: {
        type: 'http',
        url: endpoint,
        headers: { Authorization: `Bearer ${agentKey}` },
      },
    },
  },
  null,
  2,
);

const opencodeConfig = JSON.stringify(
  {
    mcp: {
      anchor: {
        type: 'http',
        url: endpoint,
        headers: { Authorization: `Bearer ${agentKey}` },
      },
    },
  },
  null,
  2,
);

export function DocsHomePage() {
  return (
    <div>
      <PageHeader
        title="Anchor is the memory layer for your AI agents"
        lead="Every session, you re-explain everything. Anchor remembers what your agents already know — so they search, store, and recall context across every runtime, with one key and one endpoint."
      />

      <WhatYouWillAccomplish>
        Understand the three capabilities, how they fit together, and where to connect first.
      </WhatYouWillAccomplish>
      <Prerequisites items={['None — this page introduces the product.']} />

      <Section title="Three capabilities, one memory">
        <p className="prose-copy">
          Anchor gives every runtime you connect the same three capabilities. Each one is a real surface with
          a defined contract — documented below, and described the same way to your agents when they connect.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {capabilities.map((capability) => (
            <Link
              key={capability.to}
              to={capability.to}
              className="card-hoverable flex flex-col gap-3 p-6"
            >
              <h3 className="font-body text-body-lg font-semibold text-text-primary">{capability.name}</h3>
              <p className="text-body-sm leading-relaxed text-text-secondary">{capability.description}</p>
              <span className="mt-auto text-body-sm font-medium text-accent">Read the guide →</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Concepts">
        <dl className="divide-y divide-border-default rounded-card border border-border-default">
          {glossary.map((entry) => (
            <div
              key={entry.term}
              className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-4 sm:items-baseline"
            >
              <dt className="font-mono text-mono-md font-medium text-code-accent">{entry.term}</dt>
              <dd className="text-body-sm leading-relaxed text-text-secondary">{entry.definition}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Why Anchor exists">
        <div className="space-y-4 prose-copy">
          <p>
            Agent sessions start empty. The moment a conversation ends, the context your agent built up is
            gone — so next session, you re-explain the decisions, the conventions, and the answers you already
            established.
          </p>
          <p>
            Anchor fixes that with a shared memory your agents can read and write across sessions and runtimes.
            Search runs a web search and, in parallel, looks up what you already knew. Dev Search answers with
            package facts instead of a page list. Memory keeps everything you store, so one write is recalled
            forever — from Claude Code, Cursor, OpenCode, Hermes, or Antigravity.
          </p>
        </div>
      </Section>

      <Section title="How it fits together">
        <div className="space-y-4">
          <p className="prose-copy">
            One agent key, one endpoint. Connect a runtime by pointing it at the Anchor endpoint with your key
            in the Authorization header. Claude Code and the other file-based runtimes use a .mcp.json block;
            OpenCode adds the same server to the mcp section of its config:
          </p>
          <Snippet label="Claude Code — .mcp.json" code={claudeCodeConfig} />
          <Snippet label="OpenCode — opencode.json" code={opencodeConfig} />
          <p className="prose-copy">
            The runtime negotiates with the standard model context protocol, lists the available capabilities,
            and is ready to use them — no per-capability setup, no separate accounts.
          </p>
        </div>
      </Section>

      <Section title="Where to go next">
        <div className="flex flex-wrap gap-4">
          <Link to="/docs/quickstart" className="btn-primary">
            Quickstart — connect in two minutes
          </Link>
          <Link to="/docs/api-reference" className="btn-secondary">
            API reference
          </Link>
        </div>
      </Section>
    </div>
  );
}
