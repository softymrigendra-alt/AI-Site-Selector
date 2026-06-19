export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  backoff?: boolean;
  shouldRetry?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts = 3, delayMs = 500, backoff = true, shouldRetry = () => true } = options;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1 && shouldRetry(err)) {
        const wait = backoff ? delayMs * 2 ** i : delayMs;
        await new Promise((r) => setTimeout(r, wait));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && err.message.toLowerCase().includes('fetch');
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export function friendlyMessage(err: unknown): string {
  if (isAbortError(err)) return 'Request timed out. Please try again.';
  if (isNetworkError(err)) return 'Network error — check your internet connection.';
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}
