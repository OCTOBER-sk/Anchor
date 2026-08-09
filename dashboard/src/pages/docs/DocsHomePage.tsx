import { Link } from 'react-router-dom';

import { CodeBlock } from '../../components/CodeBlock';
import { PageHeader, Section } from './docs-ui';

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

const connectExample = `{
  "mcpServers": {
    "anchor": {
      "type": "http",
      "url": "https://<your-anchor-endpoint>/mcp",
      "headers": {
        "Authorization": "Bearer <your-agent-key>"
      }
    }
  }
}`;

export function DocsHomePage() {
  return (
    <div>
      <PageHeader
        title="Anchor is the memory layer for your AI agents"
        lead="Every session, you re-explain everything. Anchor remembers what your agents already know — so they search, store, and recall context across every runtime, with one key and one endpoint."
      />

      <Section title="Three capabilities, one memory">
        <p className="max-w-2xl text-body-md leading-relaxed text-text-secondary">
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

      <Section title="Why Anchor exists">
        <div className="space-y-4 text-body-md leading-relaxed text-text-secondary">
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
        <div className="space-y-4 text-body-md leading-relaxed text-text-secondary">
          <p>
            One agent key, one endpoint. Connect a runtime by pointing it at the Anchor endpoint with your key
            in the Authorization header:
          </p>
          <CodeBlock code={connectExample} />
          <p>
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
