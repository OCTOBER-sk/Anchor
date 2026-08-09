export interface SafeFetchOpts {
  allowedSchemes?: string[];
  allowedHosts?: string[];
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_SCHEMES = ['https'] as const;

function stripScheme(protocol: string): string {
  return protocol.replace(/:$/, '');
}

function parseIpv4(host: string): number | null {
  const parts = host.split('.');
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = value * 256 + octet;
  }
  return value;
}

function isPrivateIpv4(value: number): boolean {
  return (
    value === 0 || // 0.0.0.0/8 — "this network"
    (value >= 0x0a000000 && value <= 0x0affffff) || // 10.0.0.0/8 — private
    (value >= 0x64400000 && value <= 0x647fffff) || // 100.64.0.0/10 — CGNAT
    (value >= 0x7f000000 && value <= 0x7fffffff) || // 127.0.0.0/8 — loopback
    (value >= 0xa9fe0000 && value <= 0xa9feffff) || // 169.254.0.0/16 — link-local
    (value >= 0xac100000 && value <= 0xac1fffff) || // 172.16.0.0/12 — private
    (value >= 0xc0000000 && value <= 0xc00000ff) || // 192.0.0.0/24 — IETF protocol
    (value >= 0xc0a80000 && value <= 0xc0a8ffff) || // 192.168.0.0/16 — private
    (value >= 0xc6120000 && value <= 0xc613ffff) || // 198.18.0.0/15 — benchmarking
    (value >= 0xc6336400 && value <= 0xc63364ff) || // 198.51.100.0/24 — documentation
    (value >= 0xcb007100 && value <= 0xcb0071ff) || // 203.0.113.0/24 — documentation
    value >= 0xe0000000 // 224.0.0.0/3 — multicast + reserved
  );
}

function isPrivateIpv6(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === '::' || lower === '::1') {
    return true;
  }
  if (lower.startsWith('::ffff:')) {
    const embedded = lower.slice('::ffff:'.length);
    const v4 = parseIpv4(embedded);
    return v4 !== null && isPrivateIpv4(v4);
  }
  if (lower.startsWith('::') && lower.includes('.')) {
    const embedded = lower.slice(2);
    const v4 = parseIpv4(embedded);
    return v4 !== null && isPrivateIpv4(v4);
  }
  return (
    lower.startsWith('fe80:') || // link-local
    lower.startsWith('fc') || // ULA fc00::/7
    lower.startsWith('fd') || // ULA fc00::/7
    lower.startsWith('ff') || // multicast
    lower.startsWith('2001:db8:') // documentation
  );
}

function isIpLiteral(host: string): boolean {
  if (parseIpv4(host) !== null) {
    return true;
  }
  if (host.includes(':')) {
    return true;
  }
  return /^\d+$/.test(host);
}

function isPrivateIp(host: string): boolean {
  const v4 = parseIpv4(host);
  if (v4 !== null) {
    return isPrivateIpv4(v4);
  }
  if (host.includes(':')) {
    return isPrivateIpv6(host);
  }
  return false;
}

function hostMatchesAllowlist(host: string, allowlist: string[]): boolean {
  const lower = host.toLowerCase();
  for (const entry of allowlist) {
    const candidate = entry.toLowerCase();
    if (candidate.startsWith('*.')) {
      const base = candidate.slice(2);
      if (lower === base || lower.endsWith(`.${base}`)) {
        return true;
      }
    } else if (candidate.startsWith('.')) {
      const base = candidate.slice(1);
      if (lower === base || lower.endsWith(`.${base}`)) {
        return true;
      }
    } else if (lower === candidate) {
      return true;
    }
  }
  return false;
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '<unparseable-url>';
  }
}

export function validateFetchUrl(url: string, opts: SafeFetchOpts = {}): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const schemes = opts.allowedSchemes ?? [...DEFAULT_SCHEMES];
  if (!schemes.includes(stripScheme(parsed.protocol))) {
    return false;
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const allowlist = opts.allowedHosts ?? [];

  if (hostMatchesAllowlist(host, allowlist)) {
    return true;
  }
  if (isIpLiteral(host)) {
    return false;
  }
  if (allowlist.length > 0) {
    return false;
  }
  return !isPrivateIp(host);
}

export async function safeFetch(url: string, init: RequestInit = {}, opts: SafeFetchOpts = {}): Promise<Response> {
  if (!validateFetchUrl(url, opts)) {
    throw new Error(`Blocked by SSRF guard: ${redactUrl(url)}`);
  }
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal != null ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  return fetch(url, { ...init, signal });
}
