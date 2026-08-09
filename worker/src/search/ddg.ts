import type { ProviderResult, ProviderResultItem, SearchOpts } from './dev-router';

const DDG_HTML_URL = 'https://html.duckduckgo.com/html/';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 250;
const MAX_PARSE_RESULTS = 20;

class RetryableDdgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableDdgError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveDdgHref(href: string): string {
  const match = /[?&]uddg=([^&]+)/.exec(href);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      // fall through to returning the raw href
    }
  }
  return href;
}

function parseDdgHtml(html: string): ProviderResultItem[] {
  const items: ProviderResultItem[] = [];
  const titleRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  const titles: Array<{ href: string; title: string }> = [];
  let titleMatch: RegExpExecArray | null;
  while ((titleMatch = titleRe.exec(html)) !== null) {
    titles.push({ href: titleMatch[1] ?? '', title: stripTags(titleMatch[2] ?? '') });
  }

  const snippets: string[] = [];
  let snippetMatch: RegExpExecArray | null;
  while ((snippetMatch = snippetRe.exec(html)) !== null) {
    snippets.push(stripTags(snippetMatch[1] ?? ''));
  }

  for (let i = 0; i < Math.min(titles.length, MAX_PARSE_RESULTS); i++) {
    const title = titles[i];
    if (title === undefined) {
      break;
    }
    items.push({
      url: resolveDdgHref(title.href),
      title: title.title,
      snippet: snippets[i] ?? '',
    });
  }
  return items;
}

function isCaptchaOrAnomaly(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('captcha') ||
    lower.includes('anomaly') ||
    lower.includes('unusual traffic') ||
    lower.includes('robot check')
  );
}

async function fetchOnce(query: string): Promise<ProviderResultItem[]> {
  const url = new URL(DDG_HTML_URL);
  url.searchParams.set('q', query);

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AnchorMCP/1.0)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();

  if (response.status === 429 || response.status === 202 || response.status === 403) {
    throw new RetryableDdgError(`DuckDuckGo responded with HTTP ${response.status}`);
  }
  if (isCaptchaOrAnomaly(text)) {
    throw new RetryableDdgError('DuckDuckGo served a CAPTCHA/anomaly page');
  }

  return parseDdgHtml(text);
}

export async function ddgSearch(query: string, opts: SearchOpts): Promise<ProviderResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const items = await fetchOnce(query);
      return items.slice(0, opts.maxResults);
    } catch (err) {
      lastError = err;
      if (!(err instanceof RetryableDdgError)) {
        throw err;
      }
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(BACKOFF_BASE_MS * 2 ** attempt);
      }
    }
  }
  throw lastError;
}
