const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const ACTIVE_LEVEL = Object.prototype.hasOwnProperty.call(LEVELS, LOG_LEVEL)
  ? LEVELS[LOG_LEVEL]
  : LEVELS.info;

/**
 * Truncate long values for readable log lines.
 * -----------------------------------------------------------------------------
 * @param {unknown} value
 * @param {number} [max=96]
 * @returns {string}
 */
const truncate = (value, max = 96) => {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

/**
 * Format optional metadata as key=value pairs.
 * -----------------------------------------------------------------------------
 * @param {Record<string, unknown>|undefined} meta
 * @returns {string}
 */
const formatMeta = (meta) => {
  if (!meta) {
    return '';
  }

  const parts = Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}=${value}`;
      }
      return `${key}=${JSON.stringify(value)}`;
    });

  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
};

/**
 * Write a structured log line to stdout/stderr.
 * -----------------------------------------------------------------------------
 * @param {'error'|'warn'|'info'|'debug'} level
 * @param {string} scope
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
const write = (level, scope, message, meta) => {
  if (LEVELS[level] > ACTIVE_LEVEL) {
    return;
  }

  // Lazy require avoids circular dependency with requestContext -> logger.
  let requestId;
  try {
    const { requestContext } = require('../middleware/requestContext');
    requestId = requestContext.getStore()?.requestId;
  } catch (_error) {
    requestId = undefined;
  }

  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}${formatMeta({
    ...meta,
    req: requestId
  })}`;

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
};

const logger = {
  error: (scope, message, meta) => write('error', scope, message, meta),
  warn: (scope, message, meta) => write('warn', scope, message, meta),
  info: (scope, message, meta) => write('info', scope, message, meta),
  debug: (scope, message, meta) => write('debug', scope, message, meta),
  truncate
};

module.exports = {
  logger
};
