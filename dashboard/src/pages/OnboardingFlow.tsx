/**
 * Onboarding flow — frontend.md §5. The four-step flow (create key, choose
 * runtime, config snippet, validate) arrives in F6. This phase establishes
 * the route and a clean introductory surface.
 */
export function OnboardingFlow() {
  return (
    <div>
      <h1 className="font-display font-semibold text-display-lg text-text-primary">Get started</h1>
      <p className="mt-3 max-w-xl text-body-md text-text-secondary">
        Set up your first agent key in about two minutes.
      </p>
    </div>
  );
}
