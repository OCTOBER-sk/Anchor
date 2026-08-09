import { Navigate, useParams } from 'react-router-dom';

import { CodeBlock } from '../../components/CodeBlock';
import { capabilityPages } from '../../content/capability-pages-data';
import { Chip, ErrorTable, KeyValueTable, OutputTable, PageHeader, SchemaTable, Section } from './docs-ui';

/**
 * Shared capability page — frontend.md §3.7. Renders one capability from
 * `capability-pages-data.ts` for the three routes under /docs/capabilities.
 * What/problem → schema tables → examples → worked examples → errors →
 * limits.
 */
export function CapabilityPage() {
  const { capabilityId } = useParams();
  const data = capabilityPages.find((page) => page.route === capabilityId);

  if (!data) {
    return <Navigate to="/docs" replace />;
  }

  return (
    <div>
      <PageHeader title={data.name} lead={data.description} />

      <Section title="Best for">
        <div className="flex flex-wrap gap-2">
          {data.bestFor.map((item) => (
            <Chip key={item}>{item}</Chip>
          ))}
        </div>
      </Section>

      <Section title="What it does">
        <p className="text-body-md leading-relaxed text-text-secondary">{data.whatItDoes}</p>
      </Section>

      <Section title="The problem it solves">
        <p className="text-body-md leading-relaxed text-text-secondary">{data.problemItSolves}</p>
      </Section>

      <Section title="Input">
        <div className="space-y-8">
          {data.inputSections.map((section, index) => (
            <div key={section.group ?? `input-${index}`} className="space-y-4">
              {section.group ? (
                <h3 className="font-mono text-mono-md text-code-accent">{section.group}</h3>
              ) : null}
              <SchemaTable rows={section.rows} />
            </div>
          ))}
          {data.inputExamples.map((example) => (
            <div key={example.code} className="space-y-3">
              {example.label ? (
                <p className="font-mono text-mono-sm text-text-tertiary">{example.label}</p>
              ) : null}
              <CodeBlock code={example.code} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Output">
        <div className="space-y-8">
          {data.outputSections.map((section, index) => (
            <div key={section.group ?? `output-${index}`} className="space-y-4">
              {section.group ? (
                <h3 className="font-mono text-mono-md text-code-accent">{section.group}</h3>
              ) : null}
              <OutputTable fields={section.fields} />
            </div>
          ))}
          {data.outputExamples.map((example) => (
            <div key={example.code} className="space-y-3">
              {example.label ? (
                <p className="font-mono text-mono-sm text-text-tertiary">{example.label}</p>
              ) : null}
              <CodeBlock code={example.code} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Worked examples">
        <div className="space-y-8">
          {data.workedExamples.map((example) => (
            <div key={example.title} className="space-y-3">
              <h3 className="font-body text-body-lg font-semibold text-text-primary">{example.title}</h3>
              <p className="text-body-sm leading-relaxed text-text-secondary">{example.note}</p>
              <CodeBlock code={example.code} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Errors">
        <p className="text-body-md leading-relaxed text-text-secondary">
          If a call fails, the response includes a code that explains what happened. Every code also carries a
          safe, human-readable message.
        </p>
        <ErrorTable rows={data.errors} />
      </Section>

      <Section title="Limits">
        <KeyValueTable
          rows={data.limits.map((row) => ({
            item: row.item,
            value: row.limit,
          }))}
        />
      </Section>
    </div>
  );
}
