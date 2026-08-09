import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { landingCopy } from '../content/landing-copy';
import type { CapabilityCard, CapabilityCardId } from '../content/landing-copy';

const iconProps = {
  className: 'h-6 w-6',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/**
 * Hand-authored line icons only — frontend.md §2.4 (1.5px stroke, no icon
 * library). One per capability, mapping from the copy data's card id.
 */
const capabilityIcons: Record<CapabilityCardId, () => ReactNode> = {
  search: () => (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M8 11h6" />
    </svg>
  ),
  'dev-search': () => (
    <svg {...iconProps}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  ),
  memory: () => (
    <svg {...iconProps}>
      <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" />
    </svg>
  ),
};

function CapabilityIcon({ id }: { id: CapabilityCardId }) {
  return <>{capabilityIcons[id]()}</>;
}

function NavBar() {
  return (
    <nav className="border-b border-border-default">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-8">
        <Link to="/" className="font-display font-semibold text-display-md text-text-primary">
          Anchor
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/docs" className="text-body-md text-text-secondary hover:text-text-primary">
            {landingCopy.nav.docsLabel}
          </Link>
          <Link to="/login" className="btn-primary btn-small">
            {landingCopy.nav.signInLabel}
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="px-8 py-24 md:py-32">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="max-w-3xl font-display font-semibold text-display-lg text-text-primary md:text-display-xl">
          {landingCopy.hero.headline}
        </h1>
        <p className="mt-6 max-w-2xl text-body-lg text-text-secondary">{landingCopy.hero.subhead}</p>
        <Link to={landingCopy.hero.ctaTo} className="btn-primary mt-10">
          {landingCopy.hero.ctaLabel}
        </Link>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="px-8 py-16 md:py-24">
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="font-display font-semibold text-display-md text-text-primary">
          {landingCopy.howItWorks.heading}
        </h2>
        <div className="mt-8">
          {landingCopy.howItWorks.steps.map((step) => (
            <div key={step.number} className="flex gap-6 border-t border-border-default py-8 md:gap-12">
              <span className="font-display font-semibold text-display-lg leading-none text-text-tertiary">
                {step.number}
              </span>
              <div>
                <h3 className="font-body text-body-lg font-medium text-text-primary">{step.title}</h3>
                <p className="mt-2 max-w-xl text-body-md text-text-secondary">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CapabilityCard({ card }: { card: CapabilityCard }) {
  return (
    <article className="card-hoverable group flex flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <span className="text-text-secondary transition-colors group-hover:text-accent">
          <CapabilityIcon id={card.id} />
        </span>
        <h3 className="font-body text-body-lg font-semibold text-text-primary">{card.name}</h3>
      </div>
      <p className="text-body-sm leading-relaxed text-text-secondary">{card.description}</p>
      <MockSurface card={card} />
    </article>
  );
}

function MockSurface({ card }: { card: CapabilityCard }) {
  if (card.mock.kind === 'search-results') {
    return (
      <div className="space-y-4 rounded-card border border-border-default bg-bg-sunken p-4">
        {card.mock.items.map((item) => (
          <div key={item.url} className="space-y-1.5">
            <p className="break-all font-mono text-mono-sm text-text-tertiary">{item.url}</p>
            <p className="text-body-sm leading-relaxed text-text-primary">{item.snippet}</p>
            <p className="flex gap-1.5 text-body-sm text-accent">
              <span aria-hidden="true">·</span>
              <span>{item.memory}</span>
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (card.mock.kind === 'registry-match') {
    return (
      <div className="divide-y divide-border-default rounded-card border border-border-default bg-bg-sunken">
        {card.mock.items.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="font-mono text-mono-md font-medium text-text-primary">{item.name}</p>
              <p className="font-mono text-mono-sm text-text-tertiary">{item.version}</p>
            </div>
            <span className="shrink-0 rounded-control bg-accent-subtle px-2 py-0.5 font-mono text-mono-sm text-accent">
              {item.ecosystem}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-default rounded-card border border-border-default bg-bg-sunken">
      {card.mock.items.map((item, index) => (
        <div key={index} className="space-y-2 p-4">
          <p className="text-body-sm leading-relaxed text-text-primary">{item.content}</p>
          <span className="inline-block rounded-control bg-accent-subtle px-2 py-0.5 font-mono text-mono-sm text-accent">
            {item.similarity}
          </span>
        </div>
      ))}
    </div>
  );
}

function CapabilitySection() {
  return (
    <section className="px-8 py-16 md:py-24">
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="font-display font-semibold text-display-md text-text-primary">
          {landingCopy.capabilities.heading}
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {landingCopy.capabilities.cards.map((card) => (
            <CapabilityCard key={card.id} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RuntimeStrip() {
  return (
    <section className="px-8 py-16 md:py-24">
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="font-display font-semibold text-display-md text-text-primary">
          {landingCopy.runtimes.heading}
        </h2>
        <ul className="mt-8 flex flex-wrap gap-3">
          {landingCopy.runtimes.names.map((name) => (
            <li
              key={name}
              className="rounded-control border border-border-default px-4 py-2 text-body-sm text-text-secondary"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border-default">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display font-semibold text-display-md text-text-primary">Anchor</p>
          <p className="mt-1 text-body-sm text-text-tertiary">{landingCopy.footer.tagline}</p>
        </div>
        <div className="flex items-center gap-6">
          <Link to={landingCopy.footer.docsTo} className="text-body-sm text-text-secondary hover:text-text-primary">
            {landingCopy.footer.docsLabel}
          </Link>
          <a
            href={landingCopy.footer.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="text-body-sm text-text-secondary hover:text-text-primary"
          >
            {landingCopy.footer.githubLabel}
          </a>
        </div>
      </div>
    </footer>
  );
}

/**
 * Landing — frontend.md §3.1. A Decide/Learn surface telling the pain story:
 * the re-explaining problem, the three-step fix, and the three capabilities
 * as real surfaces (differentiated cards, never equal tiles).
 */
export function Landing() {
  return (
    <div className="min-h-screen bg-bg-base">
      <NavBar />
      <main>
        <Hero />
        <HowItWorks />
        <CapabilitySection />
        <RuntimeStrip />
      </main>
      <Footer />
    </div>
  );
}
