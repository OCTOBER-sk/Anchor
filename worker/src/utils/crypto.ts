import type { Env } from '../context';

const IV_LENGTH = 12;
const AES_KEY_BYTES = 32;

const KEY_MISSING_MESSAGE =
  'KEY_ENC_KEY secret is missing. Set KEY_ENC_KEY (base64-encoded 32-byte AES-256 key) before creating or revealing agent keys.';

export class KeyEncryptionKeyError extends Error {
  constructor() {
    super(KEY_MISSING_MESSAGE);
    this.name = 'KeyEncryptionKeyError';
  }
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/, '');
  if (clean.length % 4 === 1 || !/^[A-Za-z0-9+/]*$/.test(clean)) {
    throw new Error('Invalid base64 payload.');
  }
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = BASE64_ALPHABET.indexOf(clean[i] ?? '');
    const b = i + 1 < clean.length ? BASE64_ALPHABET.indexOf(clean[i + 1] ?? '') : 0;
    const c = i + 2 < clean.length ? BASE64_ALPHABET.indexOf(clean[i + 2] ?? '') : 0;
    const d = i + 3 < clean.length ? BASE64_ALPHABET.indexOf(clean[i + 3] ?? '') : 0;
    if (a < 0 || b < 0 || c < 0 || d < 0) {
      throw new Error('Invalid base64 payload.');
    }
    bytes.push((a << 2) | (b >> 4));
    if (i + 2 < clean.length) {
      bytes.push(((b & 15) << 4) | (c >> 2));
    }
    if (i + 3 < clean.length) {
      bytes.push(((c & 3) << 6) | d);
    }
  }
  return Uint8Array.from(bytes);
}

function base64Encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0;
    out += BASE64_ALPHABET[b0 >> 2] ?? '';
    out += BASE64_ALPHABET[((b0 & 3) << 4) | (b1 >> 4)] ?? '';
    out += i + 1 < bytes.length ? BASE64_ALPHABET[((b1 & 15) << 2) | (b2 >> 6)] ?? '' : '=';
    out += i + 2 < bytes.length ? BASE64_ALPHABET[b2 & 63] ?? '' : '=';
  }
  return out;
}

// Decodes the AES key from env.KEY_ENC_KEY (base64, exactly 32 bytes for
// AES-256-GCM). Throws a clear Error — this is a deploy-time config error and
// must never silently fall back to plaintext storage.
export function loadKey(env: Env): Uint8Array {
  const raw = env.KEY_ENC_KEY;
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new KeyEncryptionKeyError();
  }
  const bytes = base64Decode(raw);
  if (bytes.length !== AES_KEY_BYTES) {
    throw new Error(`KEY_ENC_KEY must decode to exactly 32 bytes (AES-256); got ${bytes.length} bytes.`);
  }
  return bytes;
}

// Small helper used by the create/reveal paths so a missing secret fails
// loudly (with KEY_MISSING_MESSAGE) before any crypto or storage work.
export function getKeyCipher(env: Env): Uint8Array {
  return loadKey(env);
}

// AES-256-GCM encrypt. Output: base64(iv || ciphertext || authTag).
export async function encrypt(plaintext: string, key: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(plaintext)),
  );
  const combined = new Uint8Array(IV_LENGTH + sealed.length);
  combined.set(iv, 0);
  combined.set(sealed, IV_LENGTH);
  return base64Encode(combined);
}

// AES-256-GCM decrypt. Reverses encrypt(); throws on any tampering or
// truncated/corrupt payload.
export async function decrypt(payload: string, key: Uint8Array): Promise<string> {
  const combined = base64Decode(payload);
  if (combined.length < IV_LENGTH + 16) {
    throw new Error('Ciphertext payload is too short.');
  }
  const iv = combined.slice(0, IV_LENGTH);
  const sealed = combined.slice(IV_LENGTH);
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, sealed));
  return new TextDecoder().decode(plaintext);
}
