type BackendErrorLike = {
  message?: string | null;
  code?: string | null;
  status?: number | null;
  name?: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504]);
const RETRYABLE_MESSAGE_FRAGMENTS = [
  "no connection to the server",
  "database client error",
  "schema cache",
  "database error querying schema",
  "unexpected eof",
  "failed to fetch",
  "network request failed",
  "fetch failed",
  "recovery mode",
  "eof detected",
  "terminating connection",
];

export const isRetryableBackendError = (error: BackendErrorLike | null | undefined) => {
  if (!error) return false;

  const message = `${error.message ?? ""}`.toLowerCase();
  return (
    error.code === "PGRST001" ||
    error.code === "PGRST002" ||
    (typeof error.status === "number" && RETRYABLE_STATUS_CODES.has(error.status)) ||
    RETRYABLE_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment))
  );
};

export async function retryBackendCall<T extends { error?: BackendErrorLike | null }>(
  operation: () => Promise<T>,
  attempts = 4,
  baseDelayMs = 350,
): Promise<T> {
  let lastResult: T | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await operation();
      lastResult = result;

      if (!isRetryableBackendError(result.error) || attempt === attempts - 1) {
        return result;
      }
    } catch (error) {
      const normalizedError = error as BackendErrorLike;
      if (!isRetryableBackendError(normalizedError) || attempt === attempts - 1) {
        throw error;
      }
    }

    const delay = Math.min(baseDelayMs * 2 ** attempt, 4000);
    await sleep(delay);
  }

  return lastResult as T;
}