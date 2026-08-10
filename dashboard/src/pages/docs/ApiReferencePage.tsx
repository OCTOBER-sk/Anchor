import { CodeBlock } from '../../components/CodeBlock';
import {
  authenticationData,
  errorRows,
  initializeData,
  rateLimitData,
  toolsData,
  toolsListData,
  transportData,
} from '../../content/api-reference-data';
import { KeyValueTable, OutputTable, PageHeader, Prerequisites, SchemaTable, Section, WhatYouWillAccomplish } from './docs-ui';

/**
 * API reference — frontend.md §3.7. The MCP protocol surface from backend.md
 * §8: authentication, transport, initialize, tools/list, per-tool schemas and
 * output shapes, the full error table, and rate limits. This is the one docs
 * surface that mirrors the protocol's own vocabulary.
 */

const errorHeaders = ['Code', 'JSON-RPC', 'When', 'Client-visible message'];

function ErrorCodeTable() {
  return (
    <div className="overflow-x-auto rounded-card border border-border-default">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead className="bg-bg-sunken">
          <tr>
            {errorHeaders.map((header) => (
              <th key={header} className="px-4 py-3 text-left font-body text-body-sm font-medium text-text-tertiary">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default bg-bg-raised">
          {errorRows.map((row) => (
            <tr key={row.code}>
              <td className="px-4 py-3 align-top">
                <code className="font-mono text-mono-sm text-code-accent">{row.code}</code>
              </td>
              <td className="px-4 py-3 align-top">
                <code className="font-mono text-mono-sm text-text-primary">{row.jsonrpc}</code>
              </td>
              <td className="px-4 py-3 align-top">
                <p className="text-body-sm leading-relaxed text-text-secondary">{row.when}</p>
              </td>
              <td className="px-4 py-3 align-top">
                <p className="text-body-sm leading-relaxed text-text-secondary">{row.message}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApiReferencePage() {
  return (
    <div>
      <PageHeader
        title="API reference"
        lead="The protocol surface behind the Anchor capabilities. Every tool, schema, error, and limit below is what a connected runtime actually sees."
      />

      <WhatYouWillAccomplish>
        Understand the full protocol surface a connected runtime sees: authentication, transport, tools, schemas,
        errors, and limits.
      </WhatYouWillAccomplish>
      <Prerequisites items={['Familiarity with the quickstart connection', 'An agent key to test with (optional)']} />

      <Section id="authentication" title="Authentication">
        <p className="prose-copy">
          Every request to the MCP endpoint must carry an agent key as a bearer token. This is the same key you
          create in the dashboard — one per runtime.
        </p>
        <CodeBlock code={authenticationData.headerExample} />
        <p className="prose-copy">
          Keys take the form <code className="code-inline">{authenticationData.keyFormat}</code>: a URL-safe
          slug identifying the runtime, then a 32-character hex secret.
        </p>
        <ul className="list-disc space-y-2 pl-5 prose-copy">
          {authenticationData.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Section>

      <Section id="transport" title="Transport">
        <KeyValueTable rows={transportData.rows} />
        <ul className="list-disc space-y-2 pl-5 prose-copy">
          {transportData.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Section>

      <Section id="initialize" title="initialize">
        <p className="prose-copy">
          The handshake a runtime performs first. It negotiates the protocol version and returns the server
          identity.
        </p>
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-body text-body-lg font-medium text-text-primary">Request</h3>
            <OutputTable fields={initializeData.requestFields} />
            <CodeBlock code={initializeData.requestExample} />
          </div>
          <div className="space-y-3">
            <h3 className="font-body text-body-lg font-medium text-text-primary">Response</h3>
            <OutputTable fields={initializeData.responseFields} />
            <CodeBlock code={initializeData.responseExample} />
          </div>
        </div>
      </Section>

      <Section id="tools-list" title="tools/list">
        <p className="prose-copy">
          Returns exactly five tools. Each carries its input schema, so a runtime knows how to call it without
          any external documentation.
        </p>
        <div className="space-y-4">
          {toolsListData.map((tool) => (
            <div key={tool.name} className="card p-6">
              <p className="font-mono text-mono-md font-medium text-code-accent">{tool.name}</p>
              <p className="mt-2 text-body-sm leading-relaxed text-text-secondary">{tool.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="tools" title="Tools">
        <div className="space-y-16">
          {toolsData.map((tool) => (
            <article key={tool.name} className="space-y-8">
              <div className="space-y-3">
                <h3 className="font-mono text-mono-md font-medium text-code-accent">{tool.name}</h3>
                <p className="prose-copy">{tool.description}</p>
              </div>

              <div className="space-y-4">
                <h4 className="font-body text-body-lg font-medium text-text-primary">Behavior</h4>
                <ul className="list-disc space-y-2 pl-5 text-body-sm leading-relaxed text-text-secondary">
                  {tool.behavior.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-body text-body-lg font-medium text-text-primary">Input</h4>
                <SchemaTable rows={tool.inputRows} />
                <CodeBlock code={tool.inputExample} />
              </div>

              <div className="space-y-4">
                <h4 className="font-body text-body-lg font-medium text-text-primary">Output</h4>
                <OutputTable fields={tool.outputFields} />
                <CodeBlock code={tool.outputExample} />
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section id="error-codes" title="Error codes">
        <p className="prose-copy">
          Every error maps to a JSON-RPC code. The message is always safe to display — internal detail is
          logged on the server and never returned.
        </p>
        <ErrorCodeTable />
      </Section>

      <Section id="rate-limits" title="Rate limits">
        <KeyValueTable rows={rateLimitData.rows} />
        <ul className="list-disc space-y-2 pl-5 prose-copy">
          {rateLimitData.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
