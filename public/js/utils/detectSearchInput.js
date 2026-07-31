/**
 * Detect whether a search query is a username, Instagram URL, or raw JSON.
 * @param {unknown} raw
 * @returns {{ kind: 'empty'|'username'|'url'|'json', value: string }}
 */
export function detectSearchInput(raw) {
  let value = '';
  if (raw == null) {
    value = '';
  } else if (typeof raw === 'object') {
    value = String(raw.value ?? raw.title ?? '');
  } else {
    value = String(raw);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { kind: 'empty', value: '' };
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return { kind: 'json', value: trimmed };
  }

  if (/instagram\.com\//i.test(trimmed)) {
    return { kind: 'url', value: trimmed };
  }

  return {
    kind: 'username',
    value: trimmed.replace(/^@/, '')
  };
}
