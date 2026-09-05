const axios = require('axios');
const { defaultHeaders, route } = require('../config');
const { getMediaExtension } = require('../utils/mediaExtension');
const { logger } = require('../utils/logger');

/**
 * Proxy and download endpoints for Instagram media.
 * -----------------------------------------------------------------------------
 * @param {import('express').Express} app
 */
const registerMediaRoutes = (app) => {
  app.get(route('/load'), async (req, res) => {
    try {
      const imageUrl = req.query.url;

      if (!imageUrl) {
        return res.status(400).send('URL parameter is required');
      }

      const response = await axios.get(imageUrl, {
        responseType: 'stream',
        headers: defaultHeaders
      });

      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');

      response.data.pipe(res);
    } catch (error) {
      logger.error('media', 'load failed', {
        url: logger.truncate(req.query.url),
        message: error.message
      });
      res.status(500).send('Error loading media: ' + error.message);
    }
  });

  app.get(route('/download'), async (req, res) => {
    try {
      const mediaUrl = req.query.url;
      const filename = req.query.filename || 'download';

      if (!mediaUrl) {
        return res.status(400).send('URL parameter is required');
      }

      const response = await axios.get(mediaUrl, {
        responseType: 'stream',
        headers: defaultHeaders
      });

      const contentType = response.headers['content-type'];
      const extension = getMediaExtension(contentType, mediaUrl);

      res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');

      response.data.pipe(res);
    } catch (error) {
      logger.error('media', 'download failed', {
        filename: req.query.filename || 'download',
        url: logger.truncate(req.query.url),
        message: error.message
      });
      res.status(500).send('Error downloading media: ' + error.message);
    }
  });
};

module.exports = {
  registerMediaRoutes
};
