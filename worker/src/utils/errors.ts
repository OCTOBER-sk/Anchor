export const MAX_JSON_BODY_BYTES = 1_000_000;

export type PlatformErrorCode =
  | 'SEARCH_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'MEMORY_UNAVAILABLE'
  | 'INVALID_PARAMS'
  | 'INTERNAL_ERROR';

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

const DEFAULT_MESSAGES: Record<PlatformErrorCode, string> = {
  SEARCH_UNAVAILABLE: 'Search is temporarily unavailable. Try again shortly.',
  RATE_LIMITED: 'Rate limit exceeded.',
  QUOTA_EXCEEDED: 'AI capacity temporarily exhausted.',
  MEMORY_UNAVAILABLE: 'Memory service is temporarily unavailable.',
  INVALID_PARAMS: 'Invalid parameters.',
  INTERNAL_ERROR: 'Internal server error.',
};

const PLATFORM_CODE_TO_JSON_RPC: Record<PlatformErrorCode, number> = {
  SEARCH_UNAVAILABLE: -32000,
  RATE_LIMITED: -32000,
  QUOTA_EXCEEDED: -32000,
  MEMORY_UNAVAILABLE: -32000,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

export function sanitizeDetails(code: PlatformErrorCode, internalMessage: string): string {
  switch (code) {
    case 'INVALID_PARAMS':
      return internalMessage.trim().length > 0 ? internalMessage : DEFAULT_MESSAGES[code];
    case 'INTERNAL_ERROR':
    case 'SEARCH_UNAVAILABLE':
    case 'RATE_LIMITED':
    case 'QUOTA_EXCEEDED':
    case 'MEMORY_UNAVAILABLE':
      return DEFAULT_MESSAGES[code];
  }
}

export function toJsonRpcError(code: PlatformErrorCode, detail?: string): JsonRpcError {
  return {
    code: PLATFORM_CODE_TO_JSON_RPC[code],
    message: sanitizeDetails(code, detail ?? ''),
    data: { platformCode: code },
  };
}

export class PlatformError extends Error {
  readonly code: PlatformErrorCode;
  readonly detail?: string;

  constructor(code: PlatformErrorCode, detail?: string) {
    super(detail ?? DEFAULT_MESSAGES[code]);
    this.name = 'PlatformError';
    this.code = code;
    this.detail = detail;
  }
}
