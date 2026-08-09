import { describe, it, expect } from 'vitest';
import { generateAgentKey, isValidKeyFormat, extractSlug } from '../src/auth/keys';

describe('auth/keys', () => {
  it('generates a key matching anchor_<slug>_<32-hex>', () => {
    const key = generateAgentKey('claudecode');
    expect(key).toMatch(/^anchor_claudecode_[0-9a-f]{32}$/);
    expect(isValidKeyFormat(key)).toBe(true);
  });

  it('generates unique keys across calls', () => {
    expect(generateAgentKey('x')).not.toBe(generateAgentKey('x'));
  });

  it('rejects slugs with invalid characters', () => {
    expect(() => generateAgentKey('Bad Slug!')).toThrow();
    expect(() => generateAgentKey('UPPER')).toThrow();
  });

  it('accepts only the canonical key format', () => {
    expect(isValidKeyFormat('anchor_foo_0123456789abcdef0123456789abcdef')).toBe(true);
    expect(isValidKeyFormat('anchor_foo-bar_0123456789abcdef0123456789abcdef')).toBe(true);

    expect(isValidKeyFormat('')).toBe(false);
    expect(isValidKeyFormat('anchor_')).toBe(false);
    expect(isValidKeyFormat('anchor_foo_123')).toBe(false);
    expect(isValidKeyFormat('anchor_foo_gggggggggggggggggggggggggggggggg')).toBe(false);
    expect(isValidKeyFormat('anchor_foo_0123456789abcdef0123456789abcde')).toBe(false);
    expect(isValidKeyFormat('foo_0123456789abcdef0123456789abcdef')).toBe(false);
    expect(isValidKeyFormat('Anchor_foo_0123456789abcdef0123456789abcdef')).toBe(false);
    expect(isValidKeyFormat('anchor_Foo_0123456789abcdef0123456789abcdef')).toBe(false);
  });

  it('handles non-string input', () => {
    expect(isValidKeyFormat(undefined as unknown as string)).toBe(false);
    expect(isValidKeyFormat(null as unknown as string)).toBe(false);
    expect(isValidKeyFormat(123 as unknown as string)).toBe(false);
  });

  it('extracts the slug from a valid key', () => {
    expect(extractSlug(generateAgentKey('myagent'))).toBe('myagent');
    expect(extractSlug('anchor_foo_0123456789abcdef0123456789abcdef')).toBe('foo');
    expect(extractSlug('anchor_claude-code_0123456789abcdef0123456789abcdef')).toBe('claude-code');
  });

  it('returns null from extractSlug for an invalid key', () => {
    expect(extractSlug('not-a-key')).toBeNull();
    expect(extractSlug('anchor_foo_123')).toBeNull();
    expect(extractSlug('')).toBeNull();
  });
});
