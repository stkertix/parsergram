const axios = require('axios');
const {
  IG_COOKIE,
  IG_SESSIONID,
  IG_WWW_CLAIM,
  COOKIE_CACHE_TTL_MS,
  defaultHeaders,
  igApiHeaders
} = require('../config');
const { requestContext } = require('../middleware/requestContext');
const { logger } = require('../utils/logger');

/** @type {Map<string, { header: string, at: number }>} */
const instagramCookieCache = new Map();

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
    logger.debug('ig', 'cookie bootstrapped', { source: getCookieSource() });
  } catch (error) {
    header = baseCookie;
    logger.warn('ig', 'cookie bootstrap skipped', { message: error.message });
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
 * @param {string} url - Target URL.
 * @param {object} [config={}] - Axios request config.
 * @returns {Promise<import('axios').AxiosResponse>} Axios response.
 */
const igGet = async (url, config = {}) => {
  const authHeaders = await getInstagramAuthHeaders();
  const headers = {
    ...igApiHeaders,
    ...authHeaders,
    ...(config.headers || {})
  };
  const started = Date.now();
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch (_error) {
    pathname = url;
  }

  try {
    const response = await axios.get(url, {
      ...config,
      headers
    });
    logger.debug('ig', `GET ${pathname}`, {
      status: response.status,
      ms: Date.now() - started,
      cookie: getCookieSource()
    });
    return response;
  } catch (error) {
    logger.warn('ig', `GET ${pathname} failed`, {
      status: error.response?.status,
      ms: Date.now() - started,
      cookie: getCookieSource(),
      message: error.message
    });
    throw error;
  }
};

module.exports = {
  getInstagramCookieHeader,
  getCookieSource,
  mergeCookieHeaders,
  getBootstrappedInstagramCookieHeader,
  getInstagramAuthHeaders,
  igGet
};
