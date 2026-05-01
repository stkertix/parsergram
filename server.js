require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;
const BASE_PATH = process.env.BASE_PATH || '';
const IG_COOKIE = process.env.IG_COOKIE || '';
const IG_SESSIONID = process.env.IG_SESSIONID || '';
const IG_WWW_CLAIM = process.env.IG_WWW_CLAIM || '0';

// Helper function untuk membuat route dengan base path
const route = (path) => BASE_PATH ? BASE_PATH + path : path;

const defaultHeaders = {
  'Referer': 'https://www.instagram.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};
const igApiHeaders = {
  ...defaultHeaders,
  'X-IG-App-ID': '936619743392459',
  'X-Requested-With': 'XMLHttpRequest'
};

const getInstagramCookieHeader = () => {
  if (IG_COOKIE) {
    return IG_COOKIE;
  }
  if (IG_SESSIONID) {
    return `sessionid=${IG_SESSIONID}`;
  }
  return '';
};

const getInstagramAuthHeaders = () => {
  const cookieHeader = getInstagramCookieHeader();
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

const igGet = async (url, config = {}) => {
  const headers = {
    ...igApiHeaders,
    ...getInstagramAuthHeaders(),
    ...(config.headers || {})
  };
  return axios.get(url, {
    ...config,
    headers
  });
};

const toImageCandidate = (node) => ({
  url: node.display_url,
  height: node.dimensions?.height || 0,
  width: node.dimensions?.width || 0
});

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

const getReelItemsByReelId = async (reelId) => {
  const reelResponse = await igGet('https://www.instagram.com/api/v1/feed/reels_media/', {
    params: { reel_ids: reelId },
    timeout: 20000
  });
  const reels = reelResponse.data?.reels || {};
  return reels[reelId]?.items || [];
};

// Serve static files (jika ada folder public, css, js, dll)
app.use(BASE_PATH || '/', express.static('public'));

// Serve index.html di root dengan base path injection
app.get(route('/'), (req, res) => {
  const fs = require('fs');
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

// Proxy untuk load image/video dari Instagram
app.get(route('/load'), async (req, res) => {
  try {
    const imageUrl = req.query.url;

    if (!imageUrl) {
      return res.status(400).send('URL parameter is required');
    }

    // Fetch image/video dari URL Instagram
    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      headers: {
        'Referer': 'https://www.instagram.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
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

// Download endpoint
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

    const feedEdges = user.edge_owner_to_timeline_media?.edges || [];
    const feedItems = feedEdges
      .map((edge) => edge.node)
      .filter((node) => node?.display_url)
      .map((node) => toMediaItem(node, user.username || username))
      .map((item) => ({ ...item, media_kind: 'feed' }));

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

// Download endpoint
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
      headers: {
        'Referer': 'https://www.instagram.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Determine file extension dari content-type atau URL
    let extension = 'jpg';
    const contentType = response.headers['content-type'];
    if (contentType) {
      if (contentType.includes('video')) {
        extension = 'mp4';
      } else if (contentType.includes('png')) {
        extension = 'png';
      } else if (contentType.includes('gif')) {
        extension = 'gif';
      }
    } else if (mediaUrl.includes('.mp4')) {
      extension = 'mp4';
    }

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

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}${BASE_PATH || ''}`);
  console.log(`📱 Open your browser and navigate to http://localhost:${PORT}${BASE_PATH || ''}`);
  if (BASE_PATH) {
    console.log(`📍 Base path: ${BASE_PATH}`);
  }
});

