export interface RetryOptions {
  retries: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const { retries, initialDelayMs = 1000, maxDelayMs = 30000, shouldRetry } = opts;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      if (shouldRetry && !shouldRetry(err)) throw err;

      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = Math.random() * delay * 0.2;
      await sleep(delay + jitter);
      attempt++;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
