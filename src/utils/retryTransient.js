// Retry only failures that can plausibly succeed a moment later, a limited number of times.
// 400 / 401 / 403 / 404 and every other client error are final: repeating them never helps.

const TRANSIENT_STATUSES = [408, 429, 500, 502, 503, 504];
export const RETRY_DELAYS_MS = [1000, 3000]; // two retries, so three attempts in total

/** True for a network failure (no response) or a temporary server status. */
export const isTransientError = (error) => {
  if (error?.code === "ERR_CANCELED") return false;
  const status = error?.response?.status;
  return status === undefined || TRANSIENT_STATUSES.includes(status);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `task`, retrying transient failures after the given delays. `isStillWanted` lets the
 * caller abandon the retries (for example when a different user has signed in).
 */
export async function retryTransient(task, { delays = RETRY_DELAYS_MS, isStillWanted = () => true } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= delays.length || !isTransientError(error)) throw error;
      await wait(delays[attempt]);
      if (!isStillWanted()) throw error;
    }
  }
}
