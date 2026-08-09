import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ping } from '../src/utils/keepalive';
import { buildTestEnv } from './test-utils';

vi.mock('../src/storage/supabase', () => ({
  pingKeepalive: vi.fn(),
  writeMemory: vi.fn(),
  matchMemories: vi.fn(),
  matchMemoriesLite: vi.fn(),
}));

vi.mock('../src/utils/monitoring', () => ({
  captureError: vi.fn(),
}));

import { pingKeepalive } from '../src/storage/supabase';
import { captureError } from '../src/utils/monitoring';

beforeEach(() => {
  vi.mocked(pingKeepalive).mockReset();
  vi.mocked(captureError).mockReset();
});

describe('utils/keepalive', () => {
  it('pings Supabase through storage/supabase::pingKeepalive', async () => {
    vi.mocked(pingKeepalive).mockResolvedValue(undefined);
    const env = await buildTestEnv();

    await expect(ping(env)).resolves.toBeUndefined();

    expect(pingKeepalive).toHaveBeenCalledTimes(1);
    expect(pingKeepalive).toHaveBeenCalledWith(env);
    expect(captureError).not.toHaveBeenCalled();
  });

  it('never throws when the ping fails — logs via captureError instead', async () => {
    vi.mocked(pingKeepalive).mockRejectedValue(new Error('Supabase project paused'));
    const env = await buildTestEnv();

    await expect(ping(env)).resolves.toBeUndefined();

    expect(pingKeepalive).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith('utils/keepalive.ts::ping', expect.any(Error));
  });
});
