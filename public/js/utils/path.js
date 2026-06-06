/**
 * Resolve API/static path with optional BASE_PATH prefix.
 * @param {string} pathName - Route or asset path.
 * @returns {string} Resolved path.
 */
export function getPath(pathName) {
  const basePath = window.BASE_PATH || '';
  if (basePath && pathName.startsWith('/')) {
    return basePath + pathName;
  }
  return basePath ? basePath + '/' + pathName.replace(/^\//, '') : pathName;
}
