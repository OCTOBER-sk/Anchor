import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from '../src/context';
import { handleDevSearch } from '../src/tools/devsearch';
import { buildTestContext, buildTestEnv } from './test-utils';

vi.mock('../src/search/dev-router', () => ({
  runSearchPipeline: vi.fn(),
}));

vi.mock('../src/search/registries', () => ({
  queryRegistry: vi.fn(),
}));

import { runSearchPipeline } from '../src/search/dev-router';
import { queryRegistry } from '../src/search/registries';

const DOCS_RESULT = {
  url: 'https://developers.cloudflare.com/workers/',
  title: 'Cloudflare Workers documentation',
  snippet:
    'A comprehensive documentation page covering the full Cloudflare Workers runtime, its platform limits, and CPU time accounting.',
  domainPriority: 80,
};

const LODASH_RESULT = {
  url: 'https://dev.to/guides/lodash-react',
  title: 'Using Lodash in React',
  snippet: 'A practical guide to combining lodash utility functions with React state management patterns.',
  domainPriority: 50,
};

function mockPipelineResults(): void {
  vi.mocked(runSearchPipeline).mockResolvedValue({
    results: [DOCS_RESULT, LODASH_RESULT],
    summary: 'A dev-search summary.',
    providerUsed: 'ddg',
  });
}

let ctx: Context;

beforeEach(async () => {
  vi.mocked(runSearchPipeline).mockReset();
  vi.mocked(queryRegistry).mockReset();
  mockPipelineResults();
  ctx = buildTestContext(await buildTestEnv());
});

describe('tools/devsearch', () => {
  it('biases results toward dependencies present in the supplied project manifest', async () => {
    const manifest = JSON.stringify({ dependencies: { lodash: '^4.17.21' } });

    const result = await handleDevSearch(
      { query: 'how to use lodash in react', project_manifest: manifest },
      ctx,
    );

    expect(result.results[0]?.title).toContain('Lodash');
    expect(result.results[0]?.url).toBe(LODASH_RESULT.url);
    expect(queryRegistry).not.toHaveBeenCalled();
    expect(result._meta).toEqual({ provider_used: 'search-primary', platform_category: 'search' });
  });

  it('leaves ordering untouched when no manifest is supplied', async () => {
    const result = await handleDevSearch({ query: 'how to use lodash in react' }, ctx);

    expect(result.results[0]?.url).toBe(DOCS_RESULT.url);
    expect(result.results[1]?.url).toBe(LODASH_RESULT.url);
  });

  it('queries the registry in parallel for a package-like query with an ecosystem', async () => {
    vi.mocked(queryRegistry).mockResolvedValue({
      name: 'lodash',
      version: '4.17.21',
      ecosystem: 'npm',
      url: 'https://www.npmjs.com/package/lodash',
      title: 'lodash on npm',
      snippet: 'Latest version: 4.17.21',
    });

    const result = await handleDevSearch({ query: 'lodash', ecosystem: 'npm' }, ctx);

    expect(queryRegistry).toHaveBeenCalledTimes(1);
    expect(queryRegistry).toHaveBeenCalledWith('lodash', 'npm');
    expect(runSearchPipeline).toHaveBeenCalledTimes(1);

    const registryItem = result.results.find((r) => r.registryMatch !== undefined);
    expect(registryItem).toBeDefined();
    expect(registryItem?.url).toBe('https://www.npmjs.com/package/lodash');
    expect(registryItem?.registryMatch).toEqual({ name: 'lodash', version: '4.17.21', ecosystem: 'npm' });
  });

  it('skips the registry when the query is not package-like', async () => {
    await handleDevSearch({ query: 'how to deploy a serverless function', ecosystem: 'npm' }, ctx);

    expect(queryRegistry).not.toHaveBeenCalled();
  });

  it('strips the internal domainPriority field from the output shape', async () => {
    const result = await handleDevSearch({ query: 'how to use lodash in react' }, ctx);

    expect(result.results[0]).not.toHaveProperty('domainPriority');
    expect(result.summary).toBe('A dev-search summary.');
  });
});
