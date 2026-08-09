import type { Env } from '../context';
import { getRateLimitState, setRateLimitState, type RateLimitState } from '../storage/kv';

export interface RateLimits {
  perMinute: number;
  perDay: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingMinute: number;
  remainingDay: number;
  resetAtMinute: string;
  resetAtDay: string;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;

export async function checkAndIncrement(agentId: string, limits: RateLimits, env: Env): Promise<RateLimitResult> {
  const now = Date.now();
  const state: RateLimitState =
    (await getRateLimitState(agentId, env)) ?? {
      minuteCount: 0,
      minuteWindowStart: now,
      dayCount: 0,
      dayWindowStart: now,
    };

  if (now >= state.minuteWindowStart + MINUTE_MS) {
    state.minuteCount = 0;
    state.minuteWindowStart = now;
  }
  if (now >= state.dayWindowStart + DAY_MS) {
    state.dayCount = 0;
    state.dayWindowStart = now;
  }

  if (state.minuteCount >= limits.perMinute || state.dayCount >= limits.perDay) {
    await setRateLimitState(agentId, state, env);
    return {
      allowed: false,
      remainingMinute: Math.max(0, limits.perMinute - state.minuteCount),
      remainingDay: Math.max(0, limits.perDay - state.dayCount),
      resetAtMinute: new Date(state.minuteWindowStart + MINUTE_MS).toISOString(),
      resetAtDay: new Date(state.dayWindowStart + DAY_MS).toISOString(),
    };
  }

  state.minuteCount += 1;
  state.dayCount += 1;
  await setRateLimitState(agentId, state, env);

  return {
    allowed: true,
    remainingMinute: Math.max(0, limits.perMinute - state.minuteCount),
    remainingDay: Math.max(0, limits.perDay - state.dayCount),
    resetAtMinute: new Date(state.minuteWindowStart + MINUTE_MS).toISOString(),
    resetAtDay: new Date(state.dayWindowStart + DAY_MS).toISOString(),
  };
}
