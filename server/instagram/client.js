const axios = require('axios');
const {
  IG_COOKIE,
  IG_SESSIONID,
  IG_WWW_CLAIM,
  COOKIE_CACHE_TTL_MS,
  IG_429_COOLDOWN_MS,
  IG_429_RETRY_MS,
  defaultHeaders,
  igApiHeaders
} = require('../config');
const { requestContext, trackOutbound } = require('../middleware/requestContext');
const { logger } = require('../utils/logger');
const { getIgRateSummary } = require('../utils/igRateTracker');

/** @type {Map<string, { header: string, at: number }>} */
const instagramCookieCache = new Map();

/** @type {number} */
let rateLimitCooldownUntil = 0;

/**
 * Resolve Instagram cookie: request override, then env vars.
 * -----------------------------------------------------------------------------
 * Frontend may send `X-IG-Cookie` so multiple accounts can be switched without
 * restarting the server. Falls back to IG_COOKIE / IG_SESSIONID from .env.
 * @returns {string} Cookie header value.
 */
const getInstagramCookieHeader = () => {
  const fromRequest = (requestContext.getStore()?.igCookie || '').trim();
  if (fromRequest === '__none__') {
    return '';
  }
  if (fromRequest) {
    return fromRequest;
  }
  if (IG_COOKIE) {
    return IG_COOKIE;
  }
  if (IG_SESSIONID) {
    return `sessionid=${IG_SESSIONID}`;
  }
  return '';
};

/**
 * Describe cookie source without exposing the cookie value.
 * -----------------------------------------------------------------------------
 * @returns {'none'|'request'|'env'|'sessionid'|'missing'}
 */
const getCookieSource = () => {
  const fromRequest = (requestContext.getStore()?.igCookie || '').trim();
  if (fromRequest === '__none__') {
    return 'none';
  }
  if (fromRequest) {
    return 'request';
  }
  if (IG_COOKIE) {
    return 'env';
  }
  if (IG_SESSIONID) {
    return 'sessionid';
  }
  return 'missing';
};

/**
 * Merge multiple cookie strings into one normalized header.
 * -----------------------------------------------------------------------------
 * @param {...string} cookieSources - Cookie header strings.
 * @returns {string} Merged cookie header.
 */
const mergeCookieHeaders = (...cookieSources) => {
  const cookieJar = {};

  cookieSources
    .filter(Boolean)
    .forEach((source) => {
      source.split(';').forEach((cookiePart) => {
        const [rawKey, ...rawValue] = cookiePart.trim().split('=');
        const key = (rawKey || '').trim();
        const value = rawValue.join('=').trim();
        if (!key || !value) {
          return;
        }
        cookieJar[key] = value;
      });
    });

  return Object.entries(cookieJar).map(([key, value]) => `${key}=${value}`).join('; ');
};

/**
 * Build a short label for outbound request logs.
 * -----------------------------------------------------------------------------
 * @param {string} url
 * @param {object} [config]
 * @returns {string}
 */
const formatOutboundTarget = (url, config = {}) => {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch (_error) {
    pathname = url;
  }

  const params = config.params || {};
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const text = typeof value === 'string' ? logger.truncate(value, 48) : String(value);
      return `${key}=${text}`;
    })
    .join('&');

  return query ? `${pathname}?${query}` : pathname;
};

/**
 * Whether outbound IG calls should pause after a recent 429.
 * -----------------------------------------------------------------------------
 * @returns {boolean}
 */
const isRateLimited = () => Date.now() < rateLimitCooldownUntil;

/**
 * Remaining cooldown ms after a 429.
 * -----------------------------------------------------------------------------
 * @returns {number}
 */
const getRateLimitCooldownMs = () => Math.max(0, rateLimitCooldownUntil - Date.now());

/**
 * Arm cooldown window after Instagram returns 429.
 * -----------------------------------------------------------------------------
 * @param {number} [ms]
 */
const armRateLimitCooldown = (ms = IG_429_COOLDOWN_MS) => {
  rateLimitCooldownUntil = Math.max(rateLimitCooldownUntil, Date.now() + ms);
  logger.warn('ig', 'cooldown armed', {
    ms: getRateLimitCooldownMs(),
    until: new Date(rateLimitCooldownUntil).toISOString()
  });
};

/**
 * Sleep helper for 429 retry.
 * -----------------------------------------------------------------------------
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bootstrap Instagram cookie with homepage set-cookie values.
 * -----------------------------------------------------------------------------
 * Helps feed endpoints that require csrftoken and companion cookies.
 * Cache is keyed by base cookie so frontend account switches stay isolated.
 * @returns {Promise<string>} Bootstrapped cookie header.
 */
const getBootstrappedInstagramCookieHeader = async () => {
  const now = Date.now();
  const baseCookie = getInstagramCookieHeader();
  if (!baseCookie) {
    return '';
  }

  const cached = instagramCookieCache.get(baseCookie);
  if (cached && (now - cached.at) < COOKIE_CACHE_TTL_MS) {
    logger.debug('ig', 'cookie cache hit', { source: getCookieSource() });
    return cached.header;
  }

  let header = baseCookie;
  const target = '/';
  const started = Date.now();
  logger.info('ig', `→ GET ${target}`, { purpose: 'cookie-bootstrap', cookie: getCookieSource() });
  try {
    const homepageResponse = await axios.get('https://www.instagram.com/', {
      timeout: 20000,
      headers: {
        'User-Agent': defaultHeaders['User-Agent'],
        'Cookie': baseCookie
      }
    });
    const responseCookies = (homepageResponse.headers['set-cookie'] || [])
      .map((cookieLine) => cookieLine.split(';')[0])
      .join('; ');
    header = mergeCookieHeaders(baseCookie, responseCookies);
    const ms = Date.now() - started;
    trackOutbound({
      method: 'GET',
      url: target,
      status: homepageResponse.status,
      ms,
      ok: true
    });
    logger.info('ig', `← GET ${target}`, {
      purpose: 'cookie-bootstrap',
      status: homepageResponse.status,
      ms,
      cookie: getCookieSource()
    });
  } catch (error) {
    header = baseCookie;
    const ms = Date.now() - started;
    trackOutbound({
      method: 'GET',
      url: target,
      status: error.response?.status,
      ms,
      ok: false
    });
    logger.warn('ig', `← GET ${target} failed`, {
      purpose: 'cookie-bootstrap',
      status: error.response?.status,
      ms,
      message: error.message
    });
  }

  instagramCookieCache.set(baseCookie, { header, at: now });
  return header;
};

/**
 * Build optional auth headers for Instagram API calls.
 * -----------------------------------------------------------------------------
 * @returns {Promise<Record<string, string>>} Auth headers object.
 */
const getInstagramAuthHeaders = async () => {
  const cookieHeader = await getBootstrappedInstagramCookieHeader();
  if (!cookieHeader) {
    return {
      'X-IG-WWW-Claim': IG_WWW_CLAIM
    };
  }

  const csrfMatch = cookieHeader.match(/(?:^|;\s*)csrftoken=([^;]+)/i);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';

  return {
    'Cookie': cookieHeader,
    'X-IG-WWW-Claim': IG_WWW_CLAIM,
    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {})
  };
};

/**
 * Perform authenticated GET request to Instagram API.
 * -----------------------------------------------------------------------------
 * Retries once on 429 after a short wait, then arms a cooldown window.
 * @param {string} url - Target URL.
 * @param {object} [config={}] - Axios request config.
 * @param {boolean} [config.bypassCooldown] - Allow call even during global cooldown.
 * @param {boolean} [config.skipCooldownArm] - Do not arm cooldown on 429 (for fallbacks).
 * @returns {Promise<import('axios').AxiosResponse>} Axios response.
 */
const igGet = async (url, config = {}) => {
  const {
    bypassCooldown = false,
    skipCooldownArm = false,
    ...axiosConfig
  } = config;

  if (isRateLimited() && !bypassCooldown) {
    const waitMs = getRateLimitCooldownMs();
    const err = new Error(`Instagram rate limit cooldown active (${Math.ceil(waitMs / 1000)}s left)`);
    err.statusCode = 429;
    err.response = { status: 429, data: { cooldown_ms: waitMs } };
    logger.warn('ig', 'blocked by cooldown', {
      target: formatOutboundTarget(url, axiosConfig),
      waitMs
    });
    throw err;
  }

  const authHeaders = await getInstagramAuthHeaders();
  const headers = {
    ...igApiHeaders,
    ...authHeaders,
    ...(axiosConfig.headers || {})
  };
  const target = formatOutboundTarget(url, axiosConfig);

  const attemptOnce = async (attempt) => {
    const started = Date.now();
    logger.info('ig', `→ GET ${target}`, {
      cookie: getCookieSource(),
      attempt
    });

    try {
      const response = await axios.get(url, {
        ...axiosConfig,
        headers
      });
      const ms = Date.now() - started;
      trackOutbound({
        method: 'GET',
        url: target,
        status: response.status,
        ms,
        ok: true
      });
      logger.info('ig', `← GET ${target}`, {
        status: response.status,
        ms,
        cookie: getCookieSource(),
        attempt
      });
      return response;
    } catch (error) {
      const ms = Date.now() - started;
      const status = error.response?.status;
      trackOutbound({
        method: 'GET',
        url: target,
        status,
        ms,
        ok: false
      });
      logger.warn('ig', `← GET ${target} failed`, {
        status,
        ms,
        cookie: getCookieSource(),
        attempt,
        message: error.message
      });
      throw error;
    }
  };

  try {
    return await attemptOnce(1);
  } catch (error) {
    if (error.response?.status !== 429) {
      throw error;
    }

    if (!skipCooldownArm) {
      armRateLimitCooldown();
    }
    const rate = getIgRateSummary();
    logger.warn('ig', '429 received, retrying once after backoff', {
      retryMs: IG_429_RETRY_MS,
      last1m: rate.last1m,
      last5m: rate.last5m,
      skipCooldownArm
    });

    await sleep(IG_429_RETRY_MS);

    // Allow a single retry through the cooldown window.
    rateLimitCooldownUntil = 0;
    try {
      return await attemptOnce(2);
    } catch (retryError) {
      if (retryError.response?.status === 429 && !skipCooldownArm) {
        armRateLimitCooldown();
      }
      throw retryError;
    }
  }
};

/**
 * Instagram GraphQL persisted query (doc_id), POST first then GET fallback.
 * -----------------------------------------------------------------------------
 * @param {string} docId
 * @param {object} variables
 * @param {{ bypassCooldown?: boolean, skipCooldownArm?: boolean, referer?: string }} [options]
 * @returns {Promise<object>} Parsed GraphQL JSON body
 */
const igGraphqlQuery = async (docId, variables, options = {}) => {
  const {
    bypassCooldown = false,
    skipCooldownArm = false,
    referer
  } = options;

  if (isRateLimited() && !bypassCooldown) {
    const waitMs = getRateLimitCooldownMs();
    const err = new Error(`Instagram rate limit cooldown active (${Math.ceil(waitMs / 1000)}s left)`);
    err.statusCode = 429;
    err.response = { status: 429, data: { cooldown_ms: waitMs } };
    throw err;
  }

  const authHeaders = await getInstagramAuthHeaders();
  const variablesJson = JSON.stringify(variables);
  const params = {
    doc_id: docId,
    variables: variablesJson,
    server_timestamps: 'true'
  };
  const headers = {
    ...igApiHeaders,
    ...authHeaders,
    'Accept': '*/*',
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(referer ? { Referer: referer } : {})
  };
  const target = `/graphql/query/?doc_id=${docId}`;
  const started = Date.now();

  logger.info('ig', `→ POST ${target}`, { cookie: getCookieSource() });

  try {
    const response = await axios.post(
      'https://www.instagram.com/graphql/query/',
      new URLSearchParams(params).toString(),
      {
        timeout: 20000,
        headers
      }
    );
    const ms = Date.now() - started;
    trackOutbound({
      method: 'POST',
      url: target,
      status: response.status,
      ms,
      ok: true
    });
    logger.info('ig', `← POST ${target}`, {
      status: response.status,
      ms,
      cookie: getCookieSource()
    });
    return response.data;
  } catch (postError) {
    const postStatus = postError.response?.status;
    trackOutbound({
      method: 'POST',
      url: target,
      status: postStatus,
      ms: Date.now() - started,
      ok: false
    });
    logger.warn('ig', `← POST ${target} failed`, {
      status: postStatus,
      message: postError.message
    });

    if (postStatus === 429) {
      if (!skipCooldownArm) {
        armRateLimitCooldown();
      }
      throw postError;
    }

    // Some environments only accept GET for persisted queries.
    logger.info('ig', `→ GET ${target}`, { cookie: getCookieSource(), fallback: 'graphql-get' });
    const getStarted = Date.now();
    try {
      const response = await axios.get('https://www.instagram.com/graphql/query/', {
        params,
        timeout: 20000,
        headers: {
          ...igApiHeaders,
          ...authHeaders,
          ...(referer ? { Referer: referer } : {})
        }
      });
      trackOutbound({
        method: 'GET',
        url: target,
        status: response.status,
        ms: Date.now() - getStarted,
        ok: true
      });
      logger.info('ig', `← GET ${target}`, {
        status: response.status,
        ms: Date.now() - getStarted
      });
      return response.data;
    } catch (getError) {
      trackOutbound({
        method: 'GET',
        url: target,
        status: getError.response?.status,
        ms: Date.now() - getStarted,
        ok: false
      });
      if (getError.response?.status === 429 && !skipCooldownArm) {
        armRateLimitCooldown();
      }
      throw getError;
    }
  }
};

module.exports = {
  getInstagramCookieHeader,
  getCookieSource,
  mergeCookieHeaders,
  getBootstrappedInstagramCookieHeader,
  getInstagramAuthHeaders,
  igGet,
  igGraphqlQuery,
  isRateLimited,
  getRateLimitCooldownMs,
  armRateLimitCooldown
};
