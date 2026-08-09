import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

/**
 * Docs layout — frontend.md §3.7. Grouped sidebar (Overview / Capabilities /
 * Reference), anchor links into the API reference, and a clean collapsible
 * sidebar on mobile. No hamburger drama.
 */

interface SidebarItem {
  to: string;
  label: string;
  end?: boolean;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

const groups: SidebarGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/docs', label: 'Introduction', end: true },
      { to: '/docs/quickstart', label: 'Quickstart' },
    ],
  },
  {
    label: 'Capabilities',
    items: [
      { to: '/docs/capabilities/search', label: 'Search' },
      { to: '/docs/capabilities/dev-search', label: 'Dev Search' },
      { to: '/docs/capabilities/memory', label: 'Memory' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { to: '/docs/api-reference', label: 'API Reference' },
      { to: '/docs/troubleshooting', label: 'Troubleshooting' },
    ],
  },
];

const apiAnchors = [
  { hash: '#authentication', label: 'Authentication' },
  { hash: '#transport', label: 'Transport' },
  { hash: '#error-codes', label: 'Error codes' },
  { hash: '#rate-limits', label: 'Rate limits' },
];

function SidebarLink({ item }: { item: SidebarItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          'block rounded-control px-4 py-2 text-body-md text-text-secondary transition-colors',
          isActive ? 'bg-bg-sunken font-medium text-text-primary' : 'hover:bg-bg-sunken hover:text-text-primary',
        ].join(' ')
      }
    >
      {item.label}
    </NavLink>
  );
}

function Sidebar({ open }: { open: boolean }) {
  const { hash } = useLocation();

  return (
    <aside className={`${open ? 'block' : 'hidden'} w-full shrink-0 border-b border-border-default lg:block lg:w-64 lg:border-b-0 lg:border-r`}>
      <div className="px-6 py-6">
        <Link to="/" className="font-display font-semibold text-display-md text-text-primary">
          Anchor
        </Link>
        <p className="mt-1 text-body-sm text-text-tertiary">Docs</p>
      </div>
      <nav className="px-3 pb-8">
        {groups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="px-4 pb-2 font-body text-body-sm font-medium uppercase tracking-wide text-text-tertiary">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) =>
                item.to === '/docs/api-reference' ? (
                  <div key={item.to}>
                    <SidebarLink item={item} />
                    <div className="ml-4 mt-1 space-y-0.5 border-l border-border-default pl-3">
                      {apiAnchors.map((anchor) => (
                        <Link
                          key={anchor.hash}
                          to={`/docs/api-reference${anchor.hash}`}
                          className={[
                            'block rounded-control px-3 py-1.5 text-body-sm text-text-tertiary transition-colors hover:text-text-primary',
                            hash === anchor.hash ? 'text-text-primary' : '',
                          ].join(' ')}
                        >
                          {anchor.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <SidebarLink key={item.to} item={item} />
                ),
              )}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function DocsLayout() {
  const [open, setOpen] = useState(false);
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className="min-h-screen bg-bg-base lg:flex">
      <header className="flex h-16 items-center justify-between border-b border-border-default px-6 lg:hidden">
        <Link to="/docs" className="font-display font-semibold text-display-md text-text-primary">
          Docs
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="btn-secondary btn-small"
          aria-expanded={open}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </header>

      <Sidebar open={open} />

      <main className="min-w-0 flex-1 px-6 py-10 sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto w-full max-w-3xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
