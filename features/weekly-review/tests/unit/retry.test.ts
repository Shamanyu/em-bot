import { describe, it, expect, vi } from 'vitest';
import { withExponentialBackoff } from '@shared/lib/retry.js';

describe('withExponentialBackoff', () => {
  it('returns immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withExponentialBackoff(fn, { retries: 3, initialDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    const result = await withExponentialBackoff(fn, { retries: 3, initialDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(
      withExponentialBackoff(fn, { retries: 2, initialDelayMs: 1 }),
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));
    await expect(
      withExponentialBackoff(fn, {
        retries: 3,
        initialDelayMs: 1,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow('non-retryable');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
