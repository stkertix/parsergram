/**
 * Convert Instagram node image data to parser candidate format.
 * -----------------------------------------------------------------------------
 * @param {object} node - Instagram media node.
 * @returns {{url: string, height: number, width: number}} Image candidate object.
 */
const toImageCandidate = (node) => ({
  url: node.display_url,
  height: node.dimensions?.height || 0,
  width: node.dimensions?.width || 0
});

/**
 * Convert Instagram node video data to parser video_versions format.
 * -----------------------------------------------------------------------------
 * @param {object} node - Instagram media node.
 * @returns {Array<{url: string, height: number, width: number}>|undefined} Video versions list.
 */
const toVideoVersions = (node) => {
  if (!node.is_video || !node.video_url) {
    return undefined;
  }
  return [{
    url: node.video_url,
    height: node.dimensions?.height || 0,
    width: node.dimensions?.width || 0
  }];
};

/**
 * Convert feed node to normalized parser item format.
 * Handles single media and carousel media.
 * -----------------------------------------------------------------------------
 * @param {object} node - Instagram feed node.
 * @param {string} username - Username owner of media.
 * @returns {object} Normalized parser item.
 */
const toMediaItem = (node, username) => {
  const item = {
    id: node.id,
    taken_at: node.taken_at_timestamp,
    user: { username },
    image_versions2: {
      candidates: [toImageCandidate(node)]
    }
  };

  const videoVersions = toVideoVersions(node);
  if (videoVersions) {
    item.video_versions = videoVersions;
  }

  const children = node.edge_sidecar_to_children?.edges || [];
  if (children.length > 0) {
    item.carousel_media = children
      .map((edge) => edge.node)
      .filter((childNode) => childNode?.display_url)
      .map((childNode) => {
        const child = {
          id: childNode.id,
          taken_at: node.taken_at_timestamp,
          image_versions2: {
            candidates: [toImageCandidate(childNode)]
          }
        };

        const childVideoVersions = toVideoVersions(childNode);
        if (childVideoVersions) {
          child.video_versions = childVideoVersions;
        }

        return child;
      });
  }

  return item;
};

/**
 * Parse width/height from Instagram profile picture URL.
 * -----------------------------------------------------------------------------
 * @param {string} url - Profile picture URL.
 * @returns {{width: number, height: number}} Parsed dimensions.
 */
const extractSizeFromProfilePicUrl = (url) => {
  if (!url) {
    return { width: 0, height: 0 };
  }

  const match = url.match(/_s(\d+)x(\d+)_/);
  if (!match) {
    return { width: 0, height: 0 };
  }

  return {
    width: Number(match[1]) || 0,
    height: Number(match[2]) || 0
  };
};

/**
 * Pick best available profile picture candidate.
 * -----------------------------------------------------------------------------
 * @param {object} user - Instagram user object.
 * @returns {{url: string, width: number, height: number}|null} Best picture candidate.
 */
const chooseBestProfilePicture = (user) => {
  const candidates = [];

  if (Array.isArray(user.hd_profile_pic_versions)) {
    user.hd_profile_pic_versions.forEach((item) => {
      if (!item?.url) {
        return;
      }
      candidates.push({
        url: item.url,
        width: item.width || 0,
        height: item.height || 0
      });
    });
  }

  if (user.profile_pic_url_hd) {
    const size = extractSizeFromProfilePicUrl(user.profile_pic_url_hd);
    candidates.push({
      url: user.profile_pic_url_hd,
      width: size.width,
      height: size.height
    });
  }

  if (user.profile_pic_url) {
    const size = extractSizeFromProfilePicUrl(user.profile_pic_url);
    candidates.push({
      url: user.profile_pic_url,
      width: size.width,
      height: size.height
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, current) => {
    const bestArea = (best.width || 0) * (best.height || 0);
    const currentArea = (current.width || 0) * (current.height || 0);
    return currentArea > bestArea ? current : best;
  });
};

/**
 * Convert profile picture data into normalized parser item.
 * -----------------------------------------------------------------------------
 * @param {object} user - Instagram user object.
 * @param {string} username - Username value.
 * @returns {object|null} Profile picture item or null when missing.
 */
const toProfilePictureItem = (user, username) => {
  const bestProfilePic = chooseBestProfilePicture(user);
  if (!bestProfilePic?.url) {
    return null;
  }

  return {
    id: `profile-${user.id || username}`,
    taken_at: Math.floor(Date.now() / 1000),
    user: { username },
    image_versions2: {
      candidates: [{
        url: bestProfilePic.url,
        width: bestProfilePic.width || 320,
        height: bestProfilePic.height || 320
      }]
    },
    media_kind: 'profile'
  };
};

/**
 * Convert story/highlight reel item to normalized parser item.
 * -----------------------------------------------------------------------------
 * @param {object} reelItem - Story/highlight media item.
 * @param {string} username - Username owner of media.
 * @param {string} mediaKind - Label for source kind (story/highlight).
 * @returns {object|null} Normalized item or null when invalid.
 */
const toReelMediaItem = (reelItem, username, mediaKind) => {
  const imageCandidate = reelItem.image_versions2?.candidates?.[0];
  const fallbackWidth = reelItem.original_width || 0;
  const fallbackHeight = reelItem.original_height || 0;

  if (!imageCandidate?.url) {
    return null;
  }

  const item = {
    id: reelItem.id,
    taken_at: reelItem.taken_at,
    user: { username },
    image_versions2: {
      candidates: [{
        url: imageCandidate.url,
        width: imageCandidate.width || fallbackWidth,
        height: imageCandidate.height || fallbackHeight
      }]
    },
    media_kind: mediaKind
  };

  if (reelItem.video_versions?.[0]?.url) {
    item.video_versions = [{
      url: reelItem.video_versions[0].url,
      width: reelItem.video_versions[0].width || fallbackWidth,
      height: reelItem.video_versions[0].height || fallbackHeight
    }];
  }

  return item;
};

/**
 * Normalize feed item from Instagram feed/user endpoint.
 * @param {object} feedItem - Raw feed item from API.
 * @param {string} fallbackUsername - Username fallback when user object missing.
 * @returns {object|null} Normalized feed item.
 */
const toApiFeedItem = (feedItem, fallbackUsername) => {
  const primaryImage = feedItem?.image_versions2?.candidates?.[0];
  if (!primaryImage?.url) {
    return null;
  }

  const item = {
    id: feedItem.id,
    taken_at: feedItem.taken_at,
    user: { username: feedItem.user?.username || fallbackUsername },
    image_versions2: {
      candidates: [{
        url: primaryImage.url,
        width: primaryImage.width || feedItem.original_width || 0,
        height: primaryImage.height || feedItem.original_height || 0
      }]
    },
    media_kind: 'feed'
  };

  if (feedItem.video_versions?.[0]?.url) {
    item.video_versions = [{
      url: feedItem.video_versions[0].url,
      width: feedItem.video_versions[0].width || feedItem.original_width || 0,
      height: feedItem.video_versions[0].height || feedItem.original_height || 0
    }];
  }

  const carouselMedia = feedItem.carousel_media || [];
  if (carouselMedia.length > 0) {
    item.carousel_media = carouselMedia
      .map((media) => {
        const imageCandidate = media?.image_versions2?.candidates?.[0];
        if (!imageCandidate?.url) {
          return null;
        }
        const mediaItem = {
          id: media.id,
          taken_at: media.taken_at || feedItem.taken_at,
          image_versions2: {
            candidates: [{
              url: imageCandidate.url,
              width: imageCandidate.width || media.original_width || 0,
              height: imageCandidate.height || media.original_height || 0
            }]
          }
        };
        if (media.video_versions?.[0]?.url) {
          mediaItem.video_versions = [{
            url: media.video_versions[0].url,
            width: media.video_versions[0].width || media.original_width || 0,
            height: media.video_versions[0].height || media.original_height || 0
          }];
        }
        return mediaItem;
      })
      .filter(Boolean);
  }

  return item;
};

module.exports = {
  toImageCandidate,
  toVideoVersions,
  toMediaItem,
  extractSizeFromProfilePicUrl,
  chooseBestProfilePicture,
  toProfilePictureItem,
  toReelMediaItem,
  toApiFeedItem
};
