const { route } = require('../config');
const { getCookieSource, isRateLimited, getRateLimitCooldownMs } = require('../instagram/client');
const { toReelMediaItem } = require('../instagram/mappers');
const { getReelItemsByReelId } = require('../instagram/highlights');
const { getWebProfileUser } = require('../instagram/profileInfo');
const { getOutboundSummary } = require('../middleware/requestContext');
const { logger } = require('../utils/logger');

/**
 * Lazy-load active stories for a username (uses cached web_profile_info when possible).
 * -----------------------------------------------------------------------------
 * @param {import('express').Express} app
 */
const registerStoryRoutes = (app) => {
  app.get(route('/story'), async (req, res) => {
    try {
      const username = (req.query.username || '').toString().trim().replace(/^@/, '');
      if (!username) {
        return res.status(400).json({ error: 'username parameter is required' });
      }

      if (isRateLimited()) {
        const waitMs = getRateLimitCooldownMs();
        return res.status(429).json({
          error: 'Instagram rate limited',
          message: `Cooldown active (${Math.ceil(waitMs / 1000)}s). Stories deferred.`,
          retry_after_ms: waitMs
        });
      }

      logger.info('story', 'fetch start', { username, cookie: getCookieSource() });

      const user = await getWebProfileUser(username);
      const storyRawItems = await getReelItemsByReelId(user.id);
      const items = storyRawItems
        .map((storyItem) => toReelMediaItem(storyItem, user.username || username, 'story'))
        .filter(Boolean);

      const outbound = getOutboundSummary();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      logger.info('story', 'fetch done', {
        username: user.username || username,
        count: items.length,
        outbound: outbound.count
      });
      return res.status(200).json({ items });
    } catch (error) {
      const status = error.statusCode || error.response?.status || 500;
      logger.error('story', 'fetch failed', {
        status,
        message: error.message,
        outbound: getOutboundSummary().count
      });
      if (status === 429 || isRateLimited()) {
        return res.status(429).json({
          error: 'Instagram rate limited',
          message: error.message,
          retry_after_ms: getRateLimitCooldownMs()
        });
      }
      return res.status(status).json({
        error: 'Failed to fetch stories',
        message: error.message
      });
    }
  });
};

module.exports = {
  registerStoryRoutes
};
