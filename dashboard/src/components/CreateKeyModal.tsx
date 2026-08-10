import { useEffect, useRef, useState } from 'react';

import { CodeBlock } from './CodeBlock';
import type { AgentTier, CreatedAgentKey } from '../lib/api';
import { generateSnippet, getEndpointUrl } from '../lib/snippets';

/**
 * CreateKeyModal — frontend.md §5A.2 (premium standard).
 *
 * Three steps:
 *   1. Name & type — free-form display name (2-60 chars, live validation +
 *      counter) and a tier picker (standard / admin / debug). Closing with
 *      unsaved input triggers a discard-gate: "Discard this draft?".
 *   2. Your key — the raw key is shown exactly once with a copy button
 *      ("Copied ✓"), a warning banner, and a "Done — I've stored it" primary
 *      button that advances to the connect step. Closing without copying
 *      triggers the dismiss-gate: "This key won't be shown again. Copy it
 *      now?" (Keep viewing / Dismiss).
 *   3. Connect your agent — copy-ready config blocks (MCP /mcp.json shape and
 *      OpenCode opencode.json) plus the setup prompt to paste into the first
 *      session. Done closes the modal.
 *
 * The raw key lives only in this component's state and is discarded the
 * moment the modal closes. It is never held by the hook.
 */

interface CreateKeyModalProps {
  open: boolean;
  onClose: () => void;
  /** POST /api/agent-keys — resolves with the raw key, returned once. */
  onCreate: (name: string, tier: AgentTier) => Promise<CreatedAgentKey>;
}

type Step = 'name' | 'reveal' | 'connect';
type ConfirmKind = 'discard' | 'reveal';

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

const NAME_HINT = "Give this key a name you'll recognize — e.g. 'Claude Code Laptop'.";

const TIERS: { id: AgentTier; label: string; description: string }[] = [
  { id: 'standard', label: 'Standard', description: 'Everyday agent use' },
  { id: 'admin', label: 'Admin', description: 'Full access, for trusted runtimes' },
  { id: 'debug', label: 'Debug', description: 'Verbose provider labels for troubleshooting' },
];

/** Exact copy — tells agents about Anchor from their very first session. */
const SETUP_PROMPT =
  'You are connected to Anchor, a persistent memory layer for AI agents. At the start of every session: 1) call anchor_guide to load your capabilities, 2) call anchor_recall with a short description of the task to retrieve relevant memory, and 3) save what you learn with anchor_remember so future sessions start smarter. Use anchor_search and anchor_dev_search for current, cited information.';

const STEP_LABELS: Record<Step, { number: string; title: string }> = {
  name: { number: 'Step 1 of 3', title: 'New agent key' },
  reveal: { number: 'Step 2 of 3', title: 'Your agent key' },
  connect: { number: 'Step 3 of 3', title: 'Connect your agent' },
};

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
  const [tier, setTier] = useState<AgentTier>('standard');
  const [created, setCreated] = useState<CreatedAgentKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();
  const nameTooShort = trimmedName.length < MIN_NAME_LENGTH;
  const nameTooLong = name.length > MAX_NAME_LENGTH;
  const nameValid = !nameTooShort && !nameTooLong;

  const endpointUrl = getEndpointUrl();
  const mcpConfig = created !== null && endpointUrl !== null ? generateSnippet('claude-code', endpointUrl, created.key) : null;
  const opencodeConfig = created !== null && endpointUrl !== null ? generateSnippet('opencode', endpointUrl, created.key) : null;

  useEffect(() => {
    if (open) {
      setStep('name');
      setName('');
      setTier('standard');
      setCreated(null);
      setCopied(false);
      setCreateError(null);
      setConfirmKind(null);
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
      setConfirmKind('reveal');
      return;
    }
    if (step === 'name' && trimmedName.length > 0) {
      setConfirmKind('discard');
      return;
    }
    onClose();
  }

  async function handleCreate() {
    if (!nameValid || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const key = await onCreate(trimmedName, tier);
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
        aria-labelledby="create-key-title"
        className="card relative w-full max-w-lg p-8"
      >
        {step === 'name' ? (
          <div className="flex flex-col gap-6">
            <header>
              <p className="font-mono text-mono-sm text-text-tertiary">{STEP_LABELS.name.number}</p>
              <h2 id="create-key-title" className="font-display font-medium text-display-md text-text-primary">
                {STEP_LABELS.name.title}
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

            <fieldset>
              <legend className="text-body-sm font-medium text-text-primary">Tier</legend>
              <div className="mt-2 space-y-2">
                {TIERS.map((option) => (
                  <label
                    key={option.id}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-card border px-4 py-3 transition-colors',
                      tier === option.id ? 'border-accent bg-accent-subtle' : 'border-border-default hover:border-border-strong',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="agent-key-tier"
                      value={option.id}
                      checked={tier === option.id}
                      onChange={() => setTier(option.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    <span className="text-body-md font-medium text-text-primary">{option.label}</span>
                    <span className="text-body-sm text-text-tertiary">— {option.description}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {createError ? (
              <p className="rounded-card border border-status-error bg-status-error/12 px-4 py-3 text-body-sm text-status-error" role="alert">
                {createError}
              </p>
            ) : null}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={attemptClose} className="btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={() => void handleCreate()} disabled={!nameValid || isCreating} className="btn-primary">
                {isCreating ? 'Creating…' : 'Create agent key'}
              </button>
            </div>
          </div>
        ) : step === 'reveal' && created !== null ? (
          <div className="flex flex-col gap-6">
            <header>
              <p className="font-mono text-mono-sm text-text-tertiary">{STEP_LABELS.reveal.number}</p>
              <h2 id="create-key-title" className="font-display font-medium text-display-md text-text-primary">
                {STEP_LABELS.reveal.title}
              </h2>
              <p className="mt-1 text-body-sm text-text-secondary">Copy it now — you'll use it to connect a runtime.</p>
            </header>

            <div className="rounded-card border border-border-accent bg-accent/8 px-4 py-3 text-body-sm text-text-secondary">
              Copy your key now — it's also always re-viewable later from the keys list.
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
                <code>{created.key}</code>
              </pre>
            </figure>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={attemptClose} className="btn-secondary">
                Close
              </button>
              <button type="button" onClick={() => setStep('connect')} className="btn-primary">
                Done — I've stored it
              </button>
            </div>
          </div>
        ) : created !== null ? (
          <div className="flex flex-col gap-6">
            <header>
              <p className="font-mono text-mono-sm text-text-tertiary">{STEP_LABELS.connect.number}</p>
              <h2 id="create-key-title" className="font-display font-medium text-display-md text-text-primary">
                {STEP_LABELS.connect.title}
              </h2>
              <p className="mt-1 text-body-sm text-text-secondary">
                Drop the config into your runtime, then paste the setup prompt into your first session.
              </p>
            </header>

            <div className="space-y-4">
              {endpointUrl !== null && mcpConfig !== null ? (
                <div>
                  <p className="font-mono text-mono-sm text-text-tertiary">Claude Code — .mcp.json</p>
                  <div className="mt-2">
                    <CodeBlock code={mcpConfig} />
                  </div>
                </div>
              ) : null}
              {endpointUrl !== null && opencodeConfig !== null ? (
                <div>
                  <p className="font-mono text-mono-sm text-text-tertiary">OpenCode — opencode.json</p>
                  <div className="mt-2">
                    <CodeBlock code={opencodeConfig} />
                  </div>
                </div>
              ) : null}
              {endpointUrl === null ? (
                <div className="rounded-card border border-dashed border-border-strong bg-bg-raised px-6 py-10 text-center">
                  <p className="text-body-md font-medium text-text-primary">Anchor isn't configured yet.</p>
                  <p className="mt-1 text-body-sm text-text-secondary">
                    Once an endpoint is set, your config snippets will appear here.
                  </p>
                </div>
              ) : null}
              <div>
                <p className="font-mono text-mono-sm text-text-tertiary">Setup prompt — paste into your first session</p>
                <div className="mt-2">
                  <CodeBlock code={SETUP_PROMPT} />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={() => onClose()} className="btn-primary">
                Done
              </button>
            </div>
          </div>
        ) : null}

        {confirmKind === 'reveal' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-card bg-bg-base/95 p-8">
            <div className="card w-full max-w-sm p-6">
              <h3 className="font-display font-medium text-display-md text-text-primary">
                This key won't be shown again.
              </h3>
              <p className="mt-2 text-body-sm text-text-secondary">Copy it now?</p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setConfirmKind(null)} className="btn-secondary">
                  Keep viewing
                </button>
                <button type="button" onClick={() => onClose()} className="btn-primary">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ) : confirmKind === 'discard' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-card bg-bg-base/95 p-8">
            <div className="card w-full max-w-sm p-6">
              <h3 className="font-display font-medium text-display-md text-text-primary">Discard this draft?</h3>
              <p className="mt-2 text-body-sm text-text-secondary">Your key name and tier won't be saved.</p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setConfirmKind(null)} className="btn-secondary">
                  Keep editing
                </button>
                <button type="button" onClick={() => onClose()} className="btn-primary">
                  Discard
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
