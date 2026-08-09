import { NavLink, Outlet } from 'react-router-dom';

/**
 * Docs layout shell — frontend.md §3.7. Sidebar + content region.
 * Actual doc content (quickstart, API reference, troubleshooting tables)
 * lands in F3.
 */
export function DocsLayout() {
  const navItems = [
    { to: '/docs/quickstart', label: 'Quickstart' },
    { to: '/docs/api-reference', label: 'API Reference' },
    { to: '/docs/troubleshooting', label: 'Troubleshooting' },
  ];

  return (
    <div className="min-h-screen flex bg-bg-base">
      <aside className="w-56 shrink-0 border-r border-border-default bg-bg-base flex flex-col">
        <div className="px-6 py-6">
          <span className="font-display font-semibold text-display-md text-text-primary">Docs</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
        </nav>
      </aside>

      <main className="flex-1 px-8 py-8 max-w-3xl">
        <Outlet />
      </main>
    </div>
  );
}
