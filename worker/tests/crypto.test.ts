import { describe, it, expect } from 'vitest';
import type { Env } from '../src/context';
import { encrypt, decrypt, loadKey, getKeyCipher, KeyEncryptionKeyError } from '../src/utils/crypto';
import { buildTestEnv } from './test-utils';

function envWithoutKey(): Env {
  return {} as Env;
}

describe('utils/crypto — AES-256-GCM', () => {
  it('encrypt → decrypt round-trips the raw key to the identical string', async () => {
    const env = await buildTestEnv();
    const key = getKeyCipher(env);
    const rawKey = 'anchor_mykey_0123456789abcdef0123456789abcdef';

    const payload = await encrypt(rawKey, key);
    expect(payload).not.toContain(rawKey);
    expect(payload).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);

    const plaintext = await decrypt(payload, key);
    expect(plaintext).toBe(rawKey);
  });

  it('produces a unique ciphertext each time (random IV) for the same plaintext', async () => {
    const env = await buildTestEnv();
    const key = getKeyCipher(env);

    const a = await encrypt('anchor_same_0123456789abcdef0123456789abcdef', key);
    const b = await encrypt('anchor_same_0123456789abcdef0123456789abcdef', key);
    expect(a).not.toBe(b);
  });

  it('decrypt throws on a tampered payload (auth tag verification)', async () => {
    const env = await buildTestEnv();
    const key = getKeyCipher(env);
    const rawKey = 'anchor_tamper_0123456789abcdef0123456789abcdef';

    const payload = await encrypt(rawKey, key);
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0x01; // flip a bit in the final auth tag byte
    const tampered = btoa(String.fromCharCode(...bytes));

    await expect(decrypt(tampered, key)).rejects.toThrow();
  });

  it('decrypt throws when the wrong key is used', async () => {
    const env = await buildTestEnv();
    const key = getKeyCipher(env);
    const payload = await encrypt('anchor_wrongkey_0123456789abcdef0123456789abcdef', key);

    const otherKey = Uint8Array.from({ length: 32 }, (_, i) => (i + 1) % 256);
    await expect(decrypt(payload, otherKey)).rejects.toThrow();
  });

  it('loadKey decodes the base64 secret to a 32-byte key', async () => {
    const env = await buildTestEnv();
    const key = loadKey(env);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.byteLength).toBe(32);
  });

  it('getKeyCipher throws a clear KeyEncryptionKeyError when KEY_ENC_KEY is missing', () => {
    expect(() => getKeyCipher(envWithoutKey())).toThrow(KeyEncryptionKeyError);
    expect(() => getKeyCipher(envWithoutKey())).toThrow(/KEY_ENC_KEY/);
  });

  it('loadKey throws when KEY_ENC_KEY decodes to the wrong length', async () => {
    const env = await buildTestEnv();
    const bad = { ...env, KEY_ENC_KEY: btoa('too short') };
    expect(() => loadKey(bad)).toThrow(/32 bytes/);
  });
});
