const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;
const BASE_PATH = process.env.BASE_PATH || '';

// Helper function untuk membuat route dengan base path
const route = (path) => BASE_PATH ? BASE_PATH + path : path;

const defaultHeaders = {
  'Referer': 'https://www.instagram.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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

    const response = await axios.get('https://www.instagram.com/api/v1/users/web_profile_info/', {
      params: { username },
      timeout: 20000,
      headers: {
        ...defaultHeaders,
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const user = response.data?.data?.user;
    if (!user) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'Instagram profile data is unavailable'
      });
    }

    const edges = user.edge_owner_to_timeline_media?.edges || [];
    const items = edges
      .map((edge) => edge.node)
      .filter((node) => node?.display_url)
      .map((node) => toMediaItem(node, user.username || username));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ items });
  } catch (error) {
    const status = error.response?.status || 500;
    console.error('Error fetching profile:', error.message);
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

