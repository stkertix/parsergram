export function resultProfileEntries(result) {
  return result
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.media_kind === 'profile');
}

export function resultStoryEntries(result) {
  return result
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.media_kind === 'story');
}

export function resultHighlightEntries(result) {
  return result
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.media_kind === 'highlight');
}

export function resultHighlightGroups(result) {
  const groups = new Map();

  resultHighlightEntries(result).forEach((entry) => {
    const title = entry.item.highlight_title || 'Highlight';
    if (!groups.has(title)) {
      groups.set(title, []);
    }
    groups.get(title).push(entry);
  });

  return Array.from(groups.entries()).map(([title, entries]) => ({ title, entries }));
}

export function resultFeedEntries(result) {
  return result
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const k = item.media_kind;
      return !k || k === 'feed' || (k !== 'profile' && k !== 'story' && k !== 'highlight');
    });
}

export function resultSectionBlocks(result) {
  return [
    { key: 'profile', title: 'Profile', entries: resultProfileEntries(result) },
    { key: 'story', title: 'Story', entries: resultStoryEntries(result) },
    { key: 'highlight', title: 'Highlight', entries: resultHighlightEntries(result) },
    { key: 'feed', title: 'Post feed', entries: resultFeedEntries(result) }
  ].filter((block) => block.entries.length > 0);
}

export function resultProfileBlock(result) {
  const block = resultSectionBlocks(result).find((b) => b.key === 'profile');
  return block && block.entries.length > 0 ? block : null;
}

export function expandableSectionBlocks(result) {
  return resultSectionBlocks(result).filter((block) =>
    ['story', 'highlight', 'feed'].includes(block.key)
  );
}

export function getMediaCardLabel(item) {
  return item.highlight_title || item.media_kind || 'feed';
}
