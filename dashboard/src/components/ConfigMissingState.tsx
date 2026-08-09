import { Link } from 'react-router-dom';

/**
 * Clean, tech-free state shown when the dashboard environment is not
 * configured — frontend.md §2.5. No tech-stack names, no raw error text,
 * no stack traces. Rendered only on auth surfaces; the landing and docs
 * never touch auth and so never reach this.
 */
export function ConfigMissingState() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm card p-8 text-center">
        <Link to="/" className="font-display font-semibold text-display-md text-text-primary">
          Anchor
        </Link>
        <p className="mt-8 font-display font-semibold text-display-md text-text-primary">
          Anchor isn't configured yet.
        </p>
        <p className="mt-3 text-body-md text-text-secondary">
          Set up the dashboard environment to continue.
        </p>
      </div>
    </main>
  );
}
