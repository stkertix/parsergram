import { getPath } from './utils/path.js';
import { parserData } from './utils/parserData.js';
import {
  loadSearchHistory,
  saveSearchHistory,
  clearSearchHistory,
  removeSearchHistoryItem,
  buildAutocompleteItems
} from './utils/searchHistory.js';
import {
  loadIgCookieStore,
  upsertIgCookieProfile,
  removeIgCookieProfile,
  setActiveIgCookieId,
  getIgCookieHeaders,
  NO_COOKIE_ID
} from './utils/igCookie.js';
import { detectSearchInput } from './utils/detectSearchInput.js';
import {
  errorFromResponse,
  isRateLimitError,
  getRetryAfterMs,
  MAX_AUTO_RETRIES
} from './utils/rateLimitRetry.js';

const THEME_STORAGE_KEY = 'parsergram-theme';
const LOAD_PARTS_STORAGE_KEY = 'parsergram-load-parts';

/**
 * Load last selected profile parts from localStorage.
 * @returns {string[]}
 */
const loadSavedParts = () => {
  try {
    const raw = localStorage.getItem(LOAD_PARTS_STORAGE_KEY);
    if (!raw) {
      return ['story', 'highlight', 'feed'];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return ['story', 'highlight', 'feed'];
    }
    const allowed = new Set(['story', 'highlight', 'feed']);
    const next = parsed.filter((part) => allowed.has(part));
    return next.length > 0 ? next : ['story', 'highlight', 'feed'];
  } catch (_error) {
    return ['story', 'highlight', 'feed'];
  }
};

export const App = {
  data() {
    return {
      jsonString: '',
      result: [],
      preview: {
        selected: { index: 0 },
        isDragging: false,
        isShow: false,
        isVideo: false,
        zoom: 1,
        pos: { x: 0, y: 0 },
        start: { x: 0, y: 0 }
      },
      searchQuery: '',
      username: '',
      usernameLoading: false,
      postUrlLoading: false,
      usernameError: '',
      searchHistory: [],
      isDarkMode: false,
      highlightTray: [],
      highlightLoadingIds: {},
      storyLoading: false,
      deleteHistoryDialog: {
        isShow: false,
        pendingUsername: ''
      },
      cookieStore: {
        profiles: [],
        activeId: ''
      },
      cookieSettingsDialog: {
        isShow: false
      },
      loadPartsDialog: {
        isShow: false,
        username: '',
        parts: loadSavedParts()
      },
      rateLimitRetry: {
        active: false,
        secondsLeft: 0,
        kind: '',
        payload: null,
        attempt: 0,
        timerId: null,
        tickId: null
      }
    };
  },

  computed: {
    searchLoading() {
      return this.usernameLoading || this.postUrlLoading;
    },
    searchHistoryAutocompleteItems() {
      return buildAutocompleteItems(this.searchHistory);
    },
    resultPanelKey() {
      const first = this.result[0];
      const trayKey = this.highlightTray.map((tray) => tray.id).join(',');
      return this.result.length + '-' + trayKey + '-' + (first?.username || '');
    },
    isNoCookieActive() {
      return this.cookieStore.activeId === NO_COOKIE_ID;
    },
    activeCookieLabel() {
      if (this.isNoCookieActive) {
        return 'No Cookie';
      }
      const active = this.cookieStore.profiles.find((p) => p.id === this.cookieStore.activeId);
      return active?.name || '';
    },
    rateLimitRetryMessage() {
      if (!this.rateLimitRetry.active) {
        return '';
      }
      const label = {
        profile: 'profile',
        story: 'stories',
        post: 'post',
        highlight: 'highlight'
      }[this.rateLimitRetry.kind] || 'request';
      return `Rate limited. Auto-retrying ${label} in ${this.rateLimitRetry.secondsLeft}s…`;
    }
  },

  watch: {
    jsonString(value) {
      if (!value || value.trim() === '') {
        this.result = [];
        this.preview.isShow = false;
        this.preview.selected.index = 0;
        return false;
      }

      let json = null;
      try {
        json = JSON.parse(value);
      } catch (_e) {
        this.usernameError = 'Invalid JSON format';
        return false;
      }
      if (!json) {
        return false;
      }
      this.usernameError = '';

      if (json.data != undefined && json.data.xdt_api__v1__feed__reels_media != undefined) {
        this.applyParserResult(parserData(json, 'xdt_api__v1__feed__reels_media'));
      } else if (json.data != undefined && json.data.xdt_api__v1__feed__reels_media__connection != undefined) {
        this.applyParserResult(parserData(json, 'xdt_api__v1__feed__reels_media__connection'));
      } else {
        this.applyParserResult(parserData(json, 'feed'));
      }
    },

    'preview.isShow'(val) {
      if (val) {
        window.addEventListener('keydown', this.handleKey);
      } else {
        window.removeEventListener('keydown', this.handleKey);
      }
    }
  },

  methods: {
    getPath,

    getMediaImageSrc(item) {
      return getPath('/load?url=') + encodeURIComponent(item.image.url);
    },

    applyTheme() {
      const theme = this.isDarkMode ? 'dark' : 'light';
      this.$vuetify.theme.global.name = theme;
      document.documentElement.classList.toggle('theme-dark', this.isDarkMode);
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    },

    toggleTheme() {
      this.isDarkMode = !this.isDarkMode;
      this.applyTheme();
    },

    applyParserResult(parsedResult) {
      this.result = parsedResult;
    },

    openCookieSettings() {
      this.cookieSettingsDialog.isShow = true;
    },

    selectIgCookie(id) {
      this.cookieStore = setActiveIgCookieId(this.cookieStore, id);
    },

    saveIgCookie(profile) {
      this.cookieStore = upsertIgCookieProfile(this.cookieStore, profile);
    },

    removeIgCookie(id) {
      this.cookieStore = removeIgCookieProfile(this.cookieStore, id);
    },

    describeFetchError(error, fallback) {
      if (this.isNoCookieActive) {
        return 'No Cookie mode is active, so Instagram rejected the request. '
          + 'Select a saved cookie in IG Cookie settings to fetch data.';
      }
      const message = error.message || fallback;
      if (isRateLimitError(error)) {
        const seconds = Math.ceil(getRetryAfterMs(error) / 1000);
        return `Instagram rate limited (429). Auto-retry in ~${seconds}s.`;
      }
      return message;
    },

    clearRateLimitRetry() {
      if (this.rateLimitRetry.timerId) {
        clearTimeout(this.rateLimitRetry.timerId);
      }
      if (this.rateLimitRetry.tickId) {
        clearInterval(this.rateLimitRetry.tickId);
      }
      this.rateLimitRetry = {
        active: false,
        secondsLeft: 0,
        kind: '',
        payload: null,
        attempt: 0,
        timerId: null,
        tickId: null
      };
    },

    cancelRateLimitRetry() {
      this.clearRateLimitRetry();
      this.usernameError = 'Auto-retry cancelled.';
    },

    /**
     * Schedule one auto-retry after Instagram cooldown.
     * @param {{ kind: string, payload: object, retryAfterMs: number, attempt?: number }} options
     */
    scheduleRateLimitRetry({ kind, payload, retryAfterMs, attempt = 0 }) {
      if (attempt >= MAX_AUTO_RETRIES) {
        this.clearRateLimitRetry();
        this.usernameError = `Rate limited again after ${MAX_AUTO_RETRIES} auto-retries. Try again later.`;
        return;
      }

      this.clearRateLimitRetry();
      const waitMs = Math.max(1000, retryAfterMs || 60000);
      const secondsLeft = Math.ceil(waitMs / 1000);

      this.rateLimitRetry = {
        active: true,
        secondsLeft,
        kind,
        payload,
        attempt,
        timerId: null,
        tickId: null
      };

      this.usernameError = this.rateLimitRetryMessage;

      this.rateLimitRetry.tickId = setInterval(() => {
        if (this.rateLimitRetry.secondsLeft <= 1) {
          return;
        }
        this.rateLimitRetry.secondsLeft -= 1;
        this.usernameError = this.rateLimitRetryMessage;
      }, 1000);

      this.rateLimitRetry.timerId = setTimeout(() => {
        this.runScheduledRateLimitRetry();
      }, waitMs);
    },

    async runScheduledRateLimitRetry() {
      const { kind, payload, attempt } = this.rateLimitRetry;
      this.clearRateLimitRetry();
      this.usernameError = 'Cooldown finished — retrying…';

      try {
        if (kind === 'profile') {
          await this.getInstagramProfile(payload?.parts, { isAutoRetry: true, attempt: attempt + 1 });
          return;
        }
        if (kind === 'story') {
          await this.loadStoriesLazy(payload?.username, { isAutoRetry: true, attempt: attempt + 1 });
          return;
        }
        if (kind === 'post') {
          await this.getInstagramPostByUrl(payload?.url, { isAutoRetry: true, attempt: attempt + 1 });
          return;
        }
        if (kind === 'highlight') {
          await this.loadHighlightAlbum(payload, { isAutoRetry: true, attempt: attempt + 1 });
        }
      } catch (_error) {
        // Individual loaders already handle/schedule errors.
      }
    },

    handlePossibleRateLimit(error, { kind, payload, isAutoRetry = false, attempt = 0 }) {
      if (!isRateLimitError(error)) {
        return false;
      }
      const nextAttempt = isAutoRetry ? attempt : 0;
      this.scheduleRateLimitRetry({
        kind,
        payload,
        retryAfterMs: getRetryAfterMs(error),
        attempt: nextAttempt
      });
      return true;
    },

    normalizeUsernameValue(value) {
      if (value == null) {
        return '';
      }
      if (typeof value === 'object') {
        return value.value ?? value.title ?? '';
      }
      return String(value);
    },

    onQueryAutocompleteUpdate(value) {
      if (value === '__clear_history__') {
        this.searchHistory = clearSearchHistory();
        this.searchQuery = '';
        this.username = '';
        return;
      }

      const normalized = this.normalizeUsernameValue(value);
      this.searchQuery = normalized;

      const detected = detectSearchInput(normalized);
      if (detected.kind !== 'username' || !detected.value || this.searchLoading) {
        return;
      }

      const norm = (s) => (s || '').trim().replace(/^@/, '').toLowerCase();
      const isExactHistoryPick = this.searchHistory.some(
        (item) => item === detected.value || norm(item) === norm(detected.value)
      );

      if (isExactHistoryPick) {
        this.username = detected.value;
        this.promptProfileLoad();
      }
    },

    submitSearch() {
      const detected = detectSearchInput(this.searchQuery);
      if (detected.kind === 'empty') {
        this.usernameError = 'Enter a username, Instagram URL, or JSON';
        return;
      }

      this.clearRateLimitRetry();
      this.usernameError = '';
      this.searchQuery = detected.value;

      if (detected.kind === 'url') {
        this.getInstagramPostByUrl(detected.value);
        return;
      }

      if (detected.kind === 'json') {
        this.jsonString = detected.value;
        return;
      }

      this.username = detected.value;
      this.promptProfileLoad();
    },

    downloadMedia(mediaUrl, filename) {
      const params = [
        'url=' + encodeURIComponent(mediaUrl),
        'filename=' + filename
      ];
      window.open(getPath('/download?') + params.join('&'));
    },

    promptDeleteHistory(username) {
      const normalized = (username || '').trim().replace(/^@/, '');
      if (!normalized) {
        return;
      }
      this.deleteHistoryDialog.pendingUsername = normalized;
      this.deleteHistoryDialog.isShow = true;
    },

    confirmDeleteHistory(confirmed) {
      const username = this.deleteHistoryDialog.pendingUsername;
      this.deleteHistoryDialog.isShow = false;

      if (!confirmed || !username) {
        this.deleteHistoryDialog.pendingUsername = '';
        return;
      }

      this.searchHistory = removeSearchHistoryItem(this.searchHistory, username);

      const norm = (s) => (s || '').trim().replace(/^@/, '').toLowerCase();
      if (norm(this.username) === norm(username) || norm(this.searchQuery) === norm(username)) {
        this.username = '';
        this.searchQuery = '';
      }

      this.deleteHistoryDialog.pendingUsername = '';
    },

    promptProfileLoad() {
      const username = (this.username || this.searchQuery || '').trim().replace(/^@/, '');
      if (!username) {
        this.usernameError = 'Instagram username is required';
        return;
      }

      this.username = username;
      this.searchQuery = username;
      this.usernameError = '';
      this.loadPartsDialog.username = username;
      this.loadPartsDialog.parts = loadSavedParts();
      this.loadPartsDialog.isShow = true;
    },

    confirmLoadParts(parts) {
      const selected = Array.isArray(parts) && parts.length > 0
        ? parts
        : this.loadPartsDialog.parts;
      if (!selected.length) {
        return;
      }

      try {
        localStorage.setItem(LOAD_PARTS_STORAGE_KEY, JSON.stringify(selected));
      } catch (_error) {
        // Ignore storage failures.
      }

      this.loadPartsDialog.parts = selected;
      this.loadPartsDialog.isShow = false;
      this.getInstagramProfile(selected);
    },

    async getInstagramProfile(partsOverride, options = {}) {
      const username = (this.username || '').trim().replace(/^@/, '');
      if (!username) {
        this.usernameError = 'Instagram username is required';
        return;
      }

      const parts = Array.isArray(partsOverride) && partsOverride.length > 0
        ? partsOverride
        : loadSavedParts();
      const wantFeed = parts.includes('feed');
      const wantHighlight = parts.includes('highlight');
      const wantStory = parts.includes('story');
      const profileParts = [
        ...(wantFeed ? ['feed'] : []),
        ...(wantHighlight ? ['highlight'] : [])
      ];
      const retryPayload = { parts };

      if (!options.isAutoRetry) {
        this.clearRateLimitRetry();
      }

      this.username = username;
      this.searchQuery = username;
      this.usernameError = '';
      this.result = [];
      this.highlightTray = [];
      this.highlightLoadingIds = {};
      this.storyLoading = false;
      this.preview.isShow = false;
      this.preview.selected.index = 0;
      this.usernameLoading = true;

      try {
        const params = new URLSearchParams({ username });
        if (wantFeed || wantHighlight) {
          params.set('parts', profileParts.join(','));
        } else {
          params.set('parts', 'none');
        }

        const response = await fetch(
          getPath('/profile?') + params.toString(),
          { headers: getIgCookieHeaders(this.cookieStore) }
        );
        if (!response.ok) {
          throw await errorFromResponse(response);
        }

        const data = await response.json();
        this.highlightTray = wantHighlight && Array.isArray(data.highlight_tray)
          ? data.highlight_tray
          : [];
        this.jsonString = JSON.stringify({ items: data.items || [] });
        this.searchHistory = saveSearchHistory(this.searchHistory, username);
        this.clearRateLimitRetry();

        if (wantStory) {
          this.loadStoriesLazy(username);
        }
      } catch (error) {
        console.error('Gagal mengambil data profile:', error);
        if (this.handlePossibleRateLimit(error, {
          kind: 'profile',
          payload: retryPayload,
          isAutoRetry: Boolean(options.isAutoRetry),
          attempt: options.attempt || 0
        })) {
          return;
        }
        this.usernameError = this.describeFetchError(
          error,
          'Failed to fetch profile. Check the username or try again.'
        );
      } finally {
        this.usernameLoading = false;
      }
    },

    async loadStoriesLazy(usernameOverride, options = {}) {
      const username = (usernameOverride || this.username || '').trim().replace(/^@/, '');
      if (!username || this.storyLoading) {
        return;
      }

      this.storyLoading = true;
      try {
        const response = await fetch(
          getPath('/story?username=') + encodeURIComponent(username),
          { headers: getIgCookieHeaders(this.cookieStore) }
        );
        if (!response.ok) {
          throw await errorFromResponse(response);
        }

        const data = await response.json();
        const storyItems = parserData({ items: data.items || [] }, 'feed');
        if (storyItems.length === 0) {
          return;
        }

        const withoutStories = this.result.filter((item) => item.media_kind !== 'story');
        this.applyParserResult([...withoutStories, ...storyItems]);
      } catch (error) {
        console.warn('Gagal lazy-load story:', error.message || error);
        this.handlePossibleRateLimit(error, {
          kind: 'story',
          payload: { username },
          isAutoRetry: Boolean(options.isAutoRetry),
          attempt: options.attempt || 0
        });
      } finally {
        this.storyLoading = false;
      }
    },

    async loadHighlightAlbum({ id, title } = {}, options = {}) {
      const highlightId = (id || '').trim();
      const highlightTitle = (title || 'Highlight').trim() || 'Highlight';
      if (!highlightId || this.highlightLoadingIds[highlightId]) {
        return;
      }

      const username = (this.username || '').trim().replace(/^@/, '');
      if (!username) {
        return;
      }

      this.highlightLoadingIds = { ...this.highlightLoadingIds, [highlightId]: true };

      try {
        const params = new URLSearchParams({
          username,
          highlight_id: highlightId,
          title: highlightTitle
        });
        const response = await fetch(
          getPath('/highlight?') + params.toString(),
          { headers: getIgCookieHeaders(this.cookieStore) }
        );
        if (!response.ok) {
          throw await errorFromResponse(response);
        }

        const data = await response.json();
        const newItems = parserData({ items: data.items || [] }, 'feed');
        const filtered = this.result.filter((item) => item.highlight_id !== highlightId);
        this.applyParserResult([...filtered, ...newItems]);
        this.clearRateLimitRetry();
      } catch (error) {
        console.error('Gagal mengambil highlight:', error);
        if (this.handlePossibleRateLimit(error, {
          kind: 'highlight',
          payload: { id: highlightId, title: highlightTitle },
          isAutoRetry: Boolean(options.isAutoRetry),
          attempt: options.attempt || 0
        })) {
          return;
        }
        this.usernameError = this.describeFetchError(error, 'Failed to load highlight album.');
      } finally {
        const next = { ...this.highlightLoadingIds };
        delete next[highlightId];
        this.highlightLoadingIds = next;
      }
    },

    async getInstagramPostByUrl(urlOverride, options = {}) {
      const url = (urlOverride || this.searchQuery || '').trim();
      if (!url) {
        this.usernameError = 'Instagram post URL is required';
        return;
      }
      if (!/instagram\.com\//i.test(url)) {
        this.usernameError = 'Use an Instagram URL (post, reel, or tv)';
        return;
      }

      if (!options.isAutoRetry) {
        this.clearRateLimitRetry();
      }

      this.searchQuery = url;
      this.usernameError = '';
      this.result = [];
      this.preview.isShow = false;
      this.preview.selected.index = 0;
      this.postUrlLoading = true;

      try {
        const response = await fetch(
          getPath('/post?url=') + encodeURIComponent(url),
          { headers: getIgCookieHeaders(this.cookieStore) }
        );
        if (!response.ok) {
          throw await errorFromResponse(response);
        }

        const data = await response.json();
        this.jsonString = JSON.stringify(data);
        this.clearRateLimitRetry();
      } catch (error) {
        console.error('Gagal mengambil post:', error);
        if (this.handlePossibleRateLimit(error, {
          kind: 'post',
          payload: { url },
          isAutoRetry: Boolean(options.isAutoRetry),
          attempt: options.attempt || 0
        })) {
          return;
        }
        this.usernameError = this.describeFetchError(
          error,
          'Failed to fetch post. Check the URL or try again.'
        );
      } finally {
        this.postUrlLoading = false;
      }
    },

    showPreview(index) {
      this.preview.zoom = 1;
      this.preview.selected.index = index;
      this.preview.isVideo = false;
      this.preview.isShow = true;
      this.preview.pos = { x: 0, y: 0 };
      this.preview.start = { x: 0, y: 0 };
    },

    previous() {
      this.preview.zoom = 1;
      this.preview.isVideo = false;
      this.preview.pos = { x: 0, y: 0 };
      this.preview.start = { x: 0, y: 0 };
      if (this.preview.selected.index - 1 >= 0) {
        this.preview.selected.index--;
      }
    },

    next() {
      this.preview.zoom = 1;
      this.preview.isVideo = false;
      this.preview.pos = { x: 0, y: 0 };
      this.preview.start = { x: 0, y: 0 };
      if (this.preview.selected.index + 1 < this.result.length) {
        this.preview.selected.index++;
      }
    },

    resetZoom() {
      this.preview.zoom = 1;
      this.preview.pos = { x: 0, y: 0 };
      this.preview.start = { x: 0, y: 0 };
    },

    setZoom(newZoom) {
      const clamped = Math.min(Math.max(newZoom, 1), 4);
      this.preview.zoom = clamped;
      if (clamped === 1) {
        this.preview.pos = { x: 0, y: 0 };
      }
    },

    onScroll(e) {
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      this.setZoom(this.preview.zoom + delta);
    },

    startDrag(e) {
      if (!this.preview.isDragging) {
        if (this.preview.zoom <= 1) {
          return;
        }
        this.preview.isDragging = true;
        this.preview.start = { x: e.clientX - this.preview.pos.x, y: e.clientY - this.preview.pos.y };
      } else {
        this.endDrag();
      }
    },

    onDrag(e) {
      if (!this.preview.isDragging) {
        return;
      }
      this.preview.pos = { x: e.clientX - this.preview.start.x, y: e.clientY - this.preview.start.y };
    },

    endDrag() {
      this.preview.isDragging = false;
    },

    downloadCurrentPreview() {
      const item = this.result[this.preview.selected.index];
      if (!item) {
        return;
      }
      const mediaUrl = this.preview.isVideo && item.video
        ? item.video.url
        : item.image.url;
      this.downloadMedia(mediaUrl, item.filename);
    },

    handleKey(e) {
      if (!this.preview.isShow) {
        return;
      }

      if (e.key === 'Tab') {
        if (this.result[this.preview.selected.index].video !== undefined) {
          e.preventDefault();
          this.preview.isVideo = !this.preview.isVideo;
        }
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          this.next();
          break;
        case 'ArrowLeft':
          this.previous();
          break;
        case 'Enter':
          this.downloadCurrentPreview();
          break;
        default:
          break;
      }
    },

    resetData() {
      this.result = [];
      this.jsonString = '';
      this.searchQuery = '';
      this.username = '';
    }
  },

  mounted() {
    this.searchHistory = loadSearchHistory();
    this.cookieStore = loadIgCookieStore();
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    this.isDarkMode = saved === 'dark';
    this.applyTheme();
  },

  beforeUnmount() {
    this.clearRateLimitRetry();
    window.removeEventListener('keydown', this.handleKey);
  },

  template: `
    <v-app class="ig-app-shell">
      <app-bar-inputs
        v-model:query="searchQuery"
        :loading="searchLoading"
        :search-history-autocomplete-items="searchHistoryAutocompleteItems"
        :is-dark-mode="isDarkMode"
        @query-autocomplete-update="onQueryAutocompleteUpdate"
        @submit-search="submitSearch"
        @toggle-theme="toggleTheme"
        @request-delete-history="promptDeleteHistory"
        @open-cookie-settings="openCookieSettings"
      />

      <v-main>
        <div class="ig-main-column">
          <v-alert
            v-if="usernameError"
            :type="rateLimitRetry.active ? 'warning' : 'error'"
            variant="tonal"
            class="mt-3 mb-2"
            :closable="!rateLimitRetry.active"
            @click:close="usernameError = ''"
          >
            <div class="d-flex align-center justify-space-between ga-3 flex-wrap">
              <span>{{ usernameError }}</span>
              <v-btn
                v-if="rateLimitRetry.active"
                size="small"
                variant="text"
                @click="cancelRateLimitRetry"
              >
                Cancel
              </v-btn>
            </div>
          </v-alert>

          <v-chip
            v-if="activeCookieLabel"
            class="mt-3 ig-cookie-chip"
            size="small"
            variant="tonal"
            :color="isNoCookieActive ? 'warning' : undefined"
            :prepend-icon="isNoCookieActive ? 'fi-rr-exclamation' : 'fi-rr-key'"
            @click="openCookieSettings"
          >
            Cookie: {{ activeCookieLabel }}
          </v-chip>

          <delete-history-dialog
            :is-show="deleteHistoryDialog.isShow"
            :pending-username="deleteHistoryDialog.pendingUsername"
            @update:is-show="deleteHistoryDialog.isShow = $event"
            @confirm="confirmDeleteHistory"
          />

          <load-parts-dialog
            :is-show="loadPartsDialog.isShow"
            :username="loadPartsDialog.username"
            :selected-parts="loadPartsDialog.parts"
            @update:is-show="loadPartsDialog.isShow = $event"
            @update:selected-parts="loadPartsDialog.parts = $event"
            @confirm="confirmLoadParts"
          />

          <cookie-settings-dialog
            :is-show="cookieSettingsDialog.isShow"
            :profiles="cookieStore.profiles"
            :active-id="cookieStore.activeId"
            @update:is-show="cookieSettingsDialog.isShow = $event"
            @select="selectIgCookie"
            @save="saveIgCookie"
            @remove="removeIgCookie"
          />

          <result-panel
            v-if="result.length > 0 || highlightTray.length > 0"
            :key="resultPanelKey"
            :result="result"
            :highlight-tray="highlightTray"
            :highlight-loading-ids="highlightLoadingIds"
            :get-path="getPath"
            :get-media-image-src="getMediaImageSrc"
            @preview="showPreview"
            @download="downloadMedia"
            @load-highlight="loadHighlightAlbum"
          />

          <div
            v-else-if="!searchLoading"
            class="ig-empty-state"
          >
            <v-icon size="48">fi-rr-search</v-icon>
            <p>Enter a username, Instagram URL, or JSON to get started</p>
          </div>

          <div v-else class="ig-empty-state">
            <v-progress-circular indeterminate size="40" width="3" />
            <p>Loading…</p>
          </div>

          <preview-dialog
            :preview="preview"
            :result="result"
            :get-path="getPath"
            @update:is-show="preview.isShow = $event"
            @previous="previous"
            @next="next"
            @reset-zoom="resetZoom"
            @download="downloadCurrentPreview"
            @scroll="onScroll"
            @start-drag="startDrag"
            @drag="onDrag"
            @set-image-mode="preview.isVideo = false"
            @set-video-mode="preview.isVideo = true"
          />
        </div>
      </v-main>
    </v-app>
  `
};
