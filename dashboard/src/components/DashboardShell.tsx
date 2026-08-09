import { useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSession } from '../hooks/useSession';
import { supabase } from '../lib/supabase';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Home', end: true },
  { to: '/dashboard/onboarding', label: 'Onboarding' },
  { to: '/dashboard/settings', label: 'Settings' },
] as const;

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Home',
  '/dashboard/onboarding': 'Onboarding',
  '/dashboard/settings': 'Settings',
};

function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border-default bg-bg-base h-full flex flex-col">
      <div className="px-6 py-6">
        <Link to="/" className="font-display font-semibold text-display-md text-text-primary">
          Anchor
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            className={({ isActive }) =>
              [
                'block rounded-control px-4 py-2 text-body-md text-text-secondary transition-colors',
                isActive ? 'bg-bg-sunken text-text-primary font-medium' : 'hover:bg-bg-sunken',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}

        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="block rounded-control px-4 py-2 text-body-md text-text-secondary hover:bg-bg-sunken"
        >
          Docs
          <span aria-hidden="true" className="ml-1 text-text-tertiary">
            ↗
          </span>
        </a>
      </nav>
    </aside>
  );
}

function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-control px-3 py-2 text-body-sm text-text-primary hover:bg-bg-sunken"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-subtle text-accent font-medium"
        >
          {(email[0] ?? '?').toUpperCase()}
        </span>
        <span className="max-w-44 truncate">{email}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-48 card p-2 z-10"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleSignOut()}
            className="w-full rounded-control px-3 py-2 text-left text-body-sm text-status-error hover:bg-bg-sunken"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Session-gated shell for all /dashboard/* pages (frontend.md §3.4).
 * No session → redirect to /login. Renders sidebar + topbar around <Outlet/>.
 */
export function DashboardShell() {
  const { session, loading } = useSession();
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Dashboard';

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div
          role="status"
          aria-label="Loading your dashboard"
          className="h-8 w-8 rounded-full border-2 border-border-accent border-t-accent animate-spin"
        />
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-bg-base">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border-default bg-bg-base px-8">
          <h1 className="font-display font-semibold text-display-md text-text-primary">{pageTitle}</h1>
          <UserMenu email={session.user.email ?? 'User'} />
        </header>

        <main className="flex-1 px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
