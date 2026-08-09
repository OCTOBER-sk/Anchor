import { CopyButton } from './CopyButton';

/**
 * Code block — frontend.md §2.4: always code-bg/code-text, JetBrains Mono,
 * 8px radius, copy button top-right (behavior per §5.3).
 */
export function CodeBlock({ code }: { code: string }) {
  return (
    <figure className="relative overflow-hidden rounded-control bg-code-bg">
      <div className="absolute right-3 top-3">
        <CopyButton text={code} tone="code" />
      </div>
      <pre className="overflow-x-auto p-4 pr-24 font-mono text-mono-md leading-6 text-code-text">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
