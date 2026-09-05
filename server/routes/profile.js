const { route } = require('../config');
const { getCookieSource, isRateLimited, getRateLimitCooldownMs } = require('../instagram/client');
const { toProfilePictureItem } = require('../instagram/mappers');
const { getFeedItems } = require('../instagram/feed');
const { resolveHighlightTray } = require('../instagram/highlights');
const { getWebProfileUser } = require('../instagram/profileInfo');
const { getOutboundSummary } = require('../middleware/requestContext');
const { logger } = require('../utils/logger');

const VALID_PARTS = new Set(['feed', 'highlight', 'story']);

/**
 * Parse ?parts=feed,highlight,story (default: feed,highlight).
 * Story is usually fetched via /story; including it here is ignored for items.
 * -----------------------------------------------------------------------------
 * @param {unknown} raw
 * @returns {{ feed: boolean, highlight: boolean, story: boolean }}
 */
const parseParts = (raw) => {
  const text = (raw || '').toString().trim().toLowerCase();
  if (!text || text === 'none') {
    // Explicit empty selection: profile picture only (no feed/highlight).
    if (text === 'none') {
      return { feed: false, highlight: false, story: false };
    }
    return { feed: true, highlight: true, story: false };
  }
  const selected = new Set(
    text.split(',').map((part) => part.trim()).filter((part) => VALID_PARTS.has(part))
  );
  if (selected.size === 0) {
    return { feed: false, highlight: false, story: false };
  }
  return {
    feed: selected.has('feed'),
    highlight: selected.has('highlight'),
    story: selected.has('story')
  };
};

/**
 * Send a rate-limit friendly JSON error.
 * -----------------------------------------------------------------------------
 * @param {import('express').Response} res
 * @param {Error} error
 */
const sendRateLimitError = (res, error) => {
  const waitMs = error.response?.data?.cooldown_ms || getRateLimitCooldownMs();
  return res.status(429).json({
    error: 'Instagram rate limited',
    message: error.message || 'Too many requests to Instagram. Wait and try again.',
    retry_after_ms: waitMs
  });
};

/**
 * Aggregate profile media by username for the requested parts.
 * -----------------------------------------------------------------------------
 * @param {import('express').Express} app
 */
const registerProfileRoutes = (app) => {
  app.get(route('/profile'), async (req, res) => {
    try {
      const username = (req.query.username || '').toString().trim().replace(/^@/, '');
      if (!username) {
        return res.status(400).json({ error: 'username parameter is required' });
      }

      const parts = parseParts(req.query.parts);
      logger.info('profile', 'fetch start', {
        username,
        cookie: getCookieSource(),
        parts: Object.entries(parts).filter(([, on]) => on).map(([key]) => key).join(',') || 'none'
      });

      const user = await getWebProfileUser(username);

      logger.info('profile', 'user resolved', {
        username: user.username || username,
        userId: user.id
      });

      let feedItems = [];
      if (parts.feed) {
        logger.info('profile', 'step feed');
        feedItems = await getFeedItems(user, username);
      } else {
        logger.info('profile', 'step feed skipped');
      }

      let highlightTray = [];
      if (parts.highlight) {
        try {
          logger.info('profile', 'step highlight tray');
          highlightTray = await resolveHighlightTray(user);
          logger.info('profile', 'highlight tray ready', { count: highlightTray.length });
        } catch (highlightError) {
          logger.warn('profile', 'highlight tray skipped', { username, message: highlightError.message });
        }
      } else {
        logger.info('profile', 'step highlight skipped');
      }

      const profilePictureItem = toProfilePictureItem(user, user.username || username);
      const items = [
        ...(profilePictureItem ? [profilePictureItem] : []),
        ...feedItems
      ];

      const outbound = getOutboundSummary();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      logger.info('profile', 'fetch done', {
        username: user.username || username,
        feed: feedItems.length,
        highlights: highlightTray.length,
        profilePic: Boolean(profilePictureItem),
        parts: Object.entries(parts).filter(([, on]) => on).map(([key]) => key).join(','),
        outbound: outbound.count,
        outboundOk: outbound.ok,
        outboundFailed: outbound.failed
      });
      if (outbound.urls.length > 0) {
        logger.info('profile', 'outbound calls', {
          list: outbound.urls.join(' | ')
        });
      }
      return res.status(200).json({
        items,
        highlight_tray: highlightTray,
        user_id: user.id,
        parts
      });
    } catch (error) {
      const status = error.statusCode || error.response?.status || 500;
      const outbound = getOutboundSummary();
      logger.error('profile', 'fetch failed', {
        status,
        requireLogin: Boolean(error.response?.data?.require_login),
        message: error.message,
        outbound: outbound.count,
        outboundOk: outbound.ok,
        outboundFailed: outbound.failed
      });
      if (outbound.urls.length > 0) {
        logger.info('profile', 'outbound calls', {
          list: outbound.urls.join(' | ')
        });
      }
      if (status === 429 || isRateLimited()) {
        return sendRateLimitError(res, error);
      }
      const requireLogin = error.response?.data?.require_login;
      if (status === 401 && requireLogin) {
        return res.status(401).json({
          error: 'Instagram API requires authentication',
          message: 'Provide an Instagram cookie from the frontend (More tools → IG Cookie) or set IG_COOKIE / IG_SESSIONID in environment variables.'
        });
      }
      return res.status(status).json({
        error: 'Failed to fetch profile data',
        message: error.message
      });
    }
  });
};

module.exports = {
  registerProfileRoutes,
  parseParts
};
