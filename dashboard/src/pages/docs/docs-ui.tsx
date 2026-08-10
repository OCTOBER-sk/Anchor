import type { ReactNode } from 'react';

import { CodeBlock } from '../../components/CodeBlock';

/**
 * Shared presentational building blocks for the docs pages — frontend.md
 * §3.7. All styling stays inside the locked token set (§2.1/§2.4).
 */

export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="space-y-4">
      <h1 className="font-display font-semibold text-display-lg text-text-primary">{title}</h1>
      {lead ? <p className="max-w-2xl text-body-lg leading-relaxed text-text-secondary">{lead}</p> : null}
    </header>
  );
}

/** One-line outcome statement that opens every docs page. */
export function WhatYouWillAccomplish({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 max-w-prose text-body-md leading-relaxed text-text-secondary">
      <span className="font-medium text-text-primary">What you'll accomplish: </span>
      {children}
    </p>
  );
}

/** Compact prerequisites box — consistent on every docs page. */
export function Prerequisites({ items }: { items: string[] }) {
  return (
    <div className="mt-6 rounded-card border border-border-default bg-bg-sunken px-5 py-4">
      <p className="font-body text-body-sm font-medium text-text-tertiary">Prerequisites</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-body-sm leading-relaxed text-text-secondary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** A mono-labeled config snippet (CodeBlock already carries the copy button). */
export function Snippet({ label, code }: { label: string; code: string }) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-mono-sm text-text-tertiary">{label}</p>
      <CodeBlock code={code} />
    </div>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-16 scroll-mt-8 first:mt-0">
      <h2 className="font-display font-semibold text-display-md text-text-primary">{title}</h2>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-body text-body-sm font-medium text-text-tertiary">{children}</th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

export interface SchemaRow {
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

export interface ErrorRow {
  code: string;
  cause: string;
  resolution: string;
}

export interface KeyValueRow {
  item: string;
  value: string;
}

function TableShell({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border-default">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead className="bg-bg-sunken">{head}</thead>
        <tbody className="divide-y divide-border-default bg-bg-raised">{children}</tbody>
      </table>
    </div>
  );
}

export function SchemaTable({ rows }: { rows: SchemaRow[] }) {
  return (
    <TableShell
      head={
        <tr>
          <Th>Parameter</Th>
          <Th>Type</Th>
          <Th>Required</Th>
          <Th>Default</Th>
          <Th>Description</Th>
        </tr>
      }
    >
      {rows.map((row) => (
        <tr key={row.param}>
          <Td>
            <code className="font-mono text-mono-sm text-code-accent">{row.param}</code>
          </Td>
          <Td>
            <code className="font-mono text-mono-sm text-text-primary">{row.type}</code>
          </Td>
          <Td>
            <span className={row.required ? 'text-status-success' : 'text-text-tertiary'}>
              {row.required ? 'required' : 'optional'}
            </span>
          </Td>
          <Td>
            {row.defaultValue ? (
              <code className="font-mono text-mono-sm text-text-primary">{row.defaultValue}</code>
            ) : (
              <span className="text-text-tertiary">—</span>
            )}
          </Td>
          <Td>
            <p className="text-body-sm leading-relaxed text-text-secondary">{row.description}</p>
          </Td>
        </tr>
      ))}
    </TableShell>
  );
}

export function OutputTable({ fields }: { fields: OutputField[] }) {
  return (
    <TableShell
      head={
        <tr>
          <Th>Field</Th>
          <Th>Type</Th>
          <Th>Description</Th>
        </tr>
      }
    >
      {fields.map((row) => (
        <tr key={row.field}>
          <Td>
            <code className="font-mono text-mono-sm text-code-accent">{row.field}</code>
          </Td>
          <Td>
            <code className="font-mono text-mono-sm text-text-primary">{row.type}</code>
          </Td>
          <Td>
            <p className="text-body-sm leading-relaxed text-text-secondary">{row.description}</p>
          </Td>
        </tr>
      ))}
    </TableShell>
  );
}

export function ErrorTable({ rows }: { rows: ErrorRow[] }) {
  return (
    <TableShell
      head={
        <tr>
          <Th>Code</Th>
          <Th>Cause</Th>
          <Th>Resolution</Th>
        </tr>
      }
    >
      {rows.map((row) => (
        <tr key={row.code}>
          <Td>
            <code className="font-mono text-mono-sm text-code-accent">{row.code}</code>
          </Td>
          <Td>
            <p className="text-body-sm leading-relaxed text-text-secondary">{row.cause}</p>
          </Td>
          <Td>
            <p className="text-body-sm leading-relaxed text-text-secondary">{row.resolution}</p>
          </Td>
        </tr>
      ))}
    </TableShell>
  );
}

export function KeyValueTable({ rows }: { rows: KeyValueRow[] }) {
  return (
    <TableShell
      head={
        <tr>
          <Th>Item</Th>
          <Th>Value</Th>
        </tr>
      }
    >
      {rows.map((row) => (
        <tr key={row.item}>
          <Td>
            <span className="text-body-sm font-medium text-text-primary">{row.item}</span>
          </Td>
          <Td>
            <code className="font-mono text-mono-sm text-text-primary">{row.value}</code>
          </Td>
        </tr>
      ))}
    </TableShell>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-control border border-border-default bg-bg-sunken px-3 py-1.5 text-body-sm text-text-secondary">
      {children}
    </span>
  );
}
