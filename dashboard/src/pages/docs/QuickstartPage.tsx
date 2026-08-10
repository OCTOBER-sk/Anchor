import { Prerequisites, Snippet, WhatYouWillAccomplish, PageHeader, Section } from './docs-ui';

/**
 * Quickstart — frontend.md §3.7. The 2-minute setup, static and shareable
 * (no auth calls). Mirrors the onboarding flow's content: connect a runtime,
 * create an agent key, paste the config snippet. All 5 runtimes point at the
 * same endpoint with the same Authorization header (backend.md §2/§9).
 */

const endpointUrl = 'https://<your-anchor-endpoint>/mcp';
const agentKey = 'anchor_…';

const mcpServersBlock = JSON.stringify(
  {
    mcpServers: {
      anchor: {
        type: 'http',
        url: endpointUrl,
        headers: { Authorization: `Bearer ${agentKey}` },
      },
    },
  },
  null,
  2,
);

const opencodeBlock = JSON.stringify(
  {
    mcp: {
      anchor: {
        type: 'http',
        url: endpointUrl,
        headers: { Authorization: `Bearer ${agentKey}` },
      },
    },
  },
  null,
  2,
);

const claudeCliCommand = `claude mcp add anchor --transport http --url "${endpointUrl}" --header "Authorization: Bearer ${agentKey}"`;

const opencodeCliCommand = 'opencode mcp add anchor';

const runtimes = [
  { name: 'Claude Code', where: '.mcp.json at the project root.' },
  { name: 'Cursor', where: '.cursor/mcp.json in your project.' },
  { name: 'OpenCode', where: 'the mcp section of opencode.json.' },
  { name: 'Hermes', where: 'MCP servers settings — add a server named anchor.' },
  { name: 'Antigravity', where: "MCP servers settings — add a server named anchor." },
];

export function QuickstartPage() {
  return (
    <div>
      <PageHeader
        title="Quickstart"
        lead="Two minutes. One agent key, one endpoint, all three capabilities."
      />

      <WhatYouWillAccomplish>
        Create an agent key, add Anchor to a runtime, and verify the connection with a live check.
      </WhatYouWillAccomplish>
      <Prerequisites items={['A dashboard account', 'The Anchor endpoint shown in your dashboard']} />

      <Section title="1 · Create an agent key">
        <ol className="list-decimal space-y-3 pl-5 prose-copy">
          <li>Open the dashboard and go to onboarding, or create a key from Settings.</li>
          <li>Give the key a name you will recognize — for example "Claude Code Laptop".</li>
          <li>Copy the key that is shown once at creation. You will not see it again after the window closes.</li>
        </ol>
        <p className="prose-copy">
          Each runtime gets its own key. That way you can revoke one runtime without touching the others, and
          each one has its own call budget.
        </p>
      </Section>

      <Section title="2 · Choose your runtime">
        <p className="prose-copy">
          Anchor works with the runtimes you already use. Pick one below — the config is the same shape for
          every one of them.
        </p>
        <ul className="flex flex-wrap gap-3">
          {runtimes.map((runtime) => (
            <li
              key={runtime.name}
              className="rounded-control border border-border-default bg-bg-sunken px-4 py-2 text-body-sm font-medium text-text-primary"
            >
              {runtime.name}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="3 · Add Anchor to your runtime">
        <p className="prose-copy">
          Every runtime uses the same endpoint and the same Authorization header — only the surrounding config
          file differs. Claude Code, Cursor, Hermes, and Antigravity read a .mcp.json block; OpenCode reads the
          mcp section of its own config:
        </p>
        <Snippet label="Claude Code — .mcp.json (also Cursor, Hermes, Antigravity)" code={mcpServersBlock} />
        <Snippet label="OpenCode — opencode.json" code={opencodeBlock} />
        <p className="prose-copy">You can add the same server from the command line:</p>
        <Snippet label="Claude Code — claude mcp add" code={claudeCliCommand} />
        <Snippet label="OpenCode — opencode mcp add" code={opencodeCliCommand} />
        <p className="prose-copy">
          The OpenCode command walks through the server fields — choose the HTTP transport, then paste the
          endpoint and the Authorization header above.
        </p>
        <p className="prose-copy">Where each runtime keeps its config:</p>
        <ul className="list-disc space-y-1.5 pl-5 prose-copy">
          {runtimes.map((runtime) => (
            <li key={runtime.name}>
              <span className="font-medium text-text-primary">{runtime.name}</span> — {runtime.where}
            </li>
          ))}
        </ul>
        <p className="prose-copy">
          Replace <code className="code-inline">https://&lt;your-anchor-endpoint&gt;/mcp</code> with the Anchor
          endpoint shown in your dashboard, and{' '}
          <code className="code-inline">anchor_…</code> with the key you created.
        </p>
      </Section>

      <Section title="4 · Verify the connection">
        <p className="prose-copy">
          Restart your runtime after adding the config, then open a session and ask it to use Anchor — for
          example, ask it to search for something or to recall what it knows. If the onboarding flow is open,
          the validation step performs a live handshake against the endpoint and confirms the connection before
          you leave.
        </p>
        <p className="prose-copy">
          Not working? The troubleshooting guide maps every error you might see to its fix.
        </p>
      </Section>
    </div>
  );
}
