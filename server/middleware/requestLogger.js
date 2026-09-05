const { logger } = require('../utils/logger');
const { BASE_PATH } = require('../config');

const STATIC_FILE = /\.(css|js|map|ico|png|jpe?g|webp|gif|svg|woff2?|ttf)$/i;

/**
 * Paths that would flood the log (static assets and media proxy).
 * -----------------------------------------------------------------------------
 * @param {import('express').Request} req
 * @returns {boolean}
 */
const isNoisyRequest = (req) => {
  const pathName = req.path || '';
  if (STATIC_FILE.test(pathName)) {
    return true;
  }
  if (pathName.endsWith('/load')) {
    return true;
  }
  return pathName === '/' || pathName === BASE_PATH || pathName === `${BASE_PATH}/`;
};

/**
 * Log method, path, status, and duration for API requests.
 * -----------------------------------------------------------------------------
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requestLogger = (req, res, next) => {
  const started = Date.now();
  const noisy = isNoisyRequest(req);

  res.on('finish', () => {
    const meta = {
      status: res.statusCode,
      ms: Date.now() - started
    };
    const line = `${req.method} ${req.path}`;

    if (noisy) {
      logger.debug('http', line, meta);
      return;
    }

    if (res.statusCode >= 500) {
      logger.error('http', line, meta);
      return;
    }
    if (res.statusCode >= 400) {
      logger.warn('http', line, meta);
      return;
    }
    logger.info('http', line, meta);
  });

  next();
};

module.exports = {
  requestLogger
};
