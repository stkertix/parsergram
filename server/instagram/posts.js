const axios = require('axios');
const { defaultHeaders } = require('../config');
const { igGet, getInstagramAuthHeaders, getCookieSource } = require('./client');
const { toApiFeedItem } = require('./mappers');
const { trackOutbound } = require('../middleware/requestContext');
const { logger } = require('../utils/logger');

const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Parse Instagram post / reel / tv / share URL into path parts.
 * -----------------------------------------------------------------------------
 * @param {string} rawUrl - Full Instagram URL.
 * @returns {{ kind: string, shortcode: string, isShare: boolean }|null}
 */
const parseInstagramPostUrl = (rawUrl) => {
  try {
    const u = new URL(rawUrl.trim());
    const segments = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const isShare = segments[0] === 'share';
    const typeIndex = segments.findIndex((s) => s === 'p' || s === 'reel' || s === 'tv');
    if (typeIndex === -1 || !segments[typeIndex + 1]) {
      return null;
    }
    const kind = segments[typeIndex];
    const shortcode = segments[typeIndex + 1].split('?')[0];
    if (!shortcode) {
      return null;
    }
    return { kind, shortcode, isShare };
  } catch {
    return null;
  }
};

/**
 * Convert classic Instagram shortcode to numeric media pk.
 * -----------------------------------------------------------------------------
 * Works for /p/{code}/ shortcodes, not for /share/p/{token}/ tokens.
 * @param {string} shortcode
 * @returns {string|null}
 */
const shortcodeToMediaPk = (shortcode) => {
  if (!shortcode || /[^A-Za-z0-9\-_]/.test(shortcode)) {
    return null;
  }
  // Share tokens are usually much longer than classic shortcodes (~11).
  if (shortcode.length > 15) {
    return null;
  }

  let id = 0n;
  for (const char of shortcode) {
    const index = SHORTCODE_ALPHABET.indexOf(char);
    if (index < 0) {
      return null;
    }
    id = (id * 64n) + BigInt(index);
  }
  const asString = id.toString();
  return asString === '0' ? null : asString;
};

/**
 * Extract numeric media pk from Instagram post HTML.
 * -----------------------------------------------------------------------------
 * @param {string} html - HTML document.
 * @returns {string|null} Media pk or null.
 */
const extractMediaPkFromPostHtml = (html) => {
  if (!html || typeof html !== 'string') {
    return null;
  }

  const patterns = [
    /instagram:\/\/media\?id=(\d+)/,
    /"media_id"\s*:\s*"(\d+)"/,
    /"media_id"\s*:\s*(\d+)/,
    /"pk"\s*:\s*"(\d+)"/,
    /"pk"\s*:\s*(\d+)/,
    /"mediaid"\s*:\s*"(\d+)"/i,
    /content=["']instagram:\/\/media\?id=(\d+)["']/
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  const canonical = html.match(/property=["']og:url["']\s+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["']\s+property=["']og:url["']/i);
  if (canonical?.[1]) {
    const parsed = parseInstagramPostUrl(canonical[1]);
    if (parsed && !parsed.isShare) {
      return shortcodeToMediaPk(parsed.shortcode);
    }
  }

  return null;
};

/**
 * Detect login / challenge wall HTML.
 * -----------------------------------------------------------------------------
 * @param {string} html
 * @returns {boolean}
 */
const looksLikeLoginWall = (html) => {
  if (!html || typeof html !== 'string') {
    return true;
  }
  return /("|')login_required("|')/i.test(html)
    || /www\.instagram\.com\/accounts\/login/i.test(html)
    || /"require_login"\s*:\s*true/i.test(html);
};

/**
 * Build page URL for a parsed post reference.
 * -----------------------------------------------------------------------------
 * @param {{ kind: string, shortcode: string, isShare: boolean }} parsed
 * @returns {string}
 */
const buildPostPageUrl = (parsed) => {
  const slug = parsed.kind === 'reel' || parsed.kind === 'tv' ? parsed.kind : 'p';
  if (parsed.isShare) {
    return `https://www.instagram.com/share/${slug}/${parsed.shortcode}/`;
  }
  return `https://www.instagram.com/${slug}/${parsed.shortcode}/`;
};

/**
 * Resolve final URL after axios redirects (Node).
 * -----------------------------------------------------------------------------
 * @param {import('axios').AxiosResponse} response
 * @param {string} fallbackUrl
 * @returns {string}
 */
const getFinalResponseUrl = (response, fallbackUrl) => {
  return response.request?.res?.responseUrl
    || response.request?.responseURL
    || response.config?.url
    || fallbackUrl;
};

/**
 * Fetch Instagram post page HTML with auth cookie (needed for private / share links).
 * -----------------------------------------------------------------------------
 * @param {{ kind: string, shortcode: string, isShare: boolean }} parsed
 * @returns {Promise<{ html: string, finalUrl: string, status: number }>}
 */
const fetchInstagramPostHtml = async (parsed) => {
  const pageUrl = buildPostPageUrl(parsed);
  const authHeaders = await getInstagramAuthHeaders();
  const started = Date.now();
  const target = pageUrl.replace('https://www.instagram.com', '');

  logger.info('post', `→ GET ${target}`, { cookie: getCookieSource(), share: parsed.isShare });

  try {
    const response = await axios.get(pageUrl, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        ...defaultHeaders,
        ...authHeaders,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const ms = Date.now() - started;
    const finalUrl = getFinalResponseUrl(response, pageUrl);
    trackOutbound({
      method: 'GET',
      url: target,
      status: response.status,
      ms,
      ok: true
    });
    logger.info('post', `← GET ${target}`, {
      status: response.status,
      ms,
      final: finalUrl.replace('https://www.instagram.com', ''),
      htmlBytes: typeof response.data === 'string' ? response.data.length : 0
    });
    return {
      html: typeof response.data === 'string' ? response.data : '',
      finalUrl,
      status: response.status
    };
  } catch (error) {
    const ms = Date.now() - started;
    trackOutbound({
      method: 'GET',
      url: target,
      status: error.response?.status,
      ms,
      ok: false
    });
    logger.warn('post', `← GET ${target} failed`, {
      status: error.response?.status,
      ms,
      message: error.message
    });
    throw error;
  }
};

/**
 * Resolve media pk from parsed URL using share redirect, shortcode decode, then HTML.
 * -----------------------------------------------------------------------------
 * @param {{ kind: string, shortcode: string, isShare: boolean }} parsed
 * @returns {Promise<{ mediaPk: string, shortcode: string, kind: string }>}
 */
const resolveMediaPk = async (parsed) => {
  let kind = parsed.kind;
  let shortcode = parsed.shortcode;

  // Classic shortcodes can be decoded without a page fetch.
  let mediaPk = shortcodeToMediaPk(shortcode);
  if (mediaPk) {
    logger.info('post', 'media pk from shortcode', { shortcode, mediaPk });
    return { mediaPk, shortcode, kind };
  }

  // Long tokens are usually share links even if pasted as /p/{token}/.
  const attempts = [];
  if (parsed.isShare || shortcode.length > 15) {
    attempts.push({ ...parsed, isShare: true });
  }
  attempts.push({ ...parsed, isShare: false });

  let lastHtml = '';
  let sawLoginWall = false;

  for (const attempt of attempts) {
    try {
      const page = await fetchInstagramPostHtml(attempt);
      lastHtml = page.html;
      if (looksLikeLoginWall(page.html)) {
        sawLoginWall = true;
      }

      const redirected = parseInstagramPostUrl(page.finalUrl);
      if (redirected && !redirected.isShare) {
        kind = redirected.kind;
        shortcode = redirected.shortcode;
        logger.info('post', 'canonical after redirect', { kind, shortcode });

        mediaPk = shortcodeToMediaPk(shortcode);
        if (mediaPk) {
          logger.info('post', 'media pk from shortcode', { shortcode, mediaPk });
          return { mediaPk, shortcode, kind };
        }
      }

      mediaPk = extractMediaPkFromPostHtml(page.html);
      if (mediaPk) {
        logger.info('post', 'media pk from html', { shortcode, mediaPk });
        return { mediaPk, shortcode, kind };
      }
    } catch (error) {
      logger.warn('post', 'page fetch attempt failed', {
        share: attempt.isShare,
        message: error.message
      });
    }
  }

  if (sawLoginWall || looksLikeLoginWall(lastHtml)) {
    const err = new Error('Instagram returned a login wall for this post; check that your IG cookie is valid and includes sessionid');
    err.statusCode = 401;
    throw err;
  }

  const err = new Error('Could not resolve media id (private post, share link unresolved, or page changed)');
  err.statusCode = 404;
  throw err;
};

/**
 * Resolve a single post/reel URL into normalized items for the frontend parser.
 * -----------------------------------------------------------------------------
 * @param {string} rawUrl - Instagram post URL.
 * @returns {Promise<object[]>} Array with one normalized item (carousel expanded in item).
 */
const resolveInstagramPostItems = async (rawUrl) => {
  const parsed = parseInstagramPostUrl(rawUrl);
  if (!parsed) {
    const err = new Error('Invalid Instagram post URL');
    err.statusCode = 400;
    throw err;
  }

  logger.info('post', 'resolve start', {
    kind: parsed.kind,
    shortcode: parsed.shortcode,
    share: parsed.isShare,
    cookie: getCookieSource()
  });

  const { mediaPk, shortcode, kind } = await resolveMediaPk(parsed);

  const mediaResponse = await igGet(`https://www.instagram.com/api/v1/media/${mediaPk}/info/`, {
    timeout: 20000
  });
  const payload = mediaResponse.data;
  if (!payload || typeof payload === 'string') {
    const err = new Error('Instagram media API returned an unexpected response; try setting IG_COOKIE');
    err.statusCode = 502;
    throw err;
  }

  const rawItem = payload.items?.[0];
  if (!rawItem) {
    const err = new Error('Media not found');
    err.statusCode = 404;
    throw err;
  }

  const username = rawItem.user?.username || 'unknown';
  const normalized = toApiFeedItem(rawItem, username);
  if (!normalized) {
    const err = new Error('Could not normalize media item');
    err.statusCode = 422;
    throw err;
  }

  logger.info('post', 'resolve done', { username, kind, shortcode, mediaPk });
  return [normalized];
};

module.exports = {
  parseInstagramPostUrl,
  shortcodeToMediaPk,
  extractMediaPkFromPostHtml,
  fetchInstagramPostHtml,
  resolveInstagramPostItems
};
