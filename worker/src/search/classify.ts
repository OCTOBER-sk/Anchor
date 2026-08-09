import type { Context } from '../context';
import { captureError } from '../utils/monitoring';
import { dispatchAI } from '../ai/router';
import type { ProviderResultItem } from './dev-router';

export type RawProviderResult = ProviderResultItem;
export type Verdict = 'genuine' | 'phantom' | 'uncertain';

const PHANTOM_MARKERS = [
  'sign in to',
  'sign in or',
  'log in to read',
  'subscribe to continue',
  'subscriber only',
  'premium content',
  'paywall',
  'enable javascript',
  'check your browser',
  'access denied',
  'request denied',
  'sponsored',
  'advertisement',
  'click here',
  'continue reading',
  'forbidden',
];

function hasPhantomMarker(text: string): boolean {
  for (const marker of PHANTOM_MARKERS) {
    if (text.includes(marker)) {
      return true;
    }
  }
  return false;
}

export function classifyResult(result: RawProviderResult): Verdict {
  const title = result.title.trim();
  const snippet = result.snippet.trim();
  const combined = `${title} ${snippet}`.toLowerCase();

  if (hasPhantomMarker(combined)) {
    return 'phantom';
  }
  if (snippet.length < 40 || title.length < 10) {
    return 'phantom';
  }
  if (snippet.length >= 80 && title.length >= 15) {
    return 'genuine';
  }
  return 'uncertain';
}

async function aiDecide(result: RawProviderResult, ctx: Context): Promise<'genuine' | 'phantom'> {
  try {
    const ai = await dispatchAI(
      'classify',
      [
        'Classify the following web search result as GENUINE or PHANTOM.',
        'GENUINE: substantive, real, on-topic content that answers a query.',
        'PHANTOM: low-content placeholder, paywalled stub, or AI-generated SEO filler.',
        `URL: ${result.url}`,
        `Title: ${result.title}`,
        `Snippet: ${result.snippet}`,
        'Reply with exactly GENUINE or PHANTOM.',
      ].join('\n'),
      ctx,
    );
    const text = (ai.text ?? '').toLowerCase();
    return text.includes('phantom') ? 'phantom' : 'genuine';
  } catch (err) {
    captureError('search/classify.ts::aiDecide', err, { url: result.url });
    return 'genuine';
  }
}

export async function filterPhantomResults(results: RawProviderResult[], ctx?: Context): Promise<RawProviderResult[]> {
  const kept: RawProviderResult[] = [];
  for (const result of results) {
    const verdict = classifyResult(result);
    if (verdict === 'phantom') {
      continue;
    }
    if (verdict === 'uncertain' && ctx !== undefined) {
      const decided = await aiDecide(result, ctx);
      if (decided === 'phantom') {
        continue;
      }
    }
    kept.push(result);
  }
  return kept;
}
