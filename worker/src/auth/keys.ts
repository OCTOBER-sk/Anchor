const KEY_PATTERN = /^anchor_([a-z0-9-]+)_([0-9a-f]{32})$/;
const SLUG_PATTERN = /^[a-z0-9-]+$/;

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateAgentKey(slug: string): string {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid agent key slug: "${slug}" — must be [a-z0-9-]+`);
  }
  return `anchor_${slug}_${randomHex(16)}`;
}

export function isValidKeyFormat(key: string): boolean {
  return typeof key === 'string' && KEY_PATTERN.test(key);
}

export function extractSlug(key: string): string | null {
  if (!isValidKeyFormat(key)) {
    return null;
  }
  return KEY_PATTERN.exec(key)?.[1] ?? null;
}
