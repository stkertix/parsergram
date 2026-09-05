const { registerStaticRoutes } = require('./static');
const { registerMediaRoutes } = require('./media');
const { registerPostRoutes } = require('./post');
const { registerProfileRoutes } = require('./profile');
const { registerHighlightRoutes } = require('./highlight');

/**
 * Register all HTTP routes on the Express app.
 * -----------------------------------------------------------------------------
 * @param {import('express').Express} app
 */
const registerRoutes = (app) => {
  registerStaticRoutes(app);
  registerMediaRoutes(app);
  registerPostRoutes(app);
  registerProfileRoutes(app);
  registerHighlightRoutes(app);
};

module.exports = {
  registerRoutes
};
