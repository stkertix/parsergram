function withHighlightMeta(o, source) {
  if (source.highlight_title) {
    o.highlight_title = source.highlight_title;
  }
  if (source.highlight_id) {
    o.highlight_id = source.highlight_id;
  }
  return o;
}

/**
 * Parse Instagram JSON into normalized result rows.
 * @param {object} json - Parsed JSON payload.
 * @param {string} type - Parser mode key.
 * @returns {object[]} Normalized media rows.
 */
export function parserData(json, type) {
  if (!json) {
    return [];
  }

  const result = [];

  switch (type) {
    case 'xdt_api__v1__feed__reels_media':
      json.data.xdt_api__v1__feed__reels_media.reels_media[0].items.forEach((item) => {
        const o = {
          id: item.id,
          username: json.data.xdt_api__v1__feed__reels_media.reels_media[0].user.username,
          taken_at: moment.unix(item.taken_at).format('YYYYMMDD-HHmmss'),
          filename: json.data.xdt_api__v1__feed__reels_media.reels_media[0].user.username + '-' + moment.unix(item.taken_at).format('YYYYMMDD-HHmmss'),
          image: {
            url: item.image_versions2.candidates[0].url,
            height: item.image_versions2.candidates[0].height,
            width: item.image_versions2.candidates[0].width
          },
          media_kind: item.media_kind || 'story'
        };

        if (item.video_versions) {
          o.video = {
            url: item.video_versions[0].url,
            height: item.original_height,
            width: item.original_width
          };
        }

        result.push(o);
      });
      break;

    case 'xdt_api__v1__feed__reels_media__connection':
      json.data.xdt_api__v1__feed__reels_media__connection.edges.forEach((edge) => {
        edge.node.items.forEach((item) => {
          const o = {
            id: item.id,
            username: edge.node.user.username,
            taken_at: moment.unix(item.taken_at).format('YYYYMMDD-HHmmss'),
            filename: edge.node.user.username + '-' + moment.unix(item.taken_at).format('YYYYMMDD-HHmmss'),
            image: {
              url: item.image_versions2.candidates[0].url,
              height: item.image_versions2.candidates[0].height,
              width: item.image_versions2.candidates[0].width
            },
            media_kind: item.media_kind || 'highlight'
          };

          if (item.video_versions) {
            o.video = {
              url: item.video_versions[0].url,
              height: item.original_height,
              width: item.original_width
            };
          }

          result.push(o);
        });
      });
      break;

    case 'feed':
      json.items.forEach((item) => {
        const itemMediaKind = item.media_kind || 'feed';

        if (item.carousel_media) {
          item.carousel_media.forEach((cm, idx) => {
            const sequence = String(idx + 1).padStart(3, '0');
            const o = {
              id: cm.id,
              username: item.user.username,
              taken_at: moment.unix(cm.taken_at).format('YYYYMMDD-HHmmss') + '-' + sequence,
              filename: item.user.username + '-' + moment.unix(cm.taken_at).format('YYYYMMDD-HHmmss') + '-' + sequence,
              image: {
                url: cm.image_versions2.candidates[0].url,
                height: cm.image_versions2.candidates[0].height,
                width: cm.image_versions2.candidates[0].width
              },
              media_kind: cm.media_kind || itemMediaKind
            };

            if (cm.video_versions) {
              o.video = {
                url: cm.video_versions[0].url,
                height: cm.video_versions[0].height,
                width: cm.video_versions[0].width
              };
            }

            result.push(withHighlightMeta(o, item));
          });
        } else if (item.video_versions) {
          const o = {
            id: item.id,
            username: item.user.username,
            taken_at: moment.unix(item.taken_at).format('YYYYMMDD-HHmmss'),
            filename: item.user.username + '-' + moment.unix(item.taken_at).format('YYYYMMDD-HHmmss'),
            image: {
              url: item.image_versions2.candidates[0].url,
              height: item.image_versions2.candidates[0].height,
              width: item.image_versions2.candidates[0].width
            },
            video: {
              url: item.video_versions[0].url,
              height: item.video_versions[0].height,
              width: item.video_versions[0].width
            },
            media_kind: itemMediaKind
          };

          result.push(withHighlightMeta(o, item));
        } else if (item.image_versions2) {
          const o = {
            id: item.id,
            username: item.user.username,
            taken_at: moment.unix(item.taken_at).format('YYYYMMDD-HHmmss'),
            filename: item.user.username + '-' + moment.unix(item.taken_at).format('YYYYMMDD-HHmmss'),
            image: {
              url: item.image_versions2.candidates[0].url,
              height: item.image_versions2.candidates[0].height,
              width: item.image_versions2.candidates[0].width
            },
            media_kind: itemMediaKind
          };

          result.push(withHighlightMeta(o, item));
        }
      });
      break;

    default:
      break;
  }

  return result;
}
