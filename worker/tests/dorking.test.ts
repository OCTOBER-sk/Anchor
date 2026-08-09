import { describe, it, expect } from 'vitest';
import { parseDorkOperators, applyDorkOperators } from '../src/search/dorking';

describe('search/dorking', () => {
  it('parses the site: operator and returns the clean query', () => {
    const { cleanQuery, operators } = parseDorkOperators('cloudflare workers site:developers.cloudflare.com');
    expect(cleanQuery).toBe('cloudflare workers');
    expect(operators).toEqual([
      { type: 'site', value: 'developers.cloudflare.com', supportedProviders: ['ddg', 'tavily', 'apify'] },
    ]);
  });

  it('parses the filetype: operator', () => {
    const { cleanQuery, operators } = parseDorkOperators('worker report filetype:pdf');
    expect(cleanQuery).toBe('worker report');
    expect(operators).toEqual([{ type: 'filetype', value: 'pdf', supportedProviders: ['ddg', 'tavily'] }]);
  });

  it('parses the intitle: operator', () => {
    const { cleanQuery, operators } = parseDorkOperators('intitle:workers cloudflare');
    expect(cleanQuery).toBe('cloudflare');
    expect(operators).toEqual([{ type: 'intitle', value: 'workers', supportedProviders: ['tavily'] }]);
  });

  it('parses the -exclude operator', () => {
    const { cleanQuery, operators } = parseDorkOperators('cloudflare workers -blog');
    expect(cleanQuery).toBe('cloudflare workers');
    expect(operators).toEqual([{ type: 'exclude', value: 'blog', supportedProviders: ['ddg', 'tavily'] }]);
  });

  it('parses a quoted phrase as a single quoted operator', () => {
    const { cleanQuery, operators } = parseDorkOperators('"cpu limits" cloudflare');
    expect(cleanQuery).toBe('cloudflare');
    expect(operators).toEqual([
      { type: 'quoted', value: 'cpu limits', supportedProviders: ['ddg', 'tavily', 'apify'] },
    ]);
  });

  it('applies operators to the clean query in their original order', () => {
    const { cleanQuery, operators } = parseDorkOperators('cloudflare -blog site:cloudflare.com "edge workers"');
    expect(applyDorkOperators(cleanQuery, operators)).toBe('cloudflare -blog site:cloudflare.com "edge workers"');
  });

  it('strips operators unsupported by the given provider', () => {
    const { cleanQuery, operators } = parseDorkOperators('intitle:workers cloudflare -blog filetype:pdf');

    expect(applyDorkOperators(cleanQuery, operators, 'ddg')).toBe('cloudflare -blog filetype:pdf');
    expect(applyDorkOperators(cleanQuery, operators, 'tavily')).toBe('cloudflare intitle:workers -blog filetype:pdf');
    expect(applyDorkOperators(cleanQuery, operators, 'apify')).toBe('cloudflare');
  });

  it('returns the query unchanged when no operators are present', () => {
    const { cleanQuery, operators } = parseDorkOperators('plain query here');
    expect(cleanQuery).toBe('plain query here');
    expect(operators).toEqual([]);
  });
});
