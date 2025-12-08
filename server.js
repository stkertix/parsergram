const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (jika ada folder public, css, js, dll)
app.use(express.static('public'));

// Serve index.html di root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Proxy untuk load image/video dari Instagram
app.get('/load', async (req, res) => {
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
app.get('/download', async (req, res) => {
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
      if (contentType.includes('video')) extension = 'mp4';
      else if (contentType.includes('png')) extension = 'png';
      else if (contentType.includes('gif')) extension = 'gif';
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
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📱 Open your browser and navigate to http://localhost:${PORT}`);
});

