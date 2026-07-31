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
  getIgCookieHeaders
} from './utils/igCookie.js';
import { detectSearchInput } from './utils/detectSearchInput.js';

const THEME_STORAGE_KEY = 'parsergram-theme';

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
      highlightLoadDialog: {
        isShow: false,
        pendingUsername: ''
      },
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
      return this.result.length + '-' + (first?.item?.username || first?.username || '');
    },
    activeCookieLabel() {
      const active = this.cookieStore.profiles.find((p) => p.id === this.cookieStore.activeId);
      return active?.name || '';
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
      this.highlightLoadDialog.pendingUsername = username;
      this.highlightLoadDialog.isShow = true;
    },

    confirmProfileLoad(includeHighlight) {
      this.highlightLoadDialog.isShow = false;
      this.getInstagramProfile(includeHighlight);
    },

    async getInstagramProfile(includeHighlight = false) {
      const username = (this.highlightLoadDialog.pendingUsername || this.username || '')
        .trim()
        .replace(/^@/, '');
      if (!username) {
        this.usernameError = 'Instagram username is required';
        return;
      }

      this.username = username;
      this.searchQuery = username;
      this.usernameError = '';
      this.result = [];
      this.preview.isShow = false;
      this.preview.selected.index = 0;
      this.usernameLoading = true;

      try {
        const response = await fetch(
          getPath('/profile?username=') + encodeURIComponent(username)
          + '&include_highlight=' + (includeHighlight ? '1' : '0'),
          { headers: getIgCookieHeaders(this.cookieStore) }
        );
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        this.jsonString = JSON.stringify(data);
        this.searchHistory = saveSearchHistory(this.searchHistory, username);
      } catch (error) {
        console.error('Gagal mengambil data profile:', error);
        this.usernameError = error.message || 'Failed to fetch profile. Check the username or try again.';
      } finally {
        this.usernameLoading = false;
        this.highlightLoadDialog.pendingUsername = '';
      }
    },

    async getInstagramPostByUrl(urlOverride) {
      const url = (urlOverride || this.searchQuery || '').trim();
      if (!url) {
        this.usernameError = 'Instagram post URL is required';
        return;
      }
      if (!/instagram\.com\//i.test(url)) {
        this.usernameError = 'Use an Instagram URL (post, reel, or tv)';
        return;
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
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        this.jsonString = JSON.stringify(data);
      } catch (error) {
        console.error('Gagal mengambil post:', error);
        this.usernameError = error.message || 'Failed to fetch post. Check the URL or try again.';
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
            type="error"
            variant="tonal"
            class="mt-3 mb-2"
            closable
            @click:close="usernameError = ''"
          >
            {{ usernameError }}
          </v-alert>

          <v-chip
            v-if="activeCookieLabel"
            class="mt-3 ig-cookie-chip"
            size="small"
            variant="tonal"
            prepend-icon="fi-rr-key"
            @click="openCookieSettings"
          >
            Cookie: {{ activeCookieLabel }}
          </v-chip>

          <highlight-load-dialog
            :is-show="highlightLoadDialog.isShow"
            :pending-username="highlightLoadDialog.pendingUsername"
            @update:is-show="highlightLoadDialog.isShow = $event"
            @confirm="confirmProfileLoad"
          />

          <delete-history-dialog
            :is-show="deleteHistoryDialog.isShow"
            :pending-username="deleteHistoryDialog.pendingUsername"
            @update:is-show="deleteHistoryDialog.isShow = $event"
            @confirm="confirmDeleteHistory"
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
            v-if="result.length > 0"
            :key="resultPanelKey"
            :result="result"
            :get-path="getPath"
            :get-media-image-src="getMediaImageSrc"
            @preview="showPreview"
            @download="downloadMedia"
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
