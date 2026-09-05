const STORAGE_KEY = 'parsergram-ig-cookies';

/**
 * Reserved id used when the user explicitly wants no cookie at all.
 */
export const NO_COOKIE_ID = '__no_cookie__';

/**
 * @typedef {{ id: string, name: string, value: string }} IgCookieProfile
 * @typedef {{ profiles: IgCookieProfile[], activeId: string }} IgCookieStore
 */

/**
 * Create a short unique id for a cookie profile.
 * @returns {string}
 */
const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * @returns {IgCookieStore}
 */
const emptyStore = () => ({ profiles: [], activeId: '' });

/**
 * Load cookie profiles from localStorage.
 * @returns {IgCookieStore}
 */
export const loadIgCookieStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyStore();
    }
    const parsed = JSON.parse(raw);
    const profiles = Array.isArray(parsed?.profiles)
      ? parsed.profiles
        .filter((p) => p && typeof p.value === 'string' && p.value.trim())
        .map((p) => ({
          id: String(p.id || createId()),
          name: String(p.name || 'Cookie').trim() || 'Cookie',
          value: String(p.value).trim()
        }))
      : [];
    const activeId = parsed?.activeId === NO_COOKIE_ID || profiles.some((p) => p.id === parsed?.activeId)
      ? parsed.activeId
      : (profiles[0]?.id || '');
    return { profiles, activeId };
  } catch (_e) {
    return emptyStore();
  }
};

/**
 * Persist cookie store to localStorage.
 * @param {IgCookieStore} store
 * @returns {IgCookieStore}
 */
export const saveIgCookieStore = (store) => {
  const profiles = (store.profiles || [])
    .filter((p) => p && typeof p.value === 'string' && p.value.trim())
    .map((p) => ({
      id: String(p.id || createId()),
      name: String(p.name || 'Cookie').trim() || 'Cookie',
      value: String(p.value).trim()
    }));
  const activeId = store.activeId === NO_COOKIE_ID || profiles.some((p) => p.id === store.activeId)
    ? store.activeId
    : (profiles[0]?.id || '');
  const next = { profiles, activeId };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

/**
 * Get the currently selected cookie value, or empty string.
 * @param {IgCookieStore} [store]
 * @returns {string}
 */
export const getActiveIgCookie = (store) => {
  const current = store || loadIgCookieStore();
  if (current.activeId === NO_COOKIE_ID) {
    return '';
  }
  const active = current.profiles.find((p) => p.id === current.activeId);
  return (active?.value || '').trim();
};

/**
 * Add or update a named cookie profile and make it active.
 * @param {IgCookieStore} store
 * @param {{ id?: string, name: string, value: string }} profile
 * @returns {IgCookieStore}
 */
export const upsertIgCookieProfile = (store, profile) => {
  const name = (profile.name || '').trim() || 'Cookie';
  const value = (profile.value || '').trim();
  if (!value) {
    return store;
  }

  const profiles = [...(store.profiles || [])];
  if (profile.id) {
    const index = profiles.findIndex((p) => p.id === profile.id);
    if (index >= 0) {
      profiles[index] = { ...profiles[index], name, value };
      return saveIgCookieStore({ profiles, activeId: profiles[index].id });
    }
  }

  const nextProfile = { id: createId(), name, value };
  profiles.push(nextProfile);
  return saveIgCookieStore({ profiles, activeId: nextProfile.id });
};

/**
 * Remove a cookie profile by id.
 * @param {IgCookieStore} store
 * @param {string} id
 * @returns {IgCookieStore}
 */
export const removeIgCookieProfile = (store, id) => {
  const profiles = (store.profiles || []).filter((p) => p.id !== id);
  const activeId = store.activeId === id ? (profiles[0]?.id || '') : store.activeId;
  return saveIgCookieStore({ profiles, activeId });
};

/**
 * Set the active cookie profile id.
 * @param {IgCookieStore} store
 * @param {string} id
 * @returns {IgCookieStore}
 */
export const setActiveIgCookieId = (store, id) => {
  if (id === NO_COOKIE_ID) {
    return saveIgCookieStore({ ...store, activeId: NO_COOKIE_ID });
  }
  if (!store.profiles.some((p) => p.id === id)) {
    return store;
  }
  return saveIgCookieStore({ ...store, activeId: id });
};

/**
 * Check whether the user explicitly selected "No Cookie".
 * @param {IgCookieStore} [store]
 * @returns {boolean}
 */
export const isNoCookieMode = (store) => {
  const current = store || loadIgCookieStore();
  return current.activeId === NO_COOKIE_ID;
};

/**
 * Headers to attach to API fetches when a frontend cookie is selected.
 * When "No Cookie" is active, sends a special header so the server skips
 * its own env-based fallback too.
 * @param {IgCookieStore} [store]
 * @returns {Record<string, string>}
 */
export const getIgCookieHeaders = (store) => {
  const current = store || loadIgCookieStore();
  if (current.activeId === NO_COOKIE_ID) {
    return { 'X-IG-Cookie': '__none__' };
  }
  const cookie = getActiveIgCookie(current);
  if (!cookie) {
    return {};
  }
  return { 'X-IG-Cookie': cookie };
};
