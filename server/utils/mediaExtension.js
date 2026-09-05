/**
 * Infer output file extension from content-type or source URL.
 * -----------------------------------------------------------------------------
 * @param {string|undefined} contentType - Response content type.
 * @param {string} mediaUrl - Source media URL.
 * @returns {string} Suggested file extension.
 */
const getMediaExtension = (contentType, mediaUrl) => {
  if (contentType) {
    if (contentType.includes('video')) {
      return 'mp4';
    }
    if (contentType.includes('png')) {
      return 'png';
    }
    if (contentType.includes('gif')) {
      return 'gif';
    }
    if (contentType.includes('webp')) {
      return 'webp';
    }
  }
  if (mediaUrl.includes('.mp4')) {
    return 'mp4';
  }
  if (mediaUrl.includes('.png')) {
    return 'png';
  }
  if (mediaUrl.includes('.gif')) {
    return 'gif';
  }
  if (mediaUrl.includes('.webp')) {
    return 'webp';
  }
  return 'jpg';
};

module.exports = {
  getMediaExtension
};
