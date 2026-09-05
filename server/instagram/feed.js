const { igGet } = require('./client');
const { toMediaItem, toApiFeedItem } = require('./mappers');
const { logger } = require('../utils/logger');

/**
 * Get feed posts with fallback strategy across multiple IG endpoints.
 * @param {object} user - Instagram user object from web_profile_info.
 * @param {string} username - Requested username.
 * @returns {Promise<object[]>} Normalized feed items.
 */
const getFeedItems = async (user, username) => {
  const feedEdges = user.edge_owner_to_timeline_media?.edges || [];
  let feedItems = feedEdges
    .map((edge) => edge.node)
    .filter((node) => node?.display_url)
    .map((node) => toMediaItem(node, user.username || username))
    .map((item) => ({ ...item, media_kind: 'feed' }));

  if (feedItems.length > 0) {
    logger.info('feed', 'using timeline media', {
      username: user.username || username,
      count: feedItems.length
    });
    return feedItems;
  }

  logger.info('feed', 'timeline empty, trying API fallback', {
    username: user.username || username,
    userId: user.id
  });

  const feedEndpoints = [
    `https://www.instagram.com/api/v1/feed/user/${user.id}/`,
    `https://www.instagram.com/api/v1/feed/user/${user.id}/username/`
  ];

  for (const endpoint of feedEndpoints) {
    try {
      const feedResponse = await igGet(endpoint, {
        params: { count: 33 },
        timeout: 20000
      });
      const rawItems = feedResponse.data?.items || feedResponse.data?.feed_items || [];
      feedItems = rawItems
        .map((rawItem) => toApiFeedItem(rawItem, user.username || username))
        .filter(Boolean);
      if (feedItems.length > 0) {
        logger.info('feed', 'fallback ok', { count: feedItems.length });
        return feedItems;
      }
    } catch (feedError) {
      logger.warn('feed', 'fallback skipped', {
        endpoint,
        message: feedError.message
      });
    }
  }

  logger.warn('feed', 'no feed items', { username: user.username || username });
  return [];
};

module.exports = {
  getFeedItems
};
