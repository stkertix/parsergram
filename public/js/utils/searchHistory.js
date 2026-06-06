const STORAGE_KEY = 'searchHistory';
const MAX_ITEMS = 100;

export function loadSearchHistory() {
  const savedHistory = localStorage.getItem(STORAGE_KEY);
  if (!savedHistory) {
    return [];
  }

  try {
    const parsed = JSON.parse(savedHistory);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => typeof item === 'string' && item.trim() !== '')
      .slice(0, MAX_ITEMS);
  } catch (_e) {
    return [];
  }
}

export function saveSearchHistory(history, username) {
  if (!username) {
    return history;
  }
  const next = [username, ...history.filter((item) => item !== username)].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearSearchHistory() {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}

export function buildAutocompleteItems(searchHistory) {
  const sorted = [...searchHistory].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  if (sorted.length === 0) {
    return [];
  }

  const items = [];
  let currentLetter = '';

  sorted.forEach((username) => {
    const first = username.trim().charAt(0);
    const letter = /[a-zA-Z]/.test(first) ? first.toUpperCase() : '#';
    if (letter !== currentLetter) {
      currentLetter = letter;
      items.push({ type: 'subheader', title: letter });
    }
    items.push({ title: username, value: username });
  });

  items.push({ type: 'divider' });
  items.push({ title: 'Clear search history', value: '__clear_history__' });

  return items;
}
