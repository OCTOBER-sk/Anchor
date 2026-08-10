import { describe, it, expect, vi, afterEach } from 'vitest';
import { tursoFetch } from '../src/storage/turso';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tursoFetch', () => {
  it('preserves the Authorization header when called with a Request object', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://db.turso.io/v2/pipeline', {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: JSON.stringify({ requests: [] }),
    });

    const response = await tursoFetch(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://db.turso.io/v2/pipeline');
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer test-token');
    expect(init.body).toBeTruthy();
  });

  it('lets explicit init override values carried on the Request object', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://db.turso.io/v2/pipeline', {
      method: 'GET',
      headers: { authorization: 'Bearer original-token' },
    });

    await tursoFetch(request, { method: 'POST', headers: { authorization: 'Bearer override-token' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer override-token');
  });
});
