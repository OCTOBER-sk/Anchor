import { useCallback, useState } from 'react';

import { validateOnboarding } from '../lib/api';
import type { OnboardingValidation } from '../lib/api';

export interface UseOnboardingValidateResult {
  /** True while a validation request is in flight. */
  isSubmitting: boolean;
  /** Null until a request completes; then the server's verdict. */
  result: OnboardingValidation | null;
  /** Transport/auth failures only — a soft-fail (`valid: false`) is a 200. */
  error: Error | null;
  validate: (keyId: string) => Promise<void>;
}

/**
 * POST /api/onboarding/validate (frontend.md §4.3 useOnboardingValidate) —
 * a one-shot mutation used by the onboarding flow's validate step (F6).
 * Created in F4 so the contract and types exist ahead of the UI.
 */
export function useOnboardingValidate(): UseOnboardingValidateResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<OnboardingValidation | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const validate = useCallback(async (keyId: string) => {
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    try {
      setResult(await validateOnboarding(keyId));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Validation failed.'));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, result, error, validate };
}
