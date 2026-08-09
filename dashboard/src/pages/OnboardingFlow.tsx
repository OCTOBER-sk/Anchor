import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CodeBlock } from '../components/CodeBlock';
import { useAgentKeys } from '../hooks/useAgentKeys';
import { useOnboardingValidate } from '../hooks/useOnboardingValidate';
import type { CreatedAgentKey } from '../lib/api';
import { getSupabase } from '../lib/supabase';
import { generateSnippet, getEndpointUrl, RUNTIMES, type Runtime } from '../lib/snippets';

/**
 * Onboarding flow — frontend.md §3.5 + §5.
 *
 * Four steps: create a key (reveal-once with the §5A premium gate), choose a
 * runtime, copy the generated config snippet, and validate the connection
 * with a live check. The skip link is always visible top-right — onboarding
 * is guidance, not a gate. Finishing sets the `onboarding_completed` metadata
 * flag (which AuthCallback checks to route first-login) then lands on the
 * dashboard.
 */

const STEP_LABELS = ['Create key', 'Choose runtime', 'Config snippet', 'Validate'] as const;

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

type StepNumber = 1 | 2 | 3 | 4;
type ConfirmAction = 'back' | 'skip';

function StepIndicator({ current }: { current: StepNumber }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Setup progress">
      {STEP_LABELS.map((label, index) => {
        const stepNumber = (index + 1) as StepNumber;
        const isCurrent = stepNumber === current;
        const isDone = stepNumber < current;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3">
            {index > 0 ? <span aria-hidden="true" className="h-px w-4 bg-border-strong sm:w-10" /> : null}
            <span className="flex items-center gap-2" aria-current={isCurrent ? 'step' : undefined}>
              <span
                className={[
                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-body-sm font-medium transition-colors',
                  isCurrent
                    ? 'border-accent bg-accent text-bg-base'
                    : isDone
                      ? 'border-accent bg-accent-subtle text-accent'
                      : 'border-border-default bg-bg-sunken text-text-tertiary',
                ].join(' ')}
              >
                {isDone ? '✓' : stepNumber}
              </span>
              <span
                className={[
                  'hidden text-body-sm sm:inline',
                  isCurrent ? 'font-medium text-text-primary' : 'text-text-tertiary',
                ].join(' ')}
              >
                {label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The §5A.2 reveal card — raw key shown exactly once, copy + warning + gate. */
function KeyRevealCard({
  created,
  copied,
  onCopy,
  onDone,
  onBack,
}: {
  created: CreatedAgentKey;
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
  onBack: () => void;
}) {
  return (
    <div className="card relative p-8">
      <header>
        <h2 className="font-display font-semibold text-display-md text-text-primary">Your agent key</h2>
        <p className="mt-1 text-body-sm text-text-secondary">Copy it now — you'll use it to connect a runtime.</p>
      </header>

      <div className="mt-6 rounded-card border border-status-warning bg-[#B453091F] px-4 py-3 text-body-sm text-status-warning">
        You won't be able to see this key again after you close this window.
      </div>

      <figure className="relative mt-6 overflow-hidden rounded-control bg-code-bg">
        <div className="absolute right-3 top-3">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-control border border-border-default/40 px-3 py-1.5 font-body text-body-sm text-code-text transition-colors hover:border-border-default/80 hover:text-code-accent"
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 pr-24 font-mono text-mono-sm leading-6 text-code-text">
          <code>{created.key}</code>
        </pre>
      </figure>

      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-body-sm font-medium text-text-secondary hover:text-text-primary">
          Back
        </button>
        <button type="button" onClick={onDone} className="btn-primary">
          Done — I've stored it
        </button>
      </div>
    </div>
  );
}

export function OnboardingFlow() {
  const navigate = useNavigate();
  const { createKey } = useAgentKeys();
  const validate = useOnboardingValidate();

  const [step, setStep] = useState<StepNumber>(1);
  const [createdKey, setCreatedKey] = useState<CreatedAgentKey | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);

  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmAction | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();
  const nameTooShort = trimmedName.length < MIN_NAME_LENGTH;
  const nameTooLong = name.length > MAX_NAME_LENGTH;
  const nameValid = !nameTooShort && !nameTooLong;

  const endpointUrl = getEndpointUrl();
  const runtimeOption = runtime !== null ? RUNTIMES.find((option) => option.id === runtime) : undefined;

  useEffect(() => {
    if (step === 1 && !revealed) {
      nameInputRef.current?.focus();
    }
  }, [step, revealed]);

  // Esc on the reveal card without a copy is the same as Back: gated.
  useEffect(() => {
    if (step !== 1 || !revealed) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') requestLeave('back');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  async function handleCreate() {
    if (!nameValid || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const key = await createKey(trimmedName);
      setCreatedKey(key);
      setCopied(false);
      setRevealed(true);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the agent key. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopy() {
    if (createdKey === null) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
    } catch {
      // Clipboard unavailable — the key is still readable on screen.
    }
  }

  function requestLeave(action: ConfirmAction) {
    if (step === 1 && revealed && !copied) {
      setConfirming(action);
      return;
    }
    if (action === 'back') {
      setRevealed(false);
    } else {
      navigate('/dashboard');
    }
  }

  function confirmLeave() {
    if (confirming === 'back') {
      setRevealed(false);
    } else if (confirming === 'skip') {
      navigate('/dashboard');
    }
    setConfirming(null);
  }

  function handleValidate() {
    if (createdKey === null) return;
    void validate.validate(createdKey.id);
  }

  const validateState: 'idle' | 'submitting' | 'success' | 'soft' | 'error' = validate.error
    ? 'error'
    : validate.isSubmitting
      ? 'submitting'
      : validate.result === null
        ? 'idle'
        : validate.result.valid
          ? 'success'
          : 'soft';

  async function handleFinish() {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      // Best-effort routing flag only — never gate the user on it.
      await getSupabase().auth.updateUser({ data: { onboarding_completed: true } });
    } catch {
      // Ignored: the flow is guidance, not a gate.
    }
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <StepIndicator current={step} />
        <button
          type="button"
          onClick={() => requestLeave('skip')}
          className="shrink-0 text-body-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          Skip for now
        </button>
      </div>

      <div className="mt-10">
        {step === 1 && !revealed ? (
          <div className="card p-8">
            <header>
              <h2 className="font-display font-semibold text-display-md text-text-primary">Create an agent key</h2>
              <p className="mt-1 text-body-sm text-text-secondary">
                Give this key a name you'll recognize — for example, "Claude Code Laptop".
              </p>
            </header>

            <div className="mt-6">
              <label htmlFor="onboarding-key-name" className="block text-body-sm font-medium text-text-primary">
                Name
              </label>
              <input
                ref={nameInputRef}
                id="onboarding-key-name"
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

            {createError ? (
              <p className="mt-4 rounded-card border border-status-error bg-[#B91C1C1F] px-4 py-3 text-body-sm text-status-error" role="alert">
                {createError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => void handleCreate()} disabled={!nameValid || isCreating} className="btn-primary">
                {isCreating ? 'Creating…' : 'Create agent key'}
              </button>
            </div>
          </div>
        ) : step === 1 && createdKey !== null ? (
          <KeyRevealCard
            created={createdKey}
            copied={copied}
            onCopy={() => void handleCopy()}
            onDone={() => setStep(2)}
            onBack={() => requestLeave('back')}
          />
        ) : step === 2 ? (
          <div>
            <header>
              <h2 className="font-display font-semibold text-display-md text-text-primary">Choose a runtime</h2>
              <p className="mt-1 text-body-sm text-text-secondary">
                Anchor works with the runtimes you already use. Pick the one you'll connect.
              </p>
            </header>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {RUNTIMES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={runtime === option.id}
                  onClick={() => setRuntime(option.id)}
                  className={[
                    'flex flex-col gap-1 rounded-card border bg-bg-raised p-6 text-left transition-colors',
                    runtime === option.id ? 'border-accent bg-accent-subtle' : 'border-border-default hover:border-border-strong',
                  ].join(' ')}
                >
                  <span className="font-body text-body-md font-medium text-text-primary">{option.name}</span>
                  <span className="text-body-sm text-text-tertiary">{option.description}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setStep(1)} className="text-body-sm font-medium text-text-secondary hover:text-text-primary">
                Back
              </button>
              <button type="button" onClick={() => setStep(3)} disabled={runtime === null} className="btn-primary">
                Continue
              </button>
            </div>
          </div>
        ) : step === 3 ? (
          <div>
            <header>
              <h2 className="font-display font-semibold text-display-md text-text-primary">Add Anchor to your runtime</h2>
              <p className="mt-1 text-body-sm text-text-secondary">One config block, one endpoint — only the file differs per runtime.</p>
            </header>

            {runtimeOption !== undefined && createdKey !== null ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-card border border-border-default bg-bg-sunken px-4 py-3 text-body-sm text-text-secondary">
                  <span className="font-medium text-text-primary">{runtimeOption.name}.</span> {runtimeOption.where}
                </div>

                {endpointUrl ? (
                  <>
                    <CodeBlock code={generateSnippet(runtimeOption.id, endpointUrl, createdKey.key)} />
                    <p className="text-body-sm text-text-tertiary">
                      Restart your runtime after saving the config, then open a session.
                    </p>
                  </>
                ) : (
                  <div className="rounded-card border border-dashed border-border-strong bg-bg-raised px-6 py-10 text-center">
                    <p className="text-body-md font-medium text-text-primary">Anchor isn't configured yet.</p>
                    <p className="mt-1 text-body-sm text-text-secondary">
                      Once an endpoint is set, your config snippet will appear here.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setStep(2)} className="text-body-sm font-medium text-text-secondary hover:text-text-primary">
                Back
              </button>
              <button type="button" onClick={() => setStep(4)} className="btn-primary">
                Continue
              </button>
            </div>
          </div>
        ) : step === 4 ? (
          <div>
            <header>
              <h2 className="font-display font-semibold text-display-md text-text-primary">Validate the connection</h2>
              <p className="mt-1 text-body-sm text-text-secondary">
                Anchor checks the endpoint with your new key before you leave.
              </p>
            </header>

            <div className="card mt-6 p-6">
              {validateState === 'idle' ? (
                <div className="flex flex-col items-start gap-4">
                  <p className="text-body-sm text-text-secondary">
                    Run a live check — it confirms your key works and lists the capabilities you'll get.
                  </p>
                  <button type="button" onClick={handleValidate} className="btn-primary">
                    Validate connection
                  </button>
                </div>
              ) : null}

              {validateState === 'submitting' ? (
                <div className="flex items-center gap-3">
                  <div
                    role="status"
                    aria-label="Checking the connection"
                    className="h-4 w-4 rounded-full border-2 border-border-accent border-t-accent animate-spin"
                  />
                  <p className="text-body-sm text-text-secondary">Checking the connection…</p>
                </div>
              ) : null}

              {validateState === 'success' ? (
                <div className="rounded-card border border-status-success bg-[#1A6B4A1F] px-4 py-3">
                  <p className="text-body-sm font-medium text-status-success">Connected — 5 capabilities available.</p>
                </div>
              ) : null}

              {validateState === 'soft' && validate.result !== null && !validate.result.valid ? (
                <div className="rounded-card border border-status-warning bg-[#B453091F] px-4 py-3">
                  <p className="text-body-sm font-medium text-status-warning">{validate.result.reason}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-body-sm text-text-secondary">
                    <li>Did you paste the config into the right file for your runtime?</li>
                    <li>Did you restart the runtime after changing the config?</li>
                  </ul>
                  <button type="button" onClick={handleValidate} className="btn-secondary btn-small mt-3">
                    Try again
                  </button>
                </div>
              ) : null}

              {validateState === 'error' && validate.error ? (
                <div className="rounded-card border border-status-error bg-[#B91C1C1F] px-4 py-3">
                  <p className="text-body-sm font-medium text-status-error">The check couldn't complete.</p>
                  <p className="mt-1 text-body-sm text-text-secondary">{validate.error.message}</p>
                  <button type="button" onClick={handleValidate} className="btn-secondary btn-small mt-3">
                    Try again
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setStep(3)} className="text-body-sm font-medium text-text-secondary hover:text-text-primary">
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={validateState !== 'success' || isFinishing}
                className="btn-primary"
              >
                {isFinishing ? 'Finishing…' : 'Finish'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {confirming !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1880] px-6">
          <div role="dialog" aria-modal="true" aria-labelledby="onboarding-dismiss-title" className="card w-full max-w-sm p-6">
            <h3 id="onboarding-dismiss-title" className="font-display font-semibold text-display-md text-text-primary">
              This key won't be shown again.
            </h3>
            <p className="mt-2 text-body-sm text-text-secondary">Copy it now?</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirming(null)} className="btn-secondary">
                Keep viewing
              </button>
              <button type="button" onClick={confirmLeave} className="btn-primary">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
