import {
  resultProfileBlock as buildResultProfileBlock,
  resultFeedEntries,
  resultStoryEntries,
  resultHighlightGroups as buildResultHighlightGroups
} from '../utils/resultGroups.js';

export const ResultPanel = {
  props: {
    result: { type: Array, required: true },
    getPath: { type: Function, required: true },
    getMediaImageSrc: { type: Function, required: true }
  },
  emits: ['preview', 'download'],
  data() {
    return {
      activeTab: 'feed',
      activeHighlightTitle: ''
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
    highlightCount() {
      return this.highlightGroups.reduce((sum, group) => sum + group.entries.length, 0);
    },
    availableTabs() {
      const tabs = [];
      if (this.feedEntries.length > 0) {
        tabs.push('feed');
      }
      if (this.storyEntries.length > 0) {
        tabs.push('story');
      }
      if (this.highlightGroups.length > 0) {
        tabs.push('highlight');
      }
      return tabs;
    },
    activeHighlightGroup() {
      if (this.highlightGroups.length === 0) {
        return null;
      }
      return this.highlightGroups.find((g) => g.title === this.activeHighlightTitle)
        || this.highlightGroups[0];
    }
  },
  watch: {
    result: {
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
      if (this.highlightGroups.length > 0) {
        this.activeHighlightTitle = this.highlightGroups[0].title;
      } else {
        this.activeHighlightTitle = '';
      }
    },
    selectHighlight(title) {
      this.activeHighlightTitle = title;
    },
    highlightCoverSrc(group) {
      if (this.activeTab !== 'highlight') {
        return '';
      }
      const first = group.entries[0];
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
    }
  },
  template: `
    <div v-if="result.length > 0">
      <profile-header
        :profile-entry="profileEntry"
        :feed-count="feedEntries.length"
        :story-count="storyEntries.length"
        :highlight-count="highlightCount"
        :get-path="getPath"
        :get-media-image-src="getMediaImageSrc"
      />

      <v-tabs
        v-if="availableTabs.length > 0"
        v-model="activeTab"
        class="ig-tab-bar"
        grow
        height="44"
      >
        <v-tab v-if="storyEntries.length > 0" value="story">
          <v-icon start size="small">fi-rr-circle</v-icon>
          Story
        </v-tab>
        <v-tab v-if="highlightGroups.length > 0" value="highlight">
          <v-icon start size="small">fi-rr-star</v-icon>
          Highlight
        </v-tab>
        <v-tab v-if="feedEntries.length > 0" value="feed">
          <v-icon start size="small">fi-rr-apps</v-icon>
          Posts
        </v-tab>
      </v-tabs>

      <v-window v-model="activeTab">
        <v-window-item value="feed">
          <div v-if="feedEntries.length > 0" class="ig-grid">
            <media-entry-card
              v-for="{ item, index } in feedEntries"
              :key="'feed-' + index"
              :item="item"
              :index="index"
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
          <div v-if="storyEntries.length > 0" class="ig-grid">
            <media-entry-card
              v-for="{ item, index } in storyEntries"
              :key="'story-' + index"
              :item="item"
              :index="index"
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
          <div v-if="highlightGroups.length > 0" class="ig-highlight-row">
            <button
              v-for="group in highlightGroups"
              :key="group.title"
              type="button"
              class="ig-highlight-item"
              :class="{ 'ig-highlight-item--active': activeHighlightTitle === group.title }"
              @click="selectHighlight(group.title)"
            >
              <div class="ig-highlight-ring">
                <img
                  v-if="highlightCoverSrc(group)"
                  :src="highlightCoverSrc(group)"
                  :alt="group.title"
                  class="ig-highlight-ring__img"
                />
                <div v-else class="ig-highlight-ring__img d-flex align-center justify-center">
                  <v-progress-circular size="20" width="2" indeterminate />
                </div>
              </div>
              <span class="ig-highlight-label">{{ group.title }}</span>
            </button>
          </div>

          <div v-if="activeHighlightGroup" class="ig-grid">
            <media-entry-card
              v-for="{ item, index } in activeHighlightGroup.entries"
              :key="'highlight-' + activeHighlightGroup.title + '-' + index"
              :item="item"
              :index="index"
              :load-images="shouldLoadGridImages('highlight', activeHighlightTitle)"
              :get-path="getPath"
              :get-media-image-src="getMediaImageSrc"
              @preview="$emit('preview', $event)"
              @download="(url, filename) => $emit('download', url, filename)"
            />
          </div>
          <div v-else class="ig-section-empty">No highlights.</div>
        </v-window-item>
      </v-window>
    </div>
  `
};
