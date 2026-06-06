import { getPath } from './utils/path.js';
import { parserData } from './utils/parserData.js';
import {
  resultProfileBlock as buildResultProfileBlock,
  expandableSectionBlocks as buildExpandableSectionBlocks,
  resultHighlightGroups as buildResultHighlightGroups,
  getMediaCardLabel
} from './utils/resultGroups.js';
import {
  loadSearchHistory,
  saveSearchHistory,
  clearSearchHistory,
  buildAutocompleteItems
} from './utils/searchHistory.js';

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
      username: '',
      usernameLoading: false,
      postUrl: '',
      postUrlLoading: false,
      usernameError: '',
      searchHistory: [],
      mobileInputMode: 'username',
      expandedSections: [],
      expandedHighlightGroups: [],
      highlightLoadDialog: {
        isShow: false,
        pendingUsername: ''
      }
    };
  },

  computed: {
    inputModeLabel() {
      const labels = { username: 'Username', url: 'URL', json: 'JSON' };
      return labels[this.mobileInputMode] || 'Username';
    },
    resultProfileBlock() {
      return buildResultProfileBlock(this.result);
    },
    expandableSectionBlocks() {
      return buildExpandableSectionBlocks(this.result);
    },
    resultHighlightGroups() {
      return buildResultHighlightGroups(this.result);
    },
    searchHistoryAutocompleteItems() {
      return buildAutocompleteItems(this.searchHistory);
    }
  },

  watch: {
    jsonString(value) {
      if (!value || value.trim() === '') {
        this.result = [];
        this.preview.isShow = false;
        this.preview.selected.index = 0;
        this.resetExpansionPanels();
        return false;
      }

      let json = null;
      try {
        json = JSON.parse(value);
      } catch (_e) {
        this.usernameError = 'Format JSON tidak valid';
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
    getMediaCardLabel,

    getMediaImageSrc(item) {
      return getPath('/load?url=') + encodeURIComponent(item.image.url);
    },

    resetExpansionPanels() {
      this.expandedSections = [];
      this.expandedHighlightGroups = [];
    },

    isSectionExpanded(sectionKey) {
      return this.expandedSections.includes(sectionKey);
    },

    isHighlightGroupExpanded(groupTitle) {
      return this.expandedHighlightGroups.includes(groupTitle);
    },

    applyParserResult(parsedResult) {
      this.result = parsedResult;
      this.resetExpansionPanels();
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

    onUsernameAutocompleteUpdate(value) {
      if (value === '__clear_history__') {
        this.searchHistory = clearSearchHistory();
        this.username = '';
        return;
      }

      const normalized = this.normalizeUsernameValue(value);
      const norm = (s) => (s || '').trim().replace(/^@/, '').toLowerCase();
      const isExactHistoryPick = this.searchHistory.some(
        (item) => item === normalized || norm(item) === norm(normalized)
      );

      this.username = normalized;

      if (isExactHistoryPick && normalized && !this.usernameLoading) {
        this.promptProfileLoad();
      }
    },

    downloadMedia(mediaUrl, filename) {
      const params = [
        'url=' + encodeURIComponent(mediaUrl),
        'filename=' + filename
      ];
      window.open(getPath('/download?') + params.join('&'));
    },

    promptProfileLoad() {
      const username = (this.username || '').trim().replace(/^@/, '');
      if (!username) {
        this.usernameError = 'Username Instagram wajib diisi';
        return;
      }

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
        this.usernameError = 'Username Instagram wajib diisi';
        return;
      }

      this.username = username;
      this.usernameError = '';
      this.result = [];
      this.preview.isShow = false;
      this.preview.selected.index = 0;
      this.resetExpansionPanels();
      this.usernameLoading = true;

      try {
        const response = await fetch(
          getPath('/profile?username=') + encodeURIComponent(username)
          + '&include_highlight=' + (includeHighlight ? '1' : '0')
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        this.jsonString = JSON.stringify(data);
        this.searchHistory = saveSearchHistory(this.searchHistory, username);
      } catch (error) {
        console.error('Gagal mengambil data profile:', error);
        this.usernameError = 'Gagal mengambil data profile. Cek username atau coba lagi.';
      } finally {
        this.usernameLoading = false;
        this.highlightLoadDialog.pendingUsername = '';
      }
    },

    async getInstagramPostByUrl() {
      const url = (this.postUrl || '').trim();
      if (!url) {
        this.usernameError = 'URL post Instagram wajib diisi';
        return;
      }
      if (!/instagram\.com\//i.test(url)) {
        this.usernameError = 'Gunakan URL Instagram (post / reel / tv)';
        return;
      }

      this.usernameError = '';
      this.result = [];
      this.preview.isShow = false;
      this.preview.selected.index = 0;
      this.resetExpansionPanels();
      this.postUrlLoading = true;

      try {
        const response = await fetch(getPath('/post?url=') + encodeURIComponent(url));
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        this.jsonString = JSON.stringify(data);
      } catch (error) {
        console.error('Gagal mengambil post:', error);
        this.usernameError = error.message || 'Gagal mengambil post. Cek URL atau coba lagi.';
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
      this.resetExpansionPanels();
    }
  },

  mounted() {
    this.searchHistory = loadSearchHistory();
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKey);
  },

  template: `
    <v-app>
      <app-bar-inputs
        v-model:username="username"
        v-model:post-url="postUrl"
        v-model:json-string="jsonString"
        v-model:mobile-input-mode="mobileInputMode"
        :username-loading="usernameLoading"
        :post-url-loading="postUrlLoading"
        :search-history-autocomplete-items="searchHistoryAutocompleteItems"
        :input-mode-label="inputModeLabel"
        @username-autocomplete-update="onUsernameAutocompleteUpdate"
        @prompt-profile="promptProfileLoad"
        @fetch-post="getInstagramPostByUrl"
        @reset-data="resetData"
      />

      <v-main>
        <v-container>
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

          <highlight-load-dialog
            :is-show="highlightLoadDialog.isShow"
            :pending-username="highlightLoadDialog.pendingUsername"
            @update:is-show="highlightLoadDialog.isShow = $event"
            @confirm="confirmProfileLoad"
          />

          <result-panel
            :result="result"
            :result-profile-block="resultProfileBlock"
            :expandable-section-blocks="expandableSectionBlocks"
            :result-highlight-groups="resultHighlightGroups"
            v-model:expanded-sections="expandedSections"
            v-model:expanded-highlight-groups="expandedHighlightGroups"
            :get-path="getPath"
            :get-media-image-src="getMediaImageSrc"
            :get-media-card-label="getMediaCardLabel"
            :is-section-expanded="isSectionExpanded"
            :is-highlight-group-expanded="isHighlightGroupExpanded"
            @preview="showPreview"
            @download="downloadMedia"
          />

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
        </v-container>
      </v-main>
    </v-app>
  `
};
