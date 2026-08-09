import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateFetchUrl, safeFetch } from '../src/utils/safe-fetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validateFetchUrl — scheme guard', () => {
  it('accepts https URLs', () => {
    expect(validateFetchUrl('https://api.example.com/v1/search')).toBe(true);
  });

  it('rejects non-https schemes', () => {
    expect(validateFetchUrl('http://api.example.com/v1')).toBe(false);
    expect(validateFetchUrl('ftp://example.com/file')).toBe(false);
    expect(validateFetchUrl('ws://example.com/socket')).toBe(false);
    expect(validateFetchUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects unparseable URLs', () => {
    expect(validateFetchUrl('not a url')).toBe(false);
    expect(validateFetchUrl('')).toBe(false);
  });

  it('honors an explicit allowedSchemes override', () => {
    const tursoSchemes = ['https', 'wss', 'libsql'];
    expect(validateFetchUrl('wss://db.turso.io', { allowedSchemes: tursoSchemes })).toBe(true);
    expect(validateFetchUrl('libsql://db.turso.io', { allowedSchemes: tursoSchemes })).toBe(true);
    expect(validateFetchUrl('http://db.turso.io', { allowedSchemes: tursoSchemes })).toBe(false);
  });
});

describe('validateFetchUrl — loopback/private/link-local rejection', () => {
  it('rejects loopback addresses', () => {
    expect(validateFetchUrl('https://127.0.0.1/admin')).toBe(false);
    expect(validateFetchUrl('https://127.0.0.2/')).toBe(false);
    expect(validateFetchUrl('https://[::1]/')).toBe(false);
  });

  it('rejects link-local addresses', () => {
    expect(validateFetchUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(validateFetchUrl('https://[fe80::1]/')).toBe(false);
  });

  it('rejects private ranges', () => {
    expect(validateFetchUrl('https://10.0.0.1/')).toBe(false);
    expect(validateFetchUrl('https://10.255.255.255/')).toBe(false);
    expect(validateFetchUrl('https://192.168.1.1/')).toBe(false);
    expect(validateFetchUrl('https://172.16.0.1/')).toBe(false);
    expect(validateFetchUrl('https://172.31.255.255/')).toBe(false);
    expect(validateFetchUrl('https://[fd00::1]/')).toBe(false);
  });
});

describe('validateFetchUrl — allowlist', () => {
  it('accepts allowlisted hosts', () => {
    expect(validateFetchUrl('https://api.tavily.com/search', { allowedHosts: ['api.tavily.com'] })).toBe(true);
    expect(validateFetchUrl('https://html.duckduckgo.com/html/', { allowedHosts: ['*.duckduckgo.com'] })).toBe(true);
    expect(validateFetchUrl('https://test.supabase.co/rest/v1', { allowedHosts: ['*.supabase.co'] })).toBe(true);
  });

  it('rejects hosts not matching the allowlist', () => {
    expect(validateFetchUrl('https://evil.example.net/steal', { allowedHosts: ['api.tavily.com'] })).toBe(false);
    expect(validateFetchUrl('https://evil.duckduckgo.com.evil.net/x', { allowedHosts: ['*.duckduckgo.com'] })).toBe(false);
  });

  it('rejects private IPs unless the IP itself is allowlisted', () => {
    expect(validateFetchUrl('https://127.0.0.1/', { allowedHosts: ['api.tavily.com'] })).toBe(false);
    expect(validateFetchUrl('https://127.0.0.1/', { allowedHosts: ['127.0.0.1'] })).toBe(true);
  });
});

describe('safeFetch — timeout enforcement', () => {
  it('aborts the request when the provider exceeds the timeout', async () => {
    const hangingFetch = vi.fn((_input: unknown, init?: { signal?: AbortSignal }) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason ?? new Error('aborted'));
        });
      });
    });
    vi.stubGlobal('fetch', hangingFetch);

    await expect(
      safeFetch('https://api.example.com/slow', {}, { timeoutMs: 25, allowedHosts: ['api.example.com'] }),
    ).rejects.toThrow();
    expect(hangingFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects immediately when validation fails, without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(safeFetch('http://192.168.1.1/', {})).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes through the init and returns the fetch response on success', async () => {
    const response = new Response('ok', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetch(
      'https://api.example.com/v1',
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { allowedHosts: ['api.example.com'] },
    );

    expect(result).toBe(response);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1');
    expect(init.method).toBe('POST');
    expect(init.signal).toBeDefined();
  });
});
