const fs = require('fs');
const path = require('path');
const express = require('express');
const { BASE_PATH, ROOT_DIR, route } = require('../config');

/**
 * Serve static files and index.html with injected BASE_PATH.
 * -----------------------------------------------------------------------------
 * @param {import('express').Express} app
 */
const registerStaticRoutes = (app) => {
  app.use(BASE_PATH || '/', express.static(path.join(ROOT_DIR, 'public')));

  app.get(route('/'), (req, res) => {
    let html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

    const basePathScript = `
  <script>
    window.BASE_PATH = '${BASE_PATH || ''}';
  </script>`;
    html = html.replace('</head>', basePathScript + '</head>');

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
};

module.exports = {
  registerStaticRoutes
};
