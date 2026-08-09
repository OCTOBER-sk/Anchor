import { useState } from 'react';

/**
 * Copy-to-clipboard button — frontend.md §5.3. Flips to "Copied" for two
 * seconds, then reverts. No toast, no modal — the button is the only
 * feedback. The `code` tone is styled to sit on dark code blocks.
 */
export function CopyButton({ text, tone = 'default' }: { text: string; tone?: 'default' | 'code' }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const base = 'rounded-control px-3 py-1.5 font-body text-body-sm transition-colors';
  const tones = {
    default:
      'border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary',
    code: 'border border-border-default/40 text-code-text hover:border-border-default/80 hover:text-code-accent',
  };

  return (
    <button type="button" onClick={handleCopy} className={`${base} ${tones[tone]}`}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
