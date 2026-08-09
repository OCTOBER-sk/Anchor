import { Link } from 'react-router-dom';

/**
 * Dashboard home — frontend.md §3.4. Monitor surface. With no runtimes
 * connected yet, renders the §4.4 empty state (icon + one-line copy +
 * primary action) until F5's activity feed lands.
 */
export function DashboardHome() {
  return (
    <div>
      <h1 className="font-display font-semibold text-display-lg text-text-primary">Dashboard</h1>
      <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
        <span
          aria-hidden="true"
          className="inline-flex h-12 w-12 items-center justify-center rounded-card border border-border-default bg-bg-sunken text-text-secondary"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12h4l2-6 4 12 2-6h6" />
          </svg>
        </span>
        <p className="max-w-sm text-body-md text-text-secondary">
          No activity yet — connect a runtime to get started.
        </p>
        <Link to="/dashboard/onboarding" className="btn-primary btn-small">
          Connect a runtime
        </Link>
      </div>
    </div>
  );
}
