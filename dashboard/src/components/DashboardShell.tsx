import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSession } from '../hooks/useSession';
import { getSupabase } from '../lib/supabase';
import { ConfigMissingState } from './ConfigMissingState';
import { ThemeToggle } from './ThemeToggle';

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

const iconProps = {
  className: 'h-5 w-5',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function MenuIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

/** The wordmark + nav, shared by the desktop rail and the mobile drawer. */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="px-6 py-6">
        <Link to="/" className="font-display font-semibold text-display-md text-text-primary" onClick={onNavigate}>
          Anchor
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'block rounded-control px-4 py-2 text-body-md text-text-secondary transition-colors',
                isActive ? 'bg-bg-sunken font-medium text-text-primary' : 'hover:bg-bg-sunken',
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
          onClick={onNavigate}
          className="block rounded-control px-4 py-2 text-body-md text-text-secondary hover:bg-bg-sunken"
        >
          Docs
          <span aria-hidden="true" className="ml-1 text-text-tertiary">
            ↗
          </span>
        </a>
      </nav>
    </>
  );
}

/**
 * Mobile slide-over sidebar. Hidden on desktop (lg+); opened from the topbar
 * hamburger. Closes on nav click, overlay click, or Esc.
 */
function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-overlay/50" onClick={onClose} aria-hidden="true" />
      <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border-default bg-bg-base">
        <div className="flex justify-end px-4 pt-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-control p-2 text-text-secondary transition-colors hover:bg-bg-sunken hover:text-text-primary"
          >
            <CloseIcon />
          </button>
        </div>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </div>
  );
}

/** The persistent desktop rail. */
function Sidebar() {
  return (
    <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-border-default bg-bg-base lg:flex">
      <SidebarContent />
    </aside>
  );
}

function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleSignOut() {
    try {
      await getSupabase().auth.signOut();
    } catch {
      // Configuration failure surfaces upstream as the clean config-missing
      // state; there is nothing left to sign out of here.
    }
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
        <span className="max-w-36 truncate sm:max-w-44">{email}</span>
      </button>

      {open && (
        <div role="menu" className="card absolute right-0 top-full z-10 mt-2 w-48 p-2">
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
 * No session → redirect to /login. Desktop shows a persistent rail; mobile
 * collapses it into a topbar hamburger + slide-over drawer.
 */
export function DashboardShell() {
  const { session, loading, error } = useSession();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Dashboard';

  if (error) {
    return <ConfigMissingState />;
  }

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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border-default bg-bg-base px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="rounded-control p-2 text-text-secondary transition-colors hover:bg-bg-sunken hover:text-text-primary lg:hidden"
            >
              <MenuIcon />
            </button>
            <h1 className="truncate font-display font-semibold text-display-md text-text-primary">{pageTitle}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <UserMenu email={session.user.email ?? 'User'} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>

      <MobileSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </div>
  );
}
