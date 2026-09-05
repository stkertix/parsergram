import {
  resultProfileBlock as buildResultProfileBlock,
  resultFeedEntries,
  resultStoryEntries,
  resultHighlightGroups as buildResultHighlightGroups
} from '../utils/resultGroups.js';

const VIEW_MODE_STORAGE_KEY = 'parsergram-view-mode';

/**
 * Load saved result view mode (grid thumbnails or list).
 * @returns {'grid'|'list'}
 */
const loadViewMode = () => {
  try {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return saved === 'list' ? 'list' : 'grid';
  } catch (_error) {
    return 'grid';
  }
};

export const ResultPanel = {
  props: {
    result: { type: Array, required: true },
    highlightTray: { type: Array, default: () => [] },
    highlightLoadingIds: { type: Object, default: () => ({}) },
    getPath: { type: Function, required: true },
    getMediaImageSrc: { type: Function, required: true }
  },
  emits: ['preview', 'download', 'load-highlight'],
  data() {
    return {
      activeTab: 'story',
      activeHighlightId: '',
      activeHighlightTitle: '',
      viewMode: loadViewMode()
    };
  },
  computed: {
    profileBlock() {
      return buildResultProfileBlock(this.result);
    },
    profileEntry() {
      return this.profileBlock?.entries[0] || null;
    },
    feedEntries() {
      return resultFeedEntries(this.result);
    },
    storyEntries() {
      return resultStoryEntries(this.result);
    },
    highlightGroups() {
      return buildResultHighlightGroups(this.result);
    },
    highlightAlbums() {
      const loadedGroups = this.highlightGroups;
      if (this.highlightTray.length > 0) {
        return this.highlightTray.map((tray) => {
          const group = loadedGroups.find((g) =>
            g.entries.some((entry) => entry.item.highlight_id === tray.id)
            || g.title === tray.title
          );
          return {
            id: tray.id,
            title: tray.title,
            entries: group?.entries || [],
            loaded: Boolean(group && group.entries.length > 0)
          };
        });
      }
      return loadedGroups.map((group) => ({
        id: group.entries[0]?.item?.highlight_id || group.title,
        title: group.title,
        entries: group.entries,
        loaded: true
      }));
    },
    highlightAlbumCount() {
      return this.highlightAlbums.length;
    },
    highlightMediaCount() {
      return this.highlightGroups.reduce((sum, group) => sum + group.entries.length, 0);
    },
    availableTabs() {
      const tabs = [];
      if (this.storyEntries.length > 0) {
        tabs.push('story');
      }
      if (this.feedEntries.length > 0) {
        tabs.push('feed');
      }
      if (this.highlightAlbums.length > 0) {
        tabs.push('highlight');
      }
      return tabs;
    },
    activeHighlightAlbum() {
      if (!this.activeHighlightId || this.highlightAlbums.length === 0) {
        return null;
      }
      return this.highlightAlbums.find((album) => album.id === this.activeHighlightId) || null;
    },
    isActiveHighlightLoading() {
      const album = this.activeHighlightAlbum;
      return Boolean(album && this.highlightLoadingIds[album.id]);
    }
  },
  watch: {
    result: {
      handler() {
        this.resetTabs();
      },
      deep: true
    },
    highlightTray: {
      handler() {
        this.resetTabs();
      },
      deep: true
    }
  },
  mounted() {
    this.resetTabs();
  },
  methods: {
    resetTabs() {
      const tabs = this.availableTabs;
      if (!tabs.includes(this.activeTab)) {
        this.activeTab = tabs[0] || 'feed';
      }
      if (this.highlightAlbums.length > 0) {
        const activeStillExists = this.highlightAlbums.some((album) => album.id === this.activeHighlightId);
        if (!activeStillExists) {
          this.activeHighlightId = '';
          this.activeHighlightTitle = '';
        }
      } else {
        this.activeHighlightId = '';
        this.activeHighlightTitle = '';
      }
    },
    selectHighlight(album) {
      this.activeHighlightId = album.id;
      this.activeHighlightTitle = album.title;
      if (!album.loaded && !this.highlightLoadingIds[album.id]) {
        this.$emit('load-highlight', { id: album.id, title: album.title });
      }
    },
    highlightCoverSrc(album) {
      if (this.activeTab !== 'highlight') {
        return '';
      }
      const first = album.entries[0];
      return first ? this.getMediaImageSrc(first.item) : '';
    },
    shouldLoadGridImages(tabKey, groupTitle) {
      if (this.activeTab !== tabKey) {
        return false;
      }
      if (tabKey === 'highlight') {
        return groupTitle === this.activeHighlightTitle;
      }
      return true;
    },
    setViewMode(mode) {
      this.viewMode = mode === 'list' ? 'list' : 'grid';
      try {
        localStorage.setItem(VIEW_MODE_STORAGE_KEY, this.viewMode);
      } catch (_error) {
        // Ignore storage failures (private mode, quota, etc.)
      }
    },
    mediaContainerClass() {
      return this.viewMode === 'list' ? 'ig-list' : 'ig-grid';
    }
  },
  template: `
    <div v-if="result.length > 0 || highlightAlbums.length > 0">
      <profile-header
        :profile-entry="profileEntry"
        :feed-count="feedEntries.length"
        :story-count="storyEntries.length"
        :highlight-album-count="highlightAlbumCount"
        :highlight-media-count="highlightMediaCount"
        :get-path="getPath"
        :get-media-image-src="getMediaImageSrc"
      />

      <div v-if="availableTabs.length > 0" class="ig-result-toolbar">
        <v-tabs
          v-model="activeTab"
          class="ig-tab-bar"
          grow
          height="44"
        >
          <v-tab v-if="storyEntries.length > 0" value="story">
            <v-icon start size="small">fi-rr-circle</v-icon>
            Story
          </v-tab>
          <v-tab v-if="highlightAlbums.length > 0" value="highlight">
            <v-icon start size="small">fi-rr-star</v-icon>
            Highlight
          </v-tab>
          <v-tab v-if="feedEntries.length > 0" value="feed">
            <v-icon start size="small">fi-rr-apps</v-icon>
            Posts
          </v-tab>
        </v-tabs>

        <div class="ig-view-toggle" role="group" aria-label="Result view">
          <v-btn
            icon
            size="small"
            variant="text"
            :class="{ 'ig-view-toggle__btn--active': viewMode === 'grid' }"
            title="Thumbnail view"
            aria-label="Thumbnail view"
            @click="setViewMode('grid')"
          >
            <v-icon size="18">fi-rr-apps</v-icon>
          </v-btn>
          <v-btn
            icon
            size="small"
            variant="text"
            :class="{ 'ig-view-toggle__btn--active': viewMode === 'list' }"
            title="List view"
            aria-label="List view"
            @click="setViewMode('list')"
          >
            <v-icon size="18">fi-rr-list</v-icon>
          </v-btn>
        </div>
      </div>

      <v-window v-model="activeTab">
        <v-window-item value="feed">
          <div v-if="feedEntries.length > 0" :class="mediaContainerClass()">
            <media-entry-card
              v-for="{ item, index } in feedEntries"
              :key="'feed-' + index"
              :item="item"
              :index="index"
              :layout="viewMode"
              :load-images="shouldLoadGridImages('feed')"
              :get-path="getPath"
              :get-media-image-src="getMediaImageSrc"
              @preview="$emit('preview', $event)"
              @download="(url, filename) => $emit('download', url, filename)"
            />
          </div>
          <div v-else class="ig-section-empty">No posts.</div>
        </v-window-item>

        <v-window-item value="story">
          <div v-if="storyEntries.length > 0" :class="mediaContainerClass()">
            <media-entry-card
              v-for="{ item, index } in storyEntries"
              :key="'story-' + index"
              :item="item"
              :index="index"
              :layout="viewMode"
              :load-images="shouldLoadGridImages('story')"
              :get-path="getPath"
              :get-media-image-src="getMediaImageSrc"
              @preview="$emit('preview', $event)"
              @download="(url, filename) => $emit('download', url, filename)"
            />
          </div>
          <div v-else class="ig-section-empty">No stories.</div>
        </v-window-item>

        <v-window-item value="highlight">
          <div v-if="highlightAlbums.length > 0" class="ig-highlight-row">
            <button
              v-for="album in highlightAlbums"
              :key="album.id"
              type="button"
              class="ig-highlight-item"
              :class="{ 'ig-highlight-item--active': activeHighlightId === album.id }"
              @click="selectHighlight(album)"
            >
              <div class="ig-highlight-ring">
                <div
                  v-if="highlightLoadingIds[album.id]"
                  class="ig-highlight-ring__img d-flex align-center justify-center"
                >
                  <v-progress-circular size="20" width="2" indeterminate />
                </div>
                <img
                  v-else-if="highlightCoverSrc(album)"
                  :src="highlightCoverSrc(album)"
                  :alt="album.title"
                  class="ig-highlight-ring__img"
                />
                <div v-else class="ig-highlight-ring__img ig-highlight-ring__placeholder">
                  <v-icon size="22">fi-rr-star</v-icon>
                </div>
              </div>
              <span class="ig-highlight-label">{{ album.title }}</span>
            </button>
          </div>

          <div v-if="isActiveHighlightLoading" class="ig-section-empty ig-section-empty--loading">
            <v-progress-circular size="32" width="3" indeterminate />
            <p>Loading highlight album…</p>
          </div>
          <div
            v-else-if="activeHighlightAlbum && activeHighlightAlbum.loaded"
            :class="mediaContainerClass()"
          >
            <media-entry-card
              v-for="{ item, index } in activeHighlightAlbum.entries"
              :key="'highlight-' + activeHighlightAlbum.id + '-' + index"
              :item="item"
              :index="index"
              :layout="viewMode"
              :load-images="shouldLoadGridImages('highlight', activeHighlightTitle)"
              :get-path="getPath"
              :get-media-image-src="getMediaImageSrc"
              @preview="$emit('preview', $event)"
              @download="(url, filename) => $emit('download', url, filename)"
            />
          </div>
          <div v-else-if="highlightAlbums.length > 0" class="ig-section-empty">
            Tap a highlight album above to load its media.
          </div>
          <div v-else class="ig-section-empty">No highlights.</div>
        </v-window-item>
      </v-window>
    </div>
  `
};
