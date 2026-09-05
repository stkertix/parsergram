const crypto = require('crypto');
const axios = require('axios');
const {
  igGet,
  igGraphqlQuery,
  getInstagramCookieHeader,
  getInstagramAuthHeaders,
  armRateLimitCooldown
} = require('./client');
const { defaultHeaders, PROFILE_CACHE_TTL_MS } = require('../config');
const { TtlCache } = require('../utils/ttlCache');
const { logger } = require('../utils/logger');

const profileInfoCache = new TtlCache({
  ttlMs: PROFILE_CACHE_TTL_MS,
  name: 'web_profile_info'
});

/** PolarisProfilePageContentQuery-style metadata by user id (logged-in). */
const PROFILE_BY_ID_DOC_IDS = [
  '27937681195819736',
  '26672929172408668',
  '25980296051578533'
];

/** Feed/timeline GraphQL that accepts username (logged-in Polar style). */
const PROFILE_FEED_BY_USERNAME_DOC_ID = '7898261790222653';

/**
 * Stable cache key for username + cookie identity (no raw cookie stored).
 * -----------------------------------------------------------------------------
 * @param {string} username
 * @returns {string}
 */
const profileCacheKey = (username) => {
  const cookie = getInstagramCookieHeader() || 'anon';
  const cookieHash = crypto.createHash('sha1').update(cookie).digest('hex').slice(0, 12);
  return `${username.toLowerCase()}::${cookieHash}`;
};

/**
 * @param {unknown} error
 * @returns {boolean}
 */
const is429 = (error) =>
  error?.statusCode === 429 || error?.response?.status === 429;

/**
 * Normalize GraphQL / alternate user payloads to web_profile_info-like shape.
 * -----------------------------------------------------------------------------
 * @param {object} userData
 * @returns {object}
 */
const normalizeProfileUser = (userData) => {
  if (!userData || typeof userData !== 'object') {
    return userData;
  }

  const normalized = { ...userData };

  if (!normalized.id && (normalized.pk || normalized.pk_id)) {
    normalized.id = String(normalized.pk || normalized.pk_id);
  }

  if (!normalized.edge_owner_to_timeline_media && typeof normalized.media_count === 'number') {
    normalized.edge_owner_to_timeline_media = { count: normalized.media_count, edges: [] };
  }

  if (!normalized.edge_followed_by && typeof normalized.follower_count === 'number') {
    normalized.edge_followed_by = { count: normalized.follower_count };
  }

  if (!normalized.edge_follow && typeof normalized.following_count === 'number') {
    normalized.edge_follow = { count: normalized.following_count };
  }

  if (!normalized.profile_pic_url_hd) {
    const hdInfo = normalized.hd_profile_pic_url_info;
    if (hdInfo?.url) {
      normalized.profile_pic_url_hd = hdInfo.url;
    } else if (normalized.profile_pic_url) {
      normalized.profile_pic_url_hd = normalized.profile_pic_url;
    }
  }

  if (!normalized.edge_highlight_reels && Array.isArray(normalized.highlights_tray)) {
    normalized.edge_highlight_reels = {
      edges: normalized.highlights_tray.map((item) => ({
        node: {
          id: item.id,
          title: item.title
        }
      }))
    };
  }

  return normalized;
};

/**
 * Extract nested user object from assorted GraphQL response shapes.
 * -----------------------------------------------------------------------------
 * @param {object} payload
 * @returns {object|null}
 */
const extractUserFromGraphqlPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload.data || payload;
  const candidates = [
    data.user,
    data.user?.user,
    data.xdt_api__v1__users__web_profile_info?.user,
    data.xdt_user_by_username,
    data.xdt_api__v1__feed__user_timeline_graphql_connection?.user
  ];

  for (const candidate of candidates) {
    if (candidate && (candidate.id || candidate.pk || candidate.username)) {
      return normalizeProfileUser(candidate);
    }
  }

  // Timeline connection may only return edges; synthesize minimal user later.
  return null;
};

/**
 * Primary path: web_profile_info REST endpoint.
 * -----------------------------------------------------------------------------
 * @param {string} username
 * @param {object} [requestOptions]
 * @returns {Promise<object>}
 */
const fetchWebProfileInfo = async (username, requestOptions = {}) => {
  const response = await igGet('https://www.instagram.com/api/v1/users/web_profile_info/', {
    params: { username },
    timeout: 20000,
    ...requestOptions
  });
  const user = response.data?.data?.user;
  if (!user) {
    const err = new Error('Instagram profile data is unavailable');
    err.statusCode = 404;
    throw err;
  }
  return normalizeProfileUser(user);
};

/**
 * Resolve numeric user id from public profile HTML (share/cookie session).
 * -----------------------------------------------------------------------------
 * @param {string} username
 * @returns {Promise<string|null>}
 */
const resolveUserIdFromProfileHtml = async (username) => {
  const authHeaders = await getInstagramAuthHeaders();
  const pageUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  const response = await axios.get(pageUrl, {
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      ...defaultHeaders,
      ...authHeaders,
      Accept: 'text/html'
    }
  });
  const html = typeof response.data === 'string' ? response.data : '';
  const patterns = [
    /"profilePage_([0-9]+)"/,
    /"user_id"\s*:\s*"(\d+)"/,
    /"user_id"\s*:\s*(\d+)/,
    new RegExp(`"username"\\s*:\\s*"${username}"[^\\}]{0,200}"id"\\s*:\\s*"(\\d+)"`, 'i'),
    new RegExp(`"id"\\s*:\\s*"(\\d+)"[^\\}]{0,200}"username"\\s*:\\s*"${username}"`, 'i')
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      logger.info('profile', 'user id from html', { username, userId: match[1] });
      return match[1];
    }
  }

  return null;
};

/**
 * GraphQL profile metadata by numeric user id.
 * -----------------------------------------------------------------------------
 * @param {string} userId
 * @param {string} username
 * @param {object} [options]
 * @returns {Promise<object>}
 */
const fetchProfileByUserIdGraphql = async (userId, username, options = {}) => {
  const variables = {
    id: String(userId),
    render_surface: 'PROFILE',
    __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider: true,
    __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider: false,
    __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider: false,
    __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider: false,
    enable_integrity_filters: true
  };

  let lastError = null;
  for (const docId of PROFILE_BY_ID_DOC_IDS) {
    try {
      logger.info('profile', 'graphql by id', { username, userId, docId });
      const payload = await igGraphqlQuery(docId, variables, {
        ...options,
        referer: `https://www.instagram.com/${username}/`
      });
      const user = extractUserFromGraphqlPayload(payload);
      if (user) {
        if (!user.username) {
          user.username = username;
        }
        return user;
      }
      lastError = new Error(`GraphQL doc_id=${docId} returned no user`);
    } catch (error) {
      lastError = error;
      if (is429(error)) {
        throw error;
      }
      logger.warn('profile', 'graphql by id failed', {
        docId,
        message: error.message
      });
    }
  }

  throw lastError || new Error('GraphQL profile-by-id failed');
};

/**
 * GraphQL timeline-by-username; synthesize a user node with feed edges when possible.
 * -----------------------------------------------------------------------------
 * @param {string} username
 * @param {object} [options]
 * @returns {Promise<object>}
 */
const fetchProfileFeedByUsernameGraphql = async (username, options = {}) => {
  const variables = {
    data: {
      count: 12,
      include_relationship_info: true,
      latest_besties_reel_media: true,
      latest_reel_media: true
    },
    username
  };

  logger.info('profile', 'graphql feed by username', {
    username,
    docId: PROFILE_FEED_BY_USERNAME_DOC_ID
  });

  const payload = await igGraphqlQuery(PROFILE_FEED_BY_USERNAME_DOC_ID, variables, {
    ...options,
    referer: `https://www.instagram.com/${username}/`
  });

  const user = extractUserFromGraphqlPayload(payload);
  if (user) {
    return user;
  }

  const connection = payload?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
  const edges = connection?.edges || [];
  if (edges.length === 0) {
    const err = new Error('GraphQL username feed returned no data');
    err.statusCode = 404;
    throw err;
  }

  const firstMedia = edges[0]?.node || {};
  const owner = firstMedia.user || firstMedia.owner || {};
  return normalizeProfileUser({
    id: String(owner.id || owner.pk || ''),
    username: owner.username || username,
    full_name: owner.full_name || '',
    profile_pic_url: owner.profile_pic_url || '',
    profile_pic_url_hd: owner.profile_pic_url || '',
    is_private: Boolean(owner.is_private),
    edge_owner_to_timeline_media: {
      count: edges.length,
      edges: []
    },
    // Keep raw v1-style items for optional future mapping; feed.js uses edges primarily.
    _graphql_feed_items: edges.map((edge) => edge.node).filter(Boolean)
  });
};

/**
 * Full GraphQL fallback chain for a username.
 * -----------------------------------------------------------------------------
 * @param {string} username
 * @param {object} [options]
 * @returns {Promise<object>}
 */
const fetchProfileViaGraphql = async (username, options = {}) => {
  // 1) Try username-capable feed/profile GraphQL.
  try {
    const fromUsername = await fetchProfileFeedByUsernameGraphql(username, options);
    if (fromUsername?.id) {
      return fromUsername;
    }
  } catch (error) {
    logger.warn('profile', 'graphql username feed skipped', { message: error.message });
    if (is429(error)) {
      throw error;
    }
  }

  // 2) Resolve id from HTML, then Polaris profile-by-id queries.
  const userId = await resolveUserIdFromProfileHtml(username);
  if (!userId) {
    const err = new Error('Could not resolve user id for GraphQL profile lookup');
    err.statusCode = 404;
    throw err;
  }

  return fetchProfileByUserIdGraphql(userId, username, options);
};

/**
 * Fetch Instagram profile user with REST primary + GraphQL fallback.
 * -----------------------------------------------------------------------------
 * @param {string} username
 * @returns {Promise<object>} Instagram user object
 */
const getWebProfileUser = async (username) => {
  const key = profileCacheKey(username);
  const { value: user, cache } = await profileInfoCache.getOrLoad(key, async () => {
    let primaryError = null;

    try {
      // Soft-arm: leave room for GraphQL fallback on 429.
      const fetched = await fetchWebProfileInfo(username, { skipCooldownArm: true });
      logger.info('profile', 'source=web_profile_info', {
        username,
        userId: fetched.id
      });
      return fetched;
    } catch (error) {
      primaryError = error;
      logger.warn('profile', 'web_profile_info failed, trying graphql', {
        username,
        status: error.statusCode || error.response?.status,
        message: error.message
      });
    }

    try {
      const fetched = await fetchProfileViaGraphql(username, {
        bypassCooldown: is429(primaryError),
        skipCooldownArm: true
      });
      logger.info('profile', 'source=graphql', {
        username,
        userId: fetched.id
      });
      return fetched;
    } catch (graphqlError) {
      if (is429(primaryError) || is429(graphqlError)) {
        armRateLimitCooldown();
      }
      const finalError = is429(graphqlError) ? graphqlError : (primaryError || graphqlError);
      if (!finalError.statusCode && finalError.response?.status) {
        finalError.statusCode = finalError.response.status;
      }
      throw finalError;
    }
  });

  logger.info('profile', 'user ready', {
    username,
    userId: user.id,
    cache
  });
  return user;
};

module.exports = {
  getWebProfileUser,
  profileCacheKey,
  normalizeProfileUser,
  fetchProfileViaGraphql
};
