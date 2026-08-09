import { Link } from 'react-router-dom';

import { errorRows } from '../../content/api-reference-data';
import { PageHeader, Section } from './docs-ui';

/**
 * Troubleshooting — frontend.md §3.7. One error card per platform error code
 * (all 7 rows of backend.md §8). Each card: the code, its JSON-RPC mapping,
 * when it happens, and the client-visible message.
 */
export function TroubleshootingPage() {
  return (
    <div>
      <PageHeader
        title="Troubleshooting"
        lead="Every error a runtime can hit, what it means, and what to do about it. Messages you see are always safe to display — if one looks generic, that is deliberate."
      />

      <Section title="Error reference">
        <div className="space-y-6">
          {errorRows.map((row) => (
            <article key={row.code} className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-mono-md font-medium text-code-accent">{row.code}</p>
                <span className="rounded-control bg-bg-sunken px-2.5 py-1 font-mono text-mono-sm text-text-secondary">
                  JSON-RPC {row.jsonrpc}
                </span>
              </div>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="font-body text-body-sm font-medium text-text-tertiary">When it happens</dt>
                  <dd className="mt-1 text-body-md leading-relaxed text-text-secondary">{row.when}</dd>
                </div>
                <div>
                  <dt className="font-body text-body-sm font-medium text-text-tertiary">What you will see</dt>
                  <dd className="mt-1 text-body-md leading-relaxed text-text-secondary">{row.message}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Section>

      <Section title="If a runtime cannot connect at all">
        <ul className="list-disc space-y-2 pl-5 text-body-md leading-relaxed text-text-secondary">
          <li>
            Check that the agent key is pasted in full, with no trailing space. The raw key is shown once at
            creation — if it is lost, create a new key and revoke the old one.
          </li>
          <li>Restart the runtime after adding the config. Most runtimes read MCP settings at startup.</li>
          <li>
            Confirm the endpoint matches the one shown in your dashboard — one character off and the connection
            fails.
          </li>
          <li>
            If the key was revoked, its status is shown in Settings. Create a fresh key to reconnect.
          </li>
        </ul>
        <p className="text-body-md leading-relaxed text-text-secondary">
          Still stuck? The <Link to="/docs/quickstart" className="font-medium text-accent underline">quickstart</Link>{' '}
          walks through the connection step by step.
        </p>
      </Section>
    </div>
  );
}
