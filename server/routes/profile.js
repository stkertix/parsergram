const { route } = require('../config');
const { igGet, getCookieSource } = require('../instagram/client');
const { toProfilePictureItem, toReelMediaItem } = require('../instagram/mappers');
const { getFeedItems } = require('../instagram/feed');
const { getReelItemsByReelId, resolveHighlightTray } = require('../instagram/highlights');
const { logger } = require('../utils/logger');

/**
 * Aggregate profile media by username (profile photo, story, highlight, feed).
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

      logger.info('profile', 'fetch start', { username, cookie: getCookieSource() });

      const response = await igGet('https://www.instagram.com/api/v1/users/web_profile_info/', {
        params: { username },
        timeout: 20000
      });

      const user = response.data?.data?.user;
      if (!user) {
        logger.warn('profile', 'not found', { username });
        return res.status(404).json({
          error: 'Profile not found',
          message: 'Instagram profile data is unavailable'
        });
      }

      let storyItems = [];
      try {
        const storyRawItems = await getReelItemsByReelId(user.id);
        storyItems = storyRawItems
          .map((storyItem) => toReelMediaItem(storyItem, user.username || username, 'story'))
          .filter(Boolean);
      } catch (storyError) {
        logger.warn('profile', 'story fetch skipped', { username, message: storyError.message });
      }

      const feedItems = await getFeedItems(user, username);

      let highlightTray = [];
      try {
        highlightTray = await resolveHighlightTray(user);
      } catch (highlightError) {
        logger.warn('profile', 'highlight tray skipped', { username, message: highlightError.message });
      }

      const profilePictureItem = toProfilePictureItem(user, user.username || username);
      const items = [
        ...(profilePictureItem ? [profilePictureItem] : []),
        ...storyItems,
        ...feedItems
      ];

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      logger.info('profile', 'fetch done', {
        username: user.username || username,
        stories: storyItems.length,
        feed: feedItems.length,
        highlights: highlightTray.length,
        profilePic: Boolean(profilePictureItem)
      });
      return res.status(200).json({ items, highlight_tray: highlightTray });
    } catch (error) {
      const status = error.response?.status || 500;
      logger.error('profile', 'fetch failed', {
        status,
        requireLogin: Boolean(error.response?.data?.require_login),
        message: error.message
      });
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
  registerProfileRoutes
};
