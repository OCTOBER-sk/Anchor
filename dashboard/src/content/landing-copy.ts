/**
 * All landing copy as data — frontend.md §3.1. Single source for the
 * pain-story hero, the three-step fix, the differentiated capability
 * surfaces, the runtime strip, and the footer. Edit copy here, never in
 * the component.
 *
 * Discipline per §2.5: zero tech-stack names, zero hype register, zero fake
 * metrics, zero testimonials. Capabilities are described by what they do,
 * never by what powers them.
 */

export interface NavCopy {
  docsLabel: string;
  signInLabel: string;
}

export interface HeroCopy {
  headline: string;
  subhead: string;
  ctaLabel: string;
  ctaTo: string;
}

export interface HowItWorksStep {
  number: string;
  title: string;
  description: string;
}

export interface HowItWorksCopy {
  heading: string;
  steps: HowItWorksStep[];
}

export interface SearchResultMock {
  url: string;
  snippet: string;
  memory: string;
}

export interface RegistryMatchMock {
  name: string;
  version: string;
  ecosystem: string;
}

export interface MemoryMatchMock {
  content: string;
  similarity: string;
}

export type CapabilityCard =
  | {
      id: 'search';
      name: string;
      description: string;
      mock: { kind: 'search-results'; items: SearchResultMock[] };
    }
  | {
      id: 'dev-search';
      name: string;
      description: string;
      mock: { kind: 'registry-match'; items: RegistryMatchMock[] };
    }
  | {
      id: 'memory';
      name: string;
      description: string;
      mock: { kind: 'memory-match'; items: MemoryMatchMock[] };
    };

export type CapabilityCardId = CapabilityCard['id'];

export interface CapabilitiesCopy {
  heading: string;
  cards: CapabilityCard[];
}

export interface RuntimesCopy {
  heading: string;
  names: string[];
}

export interface FooterCopy {
  tagline: string;
  docsLabel: string;
  docsTo: string;
  githubLabel: string;
  githubUrl: string;
}

export interface LandingCopy {
  nav: NavCopy;
  hero: HeroCopy;
  howItWorks: HowItWorksCopy;
  capabilities: CapabilitiesCopy;
  runtimes: RuntimesCopy;
  footer: FooterCopy;
}

export const landingCopy: LandingCopy = {
  nav: {
    docsLabel: 'Docs',
    signInLabel: 'Sign in',
  },

  hero: {
    headline: 'Every session, you re-explain everything.',
    subhead:
      'Anchor remembers what your agents already know. Search, store, and recall context across every runtime.',
    ctaLabel: 'Open dashboard',
    ctaTo: '/login',
  },

  howItWorks: {
    heading: 'The fix is three steps',
    steps: [
      {
        number: '1',
        title: 'Search',
        description: 'Ask anything. Get answers — and what you already knew.',
      },
      {
        number: '2',
        title: 'It remembers',
        description: 'What you learn is kept, so you never re-explain it.',
      },
      {
        number: '3',
        title: 'Any agent recalls',
        description: 'Claude Code writes, OpenCode recalls. One memory, every runtime.',
      },
    ],
  },

  capabilities: {
    heading: 'Three capabilities, one memory',
    cards: [
      {
        id: 'search',
        name: 'Search',
        description: 'Web search with AI summaries, plus the context you already have on the topic.',
        mock: {
          kind: 'search-results',
          items: [
            {
              url: 'developer.mozilla.org/en-US/docs/Web/HTTP/Caching',
              snippet:
                'HTTP caching is the fastest win for repeat visits. Cache-Control and revalidation control what stays fresh.',
              memory: 'Related memory — you noted: stale-while-revalidate for our API.',
            },
            {
              url: 'learn.svelte.dev/tutorial/introducing-runes',
              snippet:
                'Runes introduce signal-based reactivity — state that reads like plain JavaScript, with fewer surprises.',
              memory: 'Related memory — you read this last week.',
            },
          ],
        },
      },
      {
        id: 'dev-search',
        name: 'Dev Search',
        description: 'Package-aware answers for developers — names, versions, and ecosystems from your query.',
        mock: {
          kind: 'registry-match',
          items: [
            { name: 'zod', version: 'v3.25.76', ecosystem: 'TypeScript' },
            { name: 'tsx', version: 'v4.20.3', ecosystem: 'TypeScript' },
            { name: 'esbuild', version: 'v0.25.0', ecosystem: 'JavaScript' },
          ],
        },
      },
      {
        id: 'memory',
        name: 'Memory',
        description: 'What you learn is kept. Any agent recalls it, in any runtime.',
        mock: {
          kind: 'memory-match',
          items: [
            {
              content: 'The API convention: every endpoint returns { error } on failure, never a bare throw.',
              similarity: '0.94 match',
            },
            {
              content: 'You prefer one schema per endpoint — a single source of truth.',
              similarity: '0.87 match',
            },
          ],
        },
      },
    ],
  },

  runtimes: {
    heading: 'Works with the runtimes you already use',
    names: ['Claude Code', 'Cursor', 'OpenCode', 'Hermes', 'Antigravity'],
  },

  footer: {
    tagline: 'The memory layer for your AI agents',
    docsLabel: 'Docs',
    docsTo: '/docs',
    githubLabel: 'GitHub',
    githubUrl: 'https://github.com/OCTOBER-sk/Anchor',
  },
};
