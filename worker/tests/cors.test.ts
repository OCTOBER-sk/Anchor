import { describe, it, expect } from 'vitest';
import type { Env } from '../src/context';
import { corsHeaders, originMatches } from '../src/index';
import { buildTestEnv } from './test-utils';

const ALLOWLIST = 'https://claude.ai,https://*.anchor-dashboard-5mp.pages.dev';
const WILDCARD_ENTRY = 'https://*.anchor-dashboard-5mp.pages.dev';

describe('cors allowlist — originMatches', () => {
  it('matches exact origins exactly and keeps prior behavior', () => {
    expect(originMatches('https://claude.ai', 'https://claude.ai')).toBe(true);
    expect(originMatches('https://claude.ai', 'https://claude.ai.evil.com')).toBe(false);
    expect(originMatches('https://claude.ai', 'http://claude.ai')).toBe(false);
    expect(originMatches('https://claude.ai', 'https://evil.com')).toBe(false);
  });

  it('matches any https subdomain of the wildcard base', () => {
    expect(originMatches(WILDCARD_ENTRY, 'https://7ef32068.anchor-dashboard-5mp.pages.dev')).toBe(true);
    expect(originMatches(WILDCARD_ENTRY, 'https://abc.anchor-dashboard-5mp.pages.dev')).toBe(true);
    expect(originMatches(WILDCARD_ENTRY, 'https://a.b.anchor-dashboard-5mp.pages.dev')).toBe(true);
  });

  it('rejects non-https, wrong-suffix, and bare-base origins for the wildcard entry', () => {
    expect(originMatches(WILDCARD_ENTRY, 'https://anchor-dashboard-5mp.pages.dev')).toBe(false);
    expect(originMatches(WILDCARD_ENTRY, 'http://abc.anchor-dashboard-5mp.pages.dev')).toBe(false);
    expect(originMatches(WILDCARD_ENTRY, 'https://evil-anchor-dashboard-5mp.pages.dev')).toBe(false);
    expect(originMatches(WILDCARD_ENTRY, 'https://abc.anchor-dashboard-5mp.pages.dev.evil.com')).toBe(false);
    expect(originMatches(WILDCARD_ENTRY, 'https://claude.ai')).toBe(false);
  });
});

describe('cors allowlist — corsHeaders', () => {
  async function envWith(origins: string): Promise<Env> {
    return buildTestEnv({ ALLOWED_ORIGINS: origins });
  }

  it('echoes the origin when it is an exact allowlisted origin', async () => {
    const env = await envWith(ALLOWLIST);
    const cors = corsHeaders(env, 'https://claude.ai');
    expect(cors['Access-Control-Allow-Origin']).toBe('https://claude.ai');
    expect(cors['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
  });

  it('echoes the origin when it is a wildcard subdomain of the allowlisted base', async () => {
    const env = await envWith(ALLOWLIST);
    const cors = corsHeaders(env, 'https://7ef32068.anchor-dashboard-5mp.pages.dev');
    expect(cors['Access-Control-Allow-Origin']).toBe('https://7ef32068.anchor-dashboard-5mp.pages.dev');
  });

  it('does not set CORS headers for an unrelated origin', async () => {
    const env = await envWith(ALLOWLIST);
    expect(corsHeaders(env, 'https://evil.com')).toEqual({});
  });

  it('does not set CORS headers for the bare base without a subdomain', async () => {
    const env = await envWith(ALLOWLIST);
    expect(corsHeaders(env, 'https://anchor-dashboard-5mp.pages.dev')).toEqual({});
  });

  it('rejects everything when ALLOWED_ORIGINS is empty', async () => {
    const env = await envWith('');
    expect(corsHeaders(env, 'https://claude.ai')).toEqual({});
    expect(corsHeaders(env, 'https://7ef32068.anchor-dashboard-5mp.pages.dev')).toEqual({});
  });

  it('returns no headers for a null origin', async () => {
    const env = await envWith(ALLOWLIST);
    expect(corsHeaders(env, null)).toEqual({});
  });
});
