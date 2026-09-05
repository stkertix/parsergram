const { route } = require('../config');
const { normalizeHighlightReelId, fetchSingleHighlightItems } = require('../instagram/highlights');
const { isRateLimited, getRateLimitCooldownMs } = require('../instagram/client');
const { logger } = require('../utils/logger');

/**
 * Lazy-load a single highlight album by id.
 * -----------------------------------------------------------------------------
 * @param {import('express').Express} app
 */
const registerHighlightRoutes = (app) => {
  app.get(route('/highlight'), async (req, res) => {
    try {
      const username = (req.query.username || '').toString().trim().replace(/^@/, '');
      const highlightId = normalizeHighlightReelId(req.query.highlight_id);
      const highlightTitle = (req.query.title || 'Highlight').toString().trim() || 'Highlight';

      if (!username) {
        return res.status(400).json({ error: 'username parameter is required' });
      }
      if (!highlightId) {
        return res.status(400).json({ error: 'highlight_id parameter is required' });
      }

      const items = await fetchSingleHighlightItems(username, {
        id: highlightId,
        title: highlightTitle
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ items });
    } catch (error) {
      const status = error.response?.status || error.statusCode || 500;
      logger.error('highlight', 'fetch failed', { status, message: error.message });
      if (status === 429 || isRateLimited()) {
        return res.status(429).json({
          error: 'Instagram rate limited',
          message: error.message,
          retry_after_ms: getRateLimitCooldownMs() || error.response?.data?.cooldown_ms || 60000
        });
      }
      return res.status(status).json({
        error: 'Failed to fetch highlight',
        message: error.message
      });
    }
  });
};

module.exports = {
  registerHighlightRoutes
};
