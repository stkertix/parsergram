const WINDOW_MS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000
};

const MAX_EVENTS = 500;

/** @type {Array<{ at: number, kind: string, url: string, status?: number, ok?: boolean, req?: string }>} */
const events = [];

/**
 * Keep only recent events to bound memory.
 * -----------------------------------------------------------------------------
 */
const prune = () => {
  const cutoff = Date.now() - WINDOW_MS['15m'];
  while (events.length > 0 && events[0].at < cutoff) {
    events.shift();
  }
  while (events.length > MAX_EVENTS) {
    events.shift();
  }
};

/**
 * Record one Instagram-bound call for rate diagnostics.
 * -----------------------------------------------------------------------------
 * @param {{ kind?: string, url: string, status?: number, ok?: boolean, req?: string }} entry
 */
const recordIgCall = (entry) => {
  events.push({
    at: Date.now(),
    kind: entry.kind || 'ig',
    url: entry.url,
    status: entry.status,
    ok: entry.ok,
    req: entry.req
  });
  prune();
};

/**
 * Count events in a time window.
 * -----------------------------------------------------------------------------
 * @param {number} windowMs
 * @param {(e: object) => boolean} [filter]
 * @returns {number}
 */
const countInWindow = (windowMs, filter) => {
  const cutoff = Date.now() - windowMs;
  return events.filter((event) => event.at >= cutoff && (!filter || filter(event))).length;
};

/**
 * Snapshot of outbound IG call volume.
 * -----------------------------------------------------------------------------
 * @returns {{
 *   total15m: number,
 *   last1m: number,
 *   last5m: number,
 *   last15m: number,
 *   failed1m: number,
 *   rate429_1m: number,
 *   rate429_5m: number,
 *   rate429_15m: number,
 *   recent: string[]
 * }}
 */
const getIgRateSummary = () => {
  prune();
  const is429 = (event) => event.status === 429;
  const isFailed = (event) => event.ok === false;

  const recent = events
    .slice(-8)
    .map((event) => {
      const ageSec = Math.max(0, Math.round((Date.now() - event.at) / 1000));
      const mark = event.status === 429 ? '429' : (event.ok === false ? 'fail' : 'ok');
      return `${ageSec}s:${mark}:${event.url}`;
    });

  return {
    last1m: countInWindow(WINDOW_MS['1m']),
    last5m: countInWindow(WINDOW_MS['5m']),
    last15m: countInWindow(WINDOW_MS['15m']),
    failed1m: countInWindow(WINDOW_MS['1m'], isFailed),
    rate429_1m: countInWindow(WINDOW_MS['1m'], is429),
    rate429_5m: countInWindow(WINDOW_MS['5m'], is429),
    rate429_15m: countInWindow(WINDOW_MS['15m'], is429),
    recent
  };
};

module.exports = {
  recordIgCall,
  getIgRateSummary
};
