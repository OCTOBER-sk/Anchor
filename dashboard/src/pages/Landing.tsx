import { Link } from 'react-router-dom';

/**
 * Landing shell — frontend.md §3.1. The hero headline, capability grid
 * (exactly 3 cards), HowItWorks steps, and runtime strip arrive in F3.
 * This phase only establishes the route, the wordmark, and the /login CTA.
 */
export function Landing() {
  return (
    <div className="min-h-screen bg-bg-base">
      <nav className="flex h-16 items-center justify-between px-8">
        <span className="font-display font-semibold text-display-md text-text-primary">Anchor</span>
        <div className="flex items-center gap-6">
          <Link to="/docs" className="text-body-md text-text-secondary hover:text-text-primary">
            Docs
          </Link>
          <Link to="/login" className="btn-primary btn-small">
            Sign in
          </Link>
        </div>
      </nav>
    </div>
  );
}
