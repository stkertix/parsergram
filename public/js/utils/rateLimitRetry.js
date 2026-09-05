const DEFAULT_RETRY_AFTER_MS = 60 * 1000;
const MAX_AUTO_RETRIES = 3;

/**
 * Build an Error from a failed fetch Response, preserving 429 retry timing.
 * -----------------------------------------------------------------------------
 * @param {Response} response
 * @param {object} [fallbackBody]
 * @returns {Promise<Error & { status?: number, retryAfterMs?: number }>}
 */
export async function errorFromResponse(response, fallbackBody = {}) {
  const body = await response.json().catch(() => fallbackBody);
  const error = new Error(body.message || `HTTP ${response.status}`);
  error.status = response.status;
  if (response.status === 429) {
    const retryAfter = Number(body.retry_after_ms);
    error.retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter
      : DEFAULT_RETRY_AFTER_MS;
  }
  return error;
}

/**
 * Whether an error should trigger cooldown auto-retry.
 * -----------------------------------------------------------------------------
 * @param {unknown} error
 * @returns {boolean}
 */
export function isRateLimitError(error) {
  if (!error) {
    return false;
  }
  if (error.status === 429) {
    return true;
  }
  return /rate limit|429|cooldown/i.test(String(error.message || ''));
}

/**
 * Resolve wait time for auto-retry.
 * -----------------------------------------------------------------------------
 * @param {unknown} error
 * @returns {number}
 */
export function getRetryAfterMs(error) {
  const value = Number(error?.retryAfterMs);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return DEFAULT_RETRY_AFTER_MS;
}

export {
  DEFAULT_RETRY_AFTER_MS,
  MAX_AUTO_RETRIES
};
