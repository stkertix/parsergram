const { igGet } = require('./client');
const { toReelMediaItem } = require('./mappers');
const { logger } = require('../utils/logger');

/**
 * Get reels_media items by reel id.
 * -----------------------------------------------------------------------------
 * @param {string} reelId - Reel id or highlight:{id}.
 * @returns {Promise<object[]>} Array of reel items.
 */
const getReelItemsByReelId = async (reelId) => {
  const reelResponse = await igGet('https://www.instagram.com/api/v1/feed/reels_media/', {
    params: { reel_ids: reelId },
    timeout: 20000
  });
  const reels = reelResponse.data?.reels || {};
  return reels[reelId]?.items || [];
};

/**
 * Normalize highlight reel id to reels_media format.
 * -----------------------------------------------------------------------------
 * @param {string|number} highlightId - Raw highlight id from API sources.
 * @returns {string} Reel id in highlight:{id} format.
 */
const normalizeHighlightReelId = (highlightId) => {
  const rawId = String(highlightId || '').trim();
  if (!rawId) {
    return '';
  }
  return rawId.startsWith('highlight:') ? rawId : `highlight:${rawId}`;
};

/**
 * Fetch highlight tray entries from Instagram highlights_tray API.
 * -----------------------------------------------------------------------------
 * @param {string} userId - Instagram user id.
 * @returns {Promise<Array<{id: string, title: string}>>} Highlight tray entries.
 */
const getHighlightTray = async (userId) => {
  const trayResponse = await igGet(`https://www.instagram.com/api/v1/highlights/${userId}/highlights_tray/`, {
    timeout: 20000
  });
  const tray = trayResponse.data?.tray || [];
  return tray
    .map((highlight) => ({
      id: normalizeHighlightReelId(highlight.id),
      title: highlight.title || 'Highlight'
    }))
    .filter((highlight) => highlight.id);
};

/**
 * Fetch highlight tray entries from edge_highlight_reels (legacy fallback).
 * -----------------------------------------------------------------------------
 * @param {object} user - Instagram user object from web_profile_info.
 * @returns {Array<{id: string, title: string}>} Highlight tray entries.
 */
const getHighlightTrayFromEdge = (user) => {
  const highlightEdges = user.edge_highlight_reels?.edges || [];
  return highlightEdges
    .map((edge) => ({
      id: normalizeHighlightReelId(edge?.node?.id),
      title: edge?.node?.title || 'Highlight'
    }))
    .filter((highlight) => highlight.id);
};

/**
 * Fetch highlight tray entries from GraphQL doc_id fallback.
 * -----------------------------------------------------------------------------
 * @param {string} userId - Instagram user id.
 * @returns {Promise<Array<{id: string, title: string}>>} Highlight tray entries.
 */
const getHighlightTrayFromGraphQL = async (userId) => {
  const variables = JSON.stringify({
    user_id: userId,
    include_chaining: false,
    include_reel: true,
    include_suggested_users: false,
    include_logged_out_extras: false,
    include_highlight_reels: true,
    include_related_profiles: false
  });
  const graphqlResponse = await igGet('https://www.instagram.com/graphql/query/', {
    params: {
      doc_id: '9532867876840543',
      variables
    },
    timeout: 20000
  });
  const edges = graphqlResponse.data?.data?.highlights?.edges
    || graphqlResponse.data?.data?.user?.edge_highlight_reels?.edges
    || [];
  return edges
    .map((edge) => ({
      id: normalizeHighlightReelId(edge?.node?.id),
      title: edge?.node?.title || 'Highlight'
    }))
    .filter((highlight) => highlight.id);
};

/**
 * Resolve highlight tray with layered fallbacks.
 * -----------------------------------------------------------------------------
 * @param {object} user - Instagram user object from web_profile_info.
 * @returns {Promise<Array<{id: string, title: string}>>} Highlight tray entries.
 */
const resolveHighlightTray = async (user) => {
  // Prefer data already present on web_profile_info — zero extra IG calls.
  const edgeTray = getHighlightTrayFromEdge(user);
  if (edgeTray.length > 0) {
    logger.info('highlight', 'tray from profile edges', { count: edgeTray.length });
    return edgeTray;
  }

  const { isRateLimited } = require('./client');
  if (isRateLimited()) {
    logger.warn('highlight', 'skip tray API during cooldown');
    return [];
  }

  try {
    const tray = await getHighlightTray(user.id);
    if (tray.length > 0) {
      logger.info('highlight', 'tray from API', { userId: user.id, count: tray.length });
      return tray;
    }
  } catch (trayError) {
    logger.warn('highlight', 'tray fetch skipped', { message: trayError.message });
    if (trayError.response?.status === 429 || trayError.statusCode === 429) {
      return [];
    }
  }

  try {
    const graphqlTray = await getHighlightTrayFromGraphQL(user.id);
    logger.info('highlight', 'tray from GraphQL', { userId: user.id, count: graphqlTray.length });
    return graphqlTray;
  } catch (graphqlError) {
    logger.warn('highlight', 'GraphQL fallback skipped', { message: graphqlError.message });
    return [];
  }
};

/**
 * Fetch and normalize media items for a single highlight album.
 * -----------------------------------------------------------------------------
 * @param {string} username - Username owner of media.
 * @param {{ id: string, title: string }} highlight - Highlight tray entry.
 * @returns {Promise<object[]>} Normalized highlight items.
 */
const fetchSingleHighlightItems = async (username, highlight) => {
  logger.info('highlight', 'fetch album', {
    username,
    highlightId: highlight.id,
    title: highlight.title
  });
  const highlightRawItems = await getReelItemsByReelId(highlight.id);
  const items = highlightRawItems
    .map((highlightItem) => toReelMediaItem(highlightItem, username, 'highlight'))
    .filter(Boolean)
    .map((item) => ({
      ...item,
      highlight_title: highlight.title,
      highlight_id: highlight.id
    }));
  logger.info('highlight', 'album ready', { username, count: items.length });
  return items;
};

module.exports = {
  getReelItemsByReelId,
  normalizeHighlightReelId,
  getHighlightTray,
  getHighlightTrayFromEdge,
  getHighlightTrayFromGraphQL,
  resolveHighlightTray,
  fetchSingleHighlightItems
};
