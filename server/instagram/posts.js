const axios = require('axios');
const { defaultHeaders } = require('../config');
const { igGet } = require('./client');
const { toApiFeedItem } = require('./mappers');
const { logger } = require('../utils/logger');

/**
 * Parse Instagram post / reel / tv URL into path kind and shortcode.
 * -----------------------------------------------------------------------------
 * @param {string} rawUrl - Full Instagram URL.
 * @returns {{ kind: string, shortcode: string }|null} Parsed parts or null.
 */
const parseInstagramPostUrl = (rawUrl) => {
  try {
    const u = new URL(rawUrl.trim());
    const segments = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const typeIndex = segments.findIndex((s) => s === 'p' || s === 'reel' || s === 'tv');
    if (typeIndex === -1 || !segments[typeIndex + 1]) {
      return null;
    }
    const kind = segments[typeIndex];
    const shortcode = segments[typeIndex + 1].split('?')[0];
    if (!shortcode) {
      return null;
    }
    return { kind, shortcode };
  } catch {
    return null;
  }
};

/**
 * Extract numeric media pk from Instagram post HTML (public page).
 * -----------------------------------------------------------------------------
 * @param {string} html - HTML document.
 * @returns {string|null} Media pk or null.
 */
const extractMediaPkFromPostHtml = (html) => {
  if (!html || typeof html !== 'string') {
    return null;
  }
  const deepLink = html.match(/instagram:\/\/media\?id=(\d+)/);
  if (deepLink) {
    return deepLink[1];
  }
  const mediaId = html.match(/"media_id":"(\d+)"/);
  if (mediaId) {
    return mediaId[1];
  }
  return null;
};

/**
 * Fetch public Instagram post page HTML (for scraping media id).
 * -----------------------------------------------------------------------------
 * @param {string} shortcode - Post shortcode.
 * @param {string} kind - Path segment: p, reel, or tv.
 * @returns {Promise<string>} HTML body.
 */
const fetchInstagramPostHtml = async (shortcode, kind) => {
  const slug = kind === 'reel' || kind === 'tv' ? kind : 'p';
  const pageUrl = `https://www.instagram.com/${slug}/${shortcode}/`;
  const response = await axios.get(pageUrl, {
    timeout: 20000,
    headers: defaultHeaders
  });
  return response.data;
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

  logger.info('post', 'resolve start', { kind: parsed.kind, shortcode: parsed.shortcode });

  const html = await fetchInstagramPostHtml(parsed.shortcode, parsed.kind);
  const mediaPk = extractMediaPkFromPostHtml(html);
  if (!mediaPk) {
    logger.warn('post', 'media id not found', { kind: parsed.kind, shortcode: parsed.shortcode });
    const err = new Error('Could not resolve media id (private post, login required, or page changed)');
    err.statusCode = 404;
    throw err;
  }

  logger.debug('post', 'media pk resolved', { shortcode: parsed.shortcode, mediaPk });

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

  logger.info('post', 'resolve done', { username, shortcode: parsed.shortcode });
  return [normalized];
};

module.exports = {
  parseInstagramPostUrl,
  extractMediaPkFromPostHtml,
  fetchInstagramPostHtml,
  resolveInstagramPostItems
};
