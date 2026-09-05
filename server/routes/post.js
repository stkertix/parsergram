const { route } = require('../config');
const { resolveInstagramPostItems } = require('../instagram/posts');
const { isRateLimited, getRateLimitCooldownMs } = require('../instagram/client');
const { logger } = require('../utils/logger');

/**
 * Resolve a single Instagram post/reel URL into { items } for the frontend parser.
 * -----------------------------------------------------------------------------
 * @param {import('express').Express} app
 */
const registerPostRoutes = (app) => {
  app.get(route('/post'), async (req, res) => {
    try {
      const rawUrl = (req.query.url || '').toString().trim();
      if (!rawUrl) {
        return res.status(400).json({ error: 'url parameter is required' });
      }

      const items = await resolveInstagramPostItems(rawUrl);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ items });
    } catch (error) {
      const status = error.statusCode || error.response?.status || 500;
      logger.error('post', 'resolve failed', { status, message: error.message });
      if (status === 429 || isRateLimited()) {
        return res.status(429).json({
          error: 'Instagram rate limited',
          message: error.message,
          retry_after_ms: getRateLimitCooldownMs() || error.response?.data?.cooldown_ms || 60000
        });
      }
      return res.status(status).json({
        error: 'Failed to resolve Instagram post',
        message: error.message
      });
    }
  });
};

module.exports = {
  registerPostRoutes
};
