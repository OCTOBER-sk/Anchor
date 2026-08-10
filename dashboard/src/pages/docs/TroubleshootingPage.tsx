import { Link } from 'react-router-dom';

import { errorRows } from '../../content/api-reference-data';
import { PageHeader, Prerequisites, Section, WhatYouWillAccomplish } from './docs-ui';

/**
 * Troubleshooting — frontend.md §3.7. One error card per platform error code
 * (all 7 rows of backend.md §8). Each card: the code, its JSON-RPC mapping,
 * the cause, and the fix. Tone is imperative and calm.
 */

const FIXES: Record<string, string> = {
  SEARCH_UNAVAILABLE:
    'Try again in a moment. Anchor falls back between sources automatically before this surfaces, so a short wait clears it.',
  RATE_LIMITED:
    'Wait for the rate window to reset — the response includes the reset time. To raise the ceiling for this key, update its limit in Settings.',
  QUOTA_EXCEEDED:
    'Wait and retry. The shared capacity budget clears on its own, and Anchor switches to its backup path before this ever surfaces.',
  MEMORY_UNAVAILABLE:
    'Try again in a moment. Direct memory reads and writes failed; background recall degrades quietly and never surfaces this.',
  INVALID_PARAMS: 'Fix the argument the response flags and retry. The response includes field-level detail.',
  INTERNAL_ERROR:
    'Retry the call. If it keeps failing, note the code and the time — full detail is logged on the server.',
  'Authentication failure':
    'Confirm the agent key is pasted in full with no trailing space, and that it is not revoked. Create a fresh key from Settings and update the config.',
};

export function TroubleshootingPage() {
  return (
    <div>
      <PageHeader
        title="Troubleshooting"
        lead="Every error a runtime can hit, what it means, and what to do about it. Messages you see are always safe to display — if one looks generic, that is deliberate."
      />

      <WhatYouWillAccomplish>
        Map every error code to its cause and fix, and recover a runtime that cannot connect.
      </WhatYouWillAccomplish>
      <Prerequisites items={['The error message from your runtime', 'Access to Settings to manage agent keys']} />

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
                  <dt className="font-body text-body-sm font-medium text-text-tertiary">Cause</dt>
                  <dd className="mt-1 prose-copy">{row.when}</dd>
                </div>
                <div>
                  <dt className="font-body text-body-sm font-medium text-text-tertiary">What you will see</dt>
                  <dd className="mt-1 prose-copy">{row.message}</dd>
                </div>
                <div>
                  <dt className="font-body text-body-sm font-medium text-text-tertiary">Fix</dt>
                  <dd className="mt-1 prose-copy">{FIXES[row.code] ?? row.message}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Section>

      <Section title="If a runtime cannot connect at all">
        <ul className="list-disc space-y-2 pl-5 prose-copy">
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
        <p className="prose-copy">
          Still stuck? The <Link to="/docs/quickstart" className="font-medium text-accent underline">quickstart</Link>{' '}
          walks through the connection step by step.
        </p>
      </Section>
    </div>
  );
}
