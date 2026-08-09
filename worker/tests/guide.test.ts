import { describe, it, expect } from 'vitest';
import { GUIDE_CONTENT, handleGuide } from '../src/tools/guide';
import { buildTestContext, buildTestEnv } from './test-utils';

const FORBIDDEN_STRINGS = ['TTS', 'voice', 'deepdoc', 'analyze', 'audio'];

describe('tools/guide — GUIDE_CONTENT', () => {
  it('documents all four other tools by name', () => {
    expect(GUIDE_CONTENT).toContain('anchor_search');
    expect(GUIDE_CONTENT).toContain('anchor_dev_search');
    expect(GUIDE_CONTENT).toContain('anchor_remember');
    expect(GUIDE_CONTENT).toContain('anchor_recall');
  });

  it('documents the auto-recall injection behavior of anchor_search', () => {
    expect(GUIDE_CONTENT).toContain('related_memories');
    expect(GUIDE_CONTENT).toMatch(/always present/i);
  });

  it('contains zero forbidden capability references (TTS/voice/audio/file analysis)', () => {
    const lower = GUIDE_CONTENT.toLowerCase();
    for (const needle of FORBIDDEN_STRINGS) {
      expect(lower).not.toContain(needle.toLowerCase());
    }
  });
});

describe('tools/guide — handleGuide', () => {
  it('returns the guide plus _meta through the handler', async () => {
    const ctx = buildTestContext(await buildTestEnv());
    const result = await handleGuide({}, ctx);

    expect(typeof result.guide).toBe('string');
    expect(result.guide.length).toBeGreaterThan(100);
    expect(result.guide).toContain('anchor_search');
    expect(result.guide).toContain('anchor_recall');
    expect(result._meta).toBeDefined();
  });

  it('omits admin-only notes for standard-tier agents', async () => {
    const ctx = buildTestContext(await buildTestEnv(), { agentTier: 'standard' });
    const result = await handleGuide({}, ctx);

    expect(result.guide).not.toContain('admin/debug');
    expect(result.guide).not.toContain('provider_used');
  });

  it('includes admin-only notes for admin-tier agents', async () => {
    const ctx = buildTestContext(await buildTestEnv(), { agentTier: 'admin' });
    const result = await handleGuide({}, ctx);

    expect(result.guide).toContain('admin/debug');
    expect(result.guide).toContain('provider_used');
  });

  it('includes admin-only notes for debug-tier agents', async () => {
    const ctx = buildTestContext(await buildTestEnv(), { agentTier: 'debug' });
    const result = await handleGuide({}, ctx);

    expect(result.guide).toContain('admin/debug');
  });
});
