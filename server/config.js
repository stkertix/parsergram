require('dotenv').config();

const path = require('path');

const PORT = process.env.PORT || 3001;
const BASE_PATH = process.env.BASE_PATH || '';
const IG_COOKIE = process.env.IG_COOKIE || '';
const IG_SESSIONID = process.env.IG_SESSIONID || '';
const IG_WWW_CLAIM = process.env.IG_WWW_CLAIM || '0';
const COOKIE_CACHE_TTL_MS = 5 * 60 * 1000;
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const ROOT_DIR = path.join(__dirname, '..');

/**
 * Prefix route path with BASE_PATH when configured.
 * -----------------------------------------------------------------------------
 * @param {string} pathName - Route path without base prefix.
 * @returns {string} Resolved route path.
 */
const route = (pathName) => BASE_PATH ? BASE_PATH + pathName : pathName;

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

module.exports = {
  PORT,
  BASE_PATH,
  IG_COOKIE,
  IG_SESSIONID,
  IG_WWW_CLAIM,
  COOKIE_CACHE_TTL_MS,
  LOG_LEVEL,
  ROOT_DIR,
  route,
  defaultHeaders,
  igApiHeaders
};
