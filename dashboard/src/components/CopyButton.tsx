import { useState } from 'react';

/**
 * Copy-to-clipboard button — frontend.md §5.3. Flips to "Copied" for two
 * seconds, then reverts. No toast, no modal — the button is the only
 * feedback. The `code` tone is styled to sit on dark code blocks.
 */
export function CopyButton({ text, tone = 'default' }: { text: string; tone?: 'default' | 'code' }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  function flip(label: 'copied' | 'failed') {
    setCopied(label === 'copied');
    setFailed(label === 'failed');
    window.setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 2000);
  }

  async function handleCopy() {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }

    if (!ok) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      document.body.removeChild(textarea);
    }

    flip(ok ? 'copied' : 'failed');
  }

  const base = 'rounded-control px-3 py-1.5 font-body text-body-sm transition-colors';
  const tones = {
    default:
      'border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary',
    code: 'border border-border-default/40 text-code-text hover:border-border-default/80 hover:text-code-accent',
  };

  return (
    <button type="button" onClick={handleCopy} className={`${base} ${tones[tone]}`}>
      {copied ? 'Copied' : failed ? 'Copy failed' : 'Copy'}
    </button>
  );
}
