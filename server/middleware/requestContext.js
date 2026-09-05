const { AsyncLocalStorage } = require('async_hooks');
const { recordIgCall, getIgRateSummary } = require('../utils/igRateTracker');

const requestContext = new AsyncLocalStorage();

/**
 * Capture optional Instagram cookie from the frontend (X-IG-Cookie header).
 * -----------------------------------------------------------------------------
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const igCookieMiddleware = (req, res, next) => {
  const igCookie = (req.get('X-IG-Cookie') || '').trim();
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  requestContext.run({
    igCookie,
    requestId,
    outbound: []
  }, next);
};

/**
 * Record an outbound Instagram/network call for the active request + global rate.
 * -----------------------------------------------------------------------------
 * @param {{ method?: string, url: string, status?: number, ms?: number, ok?: boolean }} entry
 */
const trackOutbound = (entry) => {
  const store = requestContext.getStore();
  if (store) {
    if (!Array.isArray(store.outbound)) {
      store.outbound = [];
    }
    store.outbound.push(entry);
  }

  recordIgCall({
    url: entry.url,
    status: entry.status,
    ok: entry.ok,
    req: store?.requestId
  });

  // Lazy require avoids circular dependency with logger -> requestContext.
  const { logger } = require('../utils/logger');
  const rate = getIgRateSummary();
  logger.info('ig-rate', 'volume', {
    last1m: rate.last1m,
    last5m: rate.last5m,
    last15m: rate.last15m,
    failed1m: rate.failed1m,
    '429_1m': rate.rate429_1m,
    '429_5m': rate.rate429_5m
  });

  if (entry.status === 429) {
    logger.warn('ig-rate', 'RATE LIMITED (429) — recent outbound calls', {
      last1m: rate.last1m,
      last5m: rate.last5m,
      last15m: rate.last15m,
      '429_1m': rate.rate429_1m,
      '429_5m': rate.rate429_5m,
      '429_15m': rate.rate429_15m,
      recent: rate.recent.join(' | ')
    });
  }
};

/**
 * Snapshot of outbound calls for the active request.
 * -----------------------------------------------------------------------------
 * @returns {{ count: number, ok: number, failed: number, urls: string[] }}
 */
const getOutboundSummary = () => {
  const outbound = requestContext.getStore()?.outbound || [];
  return {
    count: outbound.length,
    ok: outbound.filter((item) => item.ok).length,
    failed: outbound.filter((item) => item.ok === false).length,
    urls: outbound.map((item) => item.url)
  };
};

module.exports = {
  requestContext,
  igCookieMiddleware,
  trackOutbound,
  getOutboundSummary,
  getIgRateSummary
};
