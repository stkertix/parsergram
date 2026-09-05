const { AsyncLocalStorage } = require('async_hooks');

const requestContext = new AsyncLocalStorage();

/**
 * Capture optional Instagram cookie from the frontend (X-IG-Cookie header).
 * -----------------------------------------------------------------------------
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const igCookieMiddleware = (req, res, next) => {
  const igCookie = (req.get('X-IG-Cookie') || '').trim();
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  requestContext.run({ igCookie, requestId }, next);
};

module.exports = {
  requestContext,
  igCookieMiddleware
};
