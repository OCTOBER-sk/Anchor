import { useEffect, useRef, useState } from 'react';

import type { CreatedAgentKey } from '../lib/api';

/**
 * CreateKeyModal — frontend.md §5A.2 (premium standard).
 *
 * Two steps:
 *   1. Name — free-form display name, 2-60 chars, live validation + counter,
 *      optional "Advanced" disclosure showing the defaulted tier and rate
 *      limits.
 *   2. Reveal — the raw key is shown exactly once with a copy button
 *      ("Copied ✓"), a warning banner, and a "Done — I've stored it"
 *      primary button. Closing without copying triggers the dismiss-gate:
 *      "This key won't be shown again. Copy it now?" (Keep viewing / Dismiss).
 *
 * The raw key lives only in this component's state and is discarded the
 * moment the modal closes. It is never held by the hook or re-fetched.
 */

interface CreateKeyModalProps {
  open: boolean;
  onClose: () => void;
  /** POST /api/agent-keys — resolves with the raw key, returned once. */
  onCreate: (name: string) => Promise<CreatedAgentKey>;
}

type Step = 'name' | 'reveal';

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

const NAME_HINT = "Give this key a name you'll recognize — e.g. 'Claude Code Laptop'.";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CreateKeyModal({ open, onClose, onCreate }: CreateKeyModalProps) {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedAgentKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();
  const nameTooShort = trimmedName.length < MIN_NAME_LENGTH;
  const nameTooLong = name.length > MAX_NAME_LENGTH;
  const nameValid = !nameTooShort && !nameTooLong;

  useEffect(() => {
    if (open) {
      setStep('name');
      setName('');
      setCreated(null);
      setCopied(false);
      setCreateError(null);
      setConfirmingClose(false);
      setShowAdvanced(false);
    }
  }, [open]);

  useEffect(() => {
    if (step === 'name' && open) {
      nameInputRef.current?.focus();
    }
  }, [step, open]);

  // Esc closes the modal — gated through the same confirm as the X button.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        attemptClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function attemptClose() {
    if (step === 'reveal' && !copied) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  }

  async function handleCreate() {
    if (!nameValid || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const key = await onCreate(trimmedName);
      setCreated(key);
      setStep('reveal');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the agent key. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopy() {
    if (created === null) return;
    const ok = await copyToClipboard(created.key);
    if (ok) setCopied(true);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 px-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) attemptClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={step === 'name' ? 'create-key-title' : 'create-key-reveal-title'}
        className="card relative w-full max-w-lg p-8"
      >
        {step === 'name' ? (
          <div className="flex flex-col gap-6">
            <header>
              <h2 id="create-key-title" className="font-display font-medium text-display-md text-text-primary">
                New agent key
              </h2>
              <p className="mt-1 text-body-sm text-text-secondary">{NAME_HINT}</p>
            </header>

            <div>
              <label htmlFor="agent-key-name" className="block text-body-sm font-medium text-text-primary">
                Name
              </label>
              <input
                ref={nameInputRef}
                id="agent-key-name"
                type="text"
                autoComplete="off"
                maxLength={MAX_NAME_LENGTH}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleCreate();
                }}
                className={`input mt-2 ${nameTooLong ? 'border-status-error' : ''}`}
                placeholder="Claude Code Laptop"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-body-sm text-text-tertiary">
                  {nameTooShort ? 'At least two characters.' : nameTooLong ? 'Keep it under 60 characters.' : null}
                </p>
                <p className="font-mono text-mono-sm text-text-tertiary">
                  {name.length}/{MAX_NAME_LENGTH}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              className="self-start text-body-sm font-medium text-accent hover:text-accent-hover"
            >
              {showAdvanced ? 'Hide advanced' : 'Advanced'}
            </button>

            {showAdvanced ? (
              <div className="divide-y divide-border-default rounded-card border border-border-default bg-bg-sunken px-4">
                <div className="flex items-center justify-between py-3">
                  <span className="text-body-sm text-text-secondary">Tier</span>
                  <span className="font-mono text-mono-sm text-text-primary">standard</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-body-sm text-text-secondary">Rate limit</span>
                  <span className="font-mono text-mono-sm text-text-primary">30/min · 500/day</span>
                </div>
              </div>
            ) : null}

            {createError ? (
              <p className="rounded-card border border-status-error bg-status-error/12 px-4 py-3 text-body-sm text-status-error" role="alert">
                {createError}
              </p>
            ) : null}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => onClose()} className="btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={() => void handleCreate()} disabled={!nameValid || isCreating} className="btn-primary">
                {isCreating ? 'Creating…' : 'Create agent key'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <header>
              <h2 id="create-key-reveal-title" className="font-display font-medium text-display-md text-text-primary">
                Your agent key
              </h2>
              <p className="mt-1 text-body-sm text-text-secondary">Copy it now — you'll use it to connect a runtime.</p>
            </header>

            <div className="rounded-card border border-status-warning bg-status-warning/12 px-4 py-3 text-body-sm text-status-warning">
              You won't be able to see this key again after you close this window.
            </div>

            <figure className="relative overflow-hidden rounded-control bg-code-bg">
              <div className="absolute right-3 top-3">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="rounded-control border border-border-default/40 px-3 py-1.5 font-body text-body-sm text-code-text transition-colors hover:border-border-default/80 hover:text-code-accent"
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              <pre className="overflow-x-auto p-4 pr-24 font-mono text-mono-sm leading-6 text-code-text">
                <code>{created?.key ?? ''}</code>
              </pre>
            </figure>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={attemptClose} className="btn-secondary">
                Close
              </button>
              <button type="button" onClick={() => onClose()} className="btn-primary">
                Done — I've stored it
              </button>
            </div>
          </div>
        )}

        {confirmingClose ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-card bg-bg-base/95 p-8">
            <div className="card w-full max-w-sm p-6">
              <h3 className="font-display font-medium text-display-md text-text-primary">
                This key won't be shown again.
              </h3>
              <p className="mt-2 text-body-sm text-text-secondary">Copy it now?</p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setConfirmingClose(false)} className="btn-secondary">
                  Keep viewing
                </button>
                <button type="button" onClick={() => onClose()} className="btn-primary">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
