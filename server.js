require('dotenv').config();

const fs = require('fs');
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;
const BASE_PATH = process.env.BASE_PATH || '';
const IG_COOKIE = process.env.IG_COOKIE || '';
const IG_SESSIONID = process.env.IG_SESSIONID || '';
const IG_WWW_CLAIM = process.env.IG_WWW_CLAIM || '0';
const COOKIE_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedInstagramCookieHeader = '';
let cachedInstagramCookieAt = 0;

/**
 * Prefix route path with BASE_PATH when configured.
 * -----------------------------------------------------------------------------
 * @param {string} pathName - Route path without base prefix.
 * @returns {string} Resolved route path.
 */
const route = (path) => BASE_PATH ? BASE_PATH + path : path;

/**
 * Default headers for fetching Instagram assets/endpoints.
 * -----------------------------------------------------------------------------
 * Reused by proxy/download handlers.
 */
const defaultHeaders = {
  'Referer': 'https://www.instagram.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

/**
 * Headers required by Instagram web API endpoints.
 * -----------------------------------------------------------------------------
 */
const igApiHeaders = {
  ...defaultHeaders,
  'X-IG-App-ID': '936619743392459',
  'X-Requested-With': 'XMLHttpRequest'
};

/**
 * Build cookie header from env vars.
 * -----------------------------------------------------------------------------
 * Used by proxy/download handlers.
 * @returns {string} Cookie header value.
 */
const getInstagramCookieHeader = () => {
  if (IG_COOKIE) {
    return IG_COOKIE;
  }
  if (IG_SESSIONID) {
    return `sessionid=${IG_SESSIONID}`;
  }
  return '';
};

/**
 * Merge multiple cookie strings into one normalized header.
 * -----------------------------------------------------------------------------
 * @param {...string} cookieSources - Cookie header strings.
 * @returns {string} Merged cookie header.
 */
const mergeCookieHeaders = (...cookieSources) => {
  const cookieJar = {};

  cookieSources
    .filter(Boolean)
    .forEach((source) => {
      source.split(';').forEach((cookiePart) => {
        const [rawKey, ...rawValue] = cookiePart.trim().split('=');
        const key = (rawKey || '').trim();
        const value = rawValue.join('=').trim();
        if (!key || !value) {
          return;
        }
        cookieJar[key] = value;
      });
    });

  return Object.entries(cookieJar).map(([key, value]) => `${key}=${value}`).join('; ');
};

/**
 * Bootstrap Instagram cookie with homepage set-cookie values.
 * -----------------------------------------------------------------------------
 * Helps feed endpoints that require csrftoken and companion cookies.
 * @returns {Promise<string>} Bootstrapped cookie header.
 */
const getBootstrappedInstagramCookieHeader = async () => {
  const now = Date.now();
  if (cachedInstagramCookieHeader && (now - cachedInstagramCookieAt) < COOKIE_CACHE_TTL_MS) {
    return cachedInstagramCookieHeader;
  }

  const baseCookie = getInstagramCookieHeader();
  if (!baseCookie) {
    cachedInstagramCookieHeader = '';
    cachedInstagramCookieAt = now;
    return '';
  }

  try {
    const homepageResponse = await axios.get('https://www.instagram.com/', {
      timeout: 20000,
      headers: {
        'User-Agent': defaultHeaders['User-Agent'],
        'Cookie': baseCookie
      }
    });
    const responseCookies = (homepageResponse.headers['set-cookie'] || [])
      .map((cookieLine) => cookieLine.split(';')[0])
      .join('; ');
    cachedInstagramCookieHeader = mergeCookieHeaders(baseCookie, responseCookies);
  } catch (error) {
    cachedInstagramCookieHeader = baseCookie;
  }

  cachedInstagramCookieAt = now;
  return cachedInstagramCookieHeader;
};

/**
 * Build optional auth headers for Instagram API calls.
 * -----------------------------------------------------------------------------
 * @returns {Record<string, string>} Auth headers object.
 */
const getInstagramAuthHeaders = async () => {
  const cookieHeader = await getBootstrappedInstagramCookieHeader();
  if (!cookieHeader) {
    return {
      'X-IG-WWW-Claim': IG_WWW_CLAIM
    };
  }

  const csrfMatch = cookieHeader.match(/(?:^|;\s*)csrftoken=([^;]+)/i);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';

  return {
    'Cookie': cookieHeader,
    'X-IG-WWW-Claim': IG_WWW_CLAIM,
    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {})
  };
};

/**
 * Perform authenticated GET request to Instagram API.
 * -----------------------------------------------------------------------------
 * @param {string} url - Target URL.
 * @param {object} [config={}] - Axios request config.
 * @returns {Promise<import('axios').AxiosResponse>} Axios response.
 */
const igGet = async (url, config = {}) => {
  const authHeaders = await getInstagramAuthHeaders();
  const headers = {
    ...igApiHeaders,
    ...authHeaders,
    ...(config.headers || {})
  };
  return axios.get(url, {
    ...config,
    headers
  });
};

/**
 * Convert Instagram node image data to parser candidate format.
 * -----------------------------------------------------------------------------
 * @param {object} node - Instagram media node.
 * @returns {{url: string, height: number, width: number}} Image candidate object.
 */
const toImageCandidate = (node) => ({
  url: node.display_url,
  height: node.dimensions?.height || 0,
  width: node.dimensions?.width || 0
});

/**
 * Convert Instagram node video data to parser video_versions format.
 * -----------------------------------------------------------------------------
 * @param {object} node - Instagram media node.
 * @returns {Array<{url: string, height: number, width: number}>|undefined} Video versions list.
 */
const toVideoVersions = (node) => {
  if (!node.is_video || !node.video_url) {
    return undefined;
  }
  return [{
    url: node.video_url,
    height: node.dimensions?.height || 0,
    width: node.dimensions?.width || 0
  }];
};

/**
 * Convert feed node to normalized parser item format.
 * Handles single media and carousel media.
 * -----------------------------------------------------------------------------
 * @param {object} node - Instagram feed node.
 * @param {string} username - Username owner of media.
 * @returns {object} Normalized parser item.
 */
const toMediaItem = (node, username) => {
  const item = {
    id: node.id,
    taken_at: node.taken_at_timestamp,
    user: { username },
    image_versions2: {
      candidates: [toImageCandidate(node)]
    }
  };

  const videoVersions = toVideoVersions(node);
  if (videoVersions) {
    item.video_versions = videoVersions;
  }

  const children = node.edge_sidecar_to_children?.edges || [];
  if (children.length > 0) {
    item.carousel_media = children
      .map((edge) => edge.node)
      .filter((childNode) => childNode?.display_url)
      .map((childNode) => {
        const child = {
          id: childNode.id,
          taken_at: node.taken_at_timestamp,
          image_versions2: {
            candidates: [toImageCandidate(childNode)]
          }
        };

        const childVideoVersions = toVideoVersions(childNode);
        if (childVideoVersions) {
          child.video_versions = childVideoVersions;
        }

        return child;
      });
  }

  return item;
};

/**
 * Parse width/height from Instagram profile picture URL.
 * -----------------------------------------------------------------------------
 * @param {string} url - Profile picture URL.
 * @returns {{width: number, height: number}} Parsed dimensions.
 */
const extractSizeFromProfilePicUrl = (url) => {
  if (!url) {
    return { width: 0, height: 0 };
  }

  const match = url.match(/_s(\d+)x(\d+)_/);
  if (!match) {
    return { width: 0, height: 0 };
  }

  return {
    width: Number(match[1]) || 0,
    height: Number(match[2]) || 0
  };
};

/**
 * Pick best available profile picture candidate.
 * -----------------------------------------------------------------------------
 * @param {object} user - Instagram user object.
 * @returns {{url: string, width: number, height: number}|null} Best picture candidate.
 */
const chooseBestProfilePicture = (user) => {
  const candidates = [];

  if (Array.isArray(user.hd_profile_pic_versions)) {
    user.hd_profile_pic_versions.forEach((item) => {
      if (!item?.url) {
        return;
      }
      candidates.push({
        url: item.url,
        width: item.width || 0,
        height: item.height || 0
      });
    });
  }

  if (user.profile_pic_url_hd) {
    const size = extractSizeFromProfilePicUrl(user.profile_pic_url_hd);
    candidates.push({
      url: user.profile_pic_url_hd,
      width: size.width,
      height: size.height
    });
  }

  if (user.profile_pic_url) {
    const size = extractSizeFromProfilePicUrl(user.profile_pic_url);
    candidates.push({
      url: user.profile_pic_url,
      width: size.width,
      height: size.height
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, current) => {
    const bestArea = (best.width || 0) * (best.height || 0);
    const currentArea = (current.width || 0) * (current.height || 0);
    return currentArea > bestArea ? current : best;
  });
};

/**
 * Convert profile picture data into normalized parser item.
 * -----------------------------------------------------------------------------
 * @param {object} user - Instagram user object.
 * @param {string} username - Username value.
 * @returns {object|null} Profile picture item or null when missing.
 */
const toProfilePictureItem = (user, username) => {
  const bestProfilePic = chooseBestProfilePicture(user);
  if (!bestProfilePic?.url) {
    return null;
  }

  return {
    id: `profile-${user.id || username}`,
    taken_at: Math.floor(Date.now() / 1000),
    user: { username },
    image_versions2: {
      candidates: [{
        url: bestProfilePic.url,
        width: bestProfilePic.width || 320,
        height: bestProfilePic.height || 320
      }]
    },
    media_kind: 'profile'
  };
};

/**
 * Convert story/highlight reel item to normalized parser item.
 * -----------------------------------------------------------------------------
 * @param {object} reelItem - Story/highlight media item.
 * @param {string} username - Username owner of media.
 * @param {string} mediaKind - Label for source kind (story/highlight).
 * @returns {object|null} Normalized item or null when invalid.
 */
const toReelMediaItem = (reelItem, username, mediaKind) => {
  const imageCandidate = reelItem.image_versions2?.candidates?.[0];
  const fallbackWidth = reelItem.original_width || 0;
  const fallbackHeight = reelItem.original_height || 0;

  if (!imageCandidate?.url) {
    return null;
  }

  const item = {
    id: reelItem.id,
    taken_at: reelItem.taken_at,
    user: { username },
    image_versions2: {
      candidates: [{
        url: imageCandidate.url,
        width: imageCandidate.width || fallbackWidth,
        height: imageCandidate.height || fallbackHeight
      }]
    },
    media_kind: mediaKind
  };

  if (reelItem.video_versions?.[0]?.url) {
    item.video_versions = [{
      url: reelItem.video_versions[0].url,
      width: reelItem.video_versions[0].width || fallbackWidth,
      height: reelItem.video_versions[0].height || fallbackHeight
    }];
  }

  return item;
};

/**
 * Normalize feed item from Instagram feed/user endpoint.
 * @param {object} feedItem - Raw feed item from API.
 * @param {string} fallbackUsername - Username fallback when user object missing.
 * @returns {object|null} Normalized feed item.
 */
const toApiFeedItem = (feedItem, fallbackUsername) => {
  const primaryImage = feedItem?.image_versions2?.candidates?.[0];
  if (!primaryImage?.url) {
    return null;
  }

  const item = {
    id: feedItem.id,
    taken_at: feedItem.taken_at,
    user: { username: feedItem.user?.username || fallbackUsername },
    image_versions2: {
      candidates: [{
        url: primaryImage.url,
        width: primaryImage.width || feedItem.original_width || 0,
        height: primaryImage.height || feedItem.original_height || 0
      }]
    },
    media_kind: 'feed'
  };

  if (feedItem.video_versions?.[0]?.url) {
    item.video_versions = [{
      url: feedItem.video_versions[0].url,
      width: feedItem.video_versions[0].width || feedItem.original_width || 0,
      height: feedItem.video_versions[0].height || feedItem.original_height || 0
    }];
  }

  const carouselMedia = feedItem.carousel_media || [];
  if (carouselMedia.length > 0) {
    item.carousel_media = carouselMedia
      .map((media) => {
        const imageCandidate = media?.image_versions2?.candidates?.[0];
        if (!imageCandidate?.url) {
          return null;
        }
        const mediaItem = {
          id: media.id,
          taken_at: media.taken_at || feedItem.taken_at,
          image_versions2: {
            candidates: [{
              url: imageCandidate.url,
              width: imageCandidate.width || media.original_width || 0,
              height: imageCandidate.height || media.original_height || 0
            }]
          }
        };
        if (media.video_versions?.[0]?.url) {
          mediaItem.video_versions = [{
            url: media.video_versions[0].url,
            width: media.video_versions[0].width || media.original_width || 0,
            height: media.video_versions[0].height || media.original_height || 0
          }];
        }
        return mediaItem;
      })
      .filter(Boolean);
  }

  return item;
};

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
    return feedItems;
  }

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
        return feedItems;
      }
    } catch (feedError) {
      console.error(`Feed fallback skipped (${endpoint}):`, feedError.message);
    }
  }

  return [];
};

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
 * Infer output file extension from content-type or source URL.
 * -----------------------------------------------------------------------------
 * @param {string|undefined} contentType - Response content type.
 * @param {string} mediaUrl - Source media URL.
 * @returns {string} Suggested file extension.
 */
const getMediaExtension = (contentType, mediaUrl) => {
  if (contentType) {
    if (contentType.includes('video')) {
      return 'mp4';
    }
    if (contentType.includes('png')) {
      return 'png';
    }
    if (contentType.includes('gif')) {
      return 'gif';
    }
    if (contentType.includes('webp')) {
      return 'webp';
    }
  }
  if (mediaUrl.includes('.mp4')) {
    return 'mp4';
  }
  if (mediaUrl.includes('.png')) {
    return 'png';
  }
  if (mediaUrl.includes('.gif')) {
    return 'gif';
  }
  if (mediaUrl.includes('.webp')) {
    return 'webp';
  }
  return 'jpg';
};

/**
 * Serve static files (jika ada folder public, css, js, dll)
 * -----------------------------------------------------------------------------
 */
app.use(BASE_PATH || '/', express.static('public'));

/**
 * Serve index.html and inject BASE_PATH for frontend runtime.
 * -----------------------------------------------------------------------------
 */
app.get(route('/'), (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // Inject BASE_PATH sebagai JavaScript variable
  const basePathScript = `
  <script>
    window.BASE_PATH = '${BASE_PATH || ''}';
  </script>`;
  html = html.replace('</head>', basePathScript + '</head>');

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * Proxy endpoint to stream Instagram image/video.
 */
app.get(route('/load'), async (req, res) => {
  try {
    const imageUrl = req.query.url;

    if (!imageUrl) {
      return res.status(400).send('URL parameter is required');
    }

    // Fetch image/video dari URL Instagram
    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      headers: defaultHeaders
    });

    // Set appropriate headers
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Pipe response ke client
    response.data.pipe(res);
  } catch (error) {
    console.error('Error loading media:', error.message);
    res.status(500).send('Error loading media: ' + error.message);
  }
});

/**
 * Aggregate profile media by username (profile photo, story, highlight, feed).
 */
app.get(route('/profile'), async (req, res) => {
  try {
    const username = (req.query.username || '').toString().trim().replace(/^@/, '');
    if (!username) {
      return res.status(400).json({ error: 'username parameter is required' });
    }

    const response = await igGet('https://www.instagram.com/api/v1/users/web_profile_info/', {
      params: { username },
      timeout: 20000
    });

    const user = response.data?.data?.user;
    if (!user) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'Instagram profile data is unavailable'
      });
    }

    const feedItems = await getFeedItems(user, username);

    let storyItems = [];
    try {
      const storyRawItems = await getReelItemsByReelId(user.id);
      storyItems = storyRawItems
        .map((storyItem) => toReelMediaItem(storyItem, user.username || username, 'story'))
        .filter(Boolean);
    } catch (storyError) {
      console.error('Story fetch skipped:', storyError.message);
    }

    let highlightItems = [];
    const highlightEdges = user.edge_highlight_reels?.edges || [];
    if (highlightEdges.length > 0) {
      for (const edge of highlightEdges) {
        const highlightId = edge?.node?.id;
        if (!highlightId) {
          continue;
        }
        try {
          const highlightRawItems = await getReelItemsByReelId(`highlight:${highlightId}`);
          const mapped = highlightRawItems
            .map((highlightItem) => toReelMediaItem(highlightItem, user.username || username, 'highlight'))
            .filter(Boolean);
          highlightItems = highlightItems.concat(mapped);
        } catch (highlightError) {
          console.error(`Highlight fetch skipped (${highlightId}):`, highlightError.message);
        }
      }
    }

    const profilePictureItem = toProfilePictureItem(user, user.username || username);
    const items = [
      ...(profilePictureItem ? [profilePictureItem] : []),
      ...storyItems,
      ...highlightItems,
      ...feedItems
    ];

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ items });
  } catch (error) {
    const status = error.response?.status || 500;
    console.error('Error fetching profile:', error.message);
    const requireLogin = error.response?.data?.require_login;
    if (status === 401 && requireLogin) {
      return res.status(401).json({
        error: 'Instagram API requires authentication',
        message: 'Set IG_COOKIE (recommended) or IG_SESSIONID in environment variables for server-side requests.'
      });
    }
    return res.status(status).json({
      error: 'Failed to fetch profile data',
      message: error.message
    });
  }
});

/**
 * Download endpoint for proxied media with filename + extension.
 */
app.get(route('/download'), async (req, res) => {
  try {
    const mediaUrl = req.query.url;
    const filename = req.query.filename || 'download';

    if (!mediaUrl) {
      return res.status(400).send('URL parameter is required');
    }

    // Fetch media dari URL Instagram
    const response = await axios.get(mediaUrl, {
      responseType: 'stream',
      headers: defaultHeaders
    });

    const contentType = response.headers['content-type'];
    const extension = getMediaExtension(contentType, mediaUrl);

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Pipe response ke client
    response.data.pipe(res);
  } catch (error) {
    console.error('Error downloading media:', error.message);
    res.status(500).send('Error downloading media: ' + error.message);
  }
});

/**
 * Start HTTP server.
 */
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}${BASE_PATH || ''}`);
  console.log(`📱 Open your browser and navigate to http://localhost:${PORT}${BASE_PATH || ''}`);
  if (BASE_PATH) {
    console.log(`📍 Base path: ${BASE_PATH}`);
  }
});

