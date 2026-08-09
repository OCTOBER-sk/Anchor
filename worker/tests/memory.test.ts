import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context } from '../src/context';
import { PlatformError } from '../src/utils/errors';
import { handleRemember, handleRecall } from '../src/tools/memory';
import { pingKeepalive } from '../src/storage/supabase';
import { buildTestContext, buildTestEnv } from './test-utils';

vi.mock('../src/ai/gemini', () => ({
  embedText: vi.fn(),
  generateContent: vi.fn(),
}));

import { embedText } from '../src/ai/gemini';

function embedding768(): number[] {
  const values = new Array<number>(768);
  for (let i = 0; i < values.length; i += 1) {
    values[i] = i / 768;
  }
  return values;
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected promise to reject');
}

let ctx: Context;
const fetchMock = vi.fn();

beforeEach(async () => {
  vi.mocked(embedText).mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  ctx = buildTestContext(await buildTestEnv());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tools/memory — anchor_remember', () => {
  it('writes a memory via the Supabase REST insert with a 768-dim embedding', async () => {
    vi.mocked(embedText).mockResolvedValue(embedding768());
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ id: 'mem-123' }]), { status: 201 }));

    const result = await handleRemember({ content: 'the deployment pipeline runs CI', tags: ['devops'] }, ctx);

    expect(result).toEqual({ id: 'mem-123', stored: true, _meta: { provider_used: 'memory-store', platform_category: 'memory' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://test.supabase.co/rest/v1/memories');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      apikey: 'test',
      Authorization: 'Bearer test',
      Prefer: 'return=representation',
    });

    const body = JSON.parse(String(init.body)) as {
      owner_id: string;
      agent_id: string;
      content: string;
      embedding: number[];
      tags: string[];
      source_tool: string;
    };
    expect(body.owner_id).toBe('anchor-deployment-owner');
    expect(body.agent_id).toBe('test-agent-id');
    expect(body.content).toBe('the deployment pipeline runs CI');
    expect(body.embedding).toHaveLength(768);
    expect(body.tags).toEqual(['devops']);
    expect(body.source_tool).toBe('anchor_remember');
  });

  it('defaults tags to an empty array when not supplied', async () => {
    vi.mocked(embedText).mockResolvedValue(embedding768());
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ id: 'mem-2' }]), { status: 201 }));

    await handleRemember({ content: 'plain memory' }, ctx);

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as { tags: string[] };
    expect(body.tags).toEqual([]);
  });

  it('exposes the raw provider name in _meta for admin-tier agents', async () => {
    const adminCtx = buildTestContext(await buildTestEnv(), { agentTier: 'admin' });
    vi.mocked(embedText).mockResolvedValue(embedding768());
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ id: 'mem-3' }]), { status: 201 }));

    const result = await handleRemember({ content: 'admin memory' }, adminCtx);

    expect(result._meta).toEqual({ provider_used: 'gemini', platform_category: 'memory' });
  });
});

describe('tools/memory — anchor_recall', () => {
  it('queries the match_memories RPC and returns matches with similarity', async () => {
    vi.mocked(embedText).mockResolvedValue(embedding768());
    const rows = [
      { id: 'mem-1', content: 'CI pipeline config lives in .github', tags: ['devops'], similarity: 0.88, created_at: '2026-08-01T00:00:00.000Z' },
      { id: 'mem-2', content: 'Deploy uses wrangler', tags: [], similarity: 0.81, created_at: '2026-08-02T00:00:00.000Z' },
    ];
    fetchMock.mockResolvedValue(new Response(JSON.stringify(rows), { status: 200 }));

    const result = await handleRecall({ query: 'CI deployment' }, ctx);

    expect(result.matches).toEqual(rows);
    expect(result._meta).toEqual({ provider_used: 'memory-store', platform_category: 'memory' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://test.supabase.co/rest/v1/rpc/match_memories');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ apikey: 'test', Authorization: 'Bearer test' });

    const body = JSON.parse(String(init.body)) as {
      query_embedding: number[];
      match_threshold: number;
      match_count: number;
      filter_owner_id: string;
    };
    expect(body.query_embedding).toHaveLength(768);
    expect(body.match_threshold).toBe(0.75);
    expect(body.match_count).toBe(10);
    expect(body.filter_owner_id).toBe('anchor-deployment-owner');
  });

  it('honors caller-supplied match_threshold and match_count', async () => {
    vi.mocked(embedText).mockResolvedValue(embedding768());
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }));

    await handleRecall({ query: 'memory', match_threshold: 0.5, match_count: 3 }, ctx);

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as {
      match_threshold: number;
      match_count: number;
    };
    expect(body.match_threshold).toBe(0.5);
    expect(body.match_count).toBe(3);
  });
});

describe('tools/memory — loud failure (MEMORY_UNAVAILABLE)', () => {
  it('surfaces MEMORY_UNAVAILABLE when the Supabase insert fails', async () => {
    vi.mocked(embedText).mockResolvedValue(embedding768());
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    const err = await rejectionOf(handleRemember({ content: 'anything' }, ctx));
    expect(err).toBeInstanceOf(PlatformError);
    expect(err).toMatchObject({ code: 'MEMORY_UNAVAILABLE' });
  });

  it('surfaces MEMORY_UNAVAILABLE when the Supabase RPC call fails', async () => {
    vi.mocked(embedText).mockResolvedValue(embedding768());
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    const err = await rejectionOf(handleRecall({ query: 'anything' }, ctx));
    expect(err).toBeInstanceOf(PlatformError);
    expect(err).toMatchObject({ code: 'MEMORY_UNAVAILABLE' });
  });

  it('surfaces MEMORY_UNAVAILABLE when embedding fails for remember', async () => {
    vi.mocked(embedText).mockRejectedValue(new Error('gemini quota exhausted'));

    const err = await rejectionOf(handleRemember({ content: 'anything' }, ctx));
    expect(err).toBeInstanceOf(PlatformError);
    expect(err).toMatchObject({ code: 'MEMORY_UNAVAILABLE' });
  });

  it('surfaces MEMORY_UNAVAILABLE when embedding fails for recall', async () => {
    vi.mocked(embedText).mockRejectedValue(new Error('gemini quota exhausted'));

    const err = await rejectionOf(handleRecall({ query: 'anything' }, ctx));
    expect(err).toBeInstanceOf(PlatformError);
    expect(err).toMatchObject({ code: 'MEMORY_UNAVAILABLE' });
  });
});

describe('storage/supabase — pingKeepalive', () => {
  it('performs a trivial select against the memories table', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }));
    const env = await buildTestEnv();

    await expect(pingKeepalive(env)).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://test.supabase.co/rest/v1/memories?select=id&limit=1');
    expect(init.method).toBe('GET');
  });

  it('throws when the keepalive ping fails', async () => {
    fetchMock.mockResolvedValue(new Response('down', { status: 503 }));
    const env = await buildTestEnv();

    await expect(pingKeepalive(env)).rejects.toThrow();
  });
});
