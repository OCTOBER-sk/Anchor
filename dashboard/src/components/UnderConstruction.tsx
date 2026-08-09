interface UnderConstructionProps {
  phase: string;
}

/**
 * Deliberate placeholder for surfaces that are built in later phases
 * (F3/F5/F6). Renders only the page title and a one-line note — no
 * placeholder/lorem copy.
 */
export function UnderConstruction({ phase }: UnderConstructionProps) {
  return (
    <div className="card p-8 max-w-xl">
      <p className="text-body-sm text-text-tertiary">Under construction in {phase}.</p>
    </div>
  );
}
