export const MediaEntryCard = {
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    loadImages: { type: Boolean, default: false },
    layout: { type: String, default: 'grid' },
    getPath: { type: Function, required: true },
    getMediaImageSrc: { type: Function, required: true }
  },
  emits: ['preview', 'download'],
  computed: {
    imageSrc() {
      return this.loadImages ? this.getMediaImageSrc(this.item) : '';
    },
    displayIndex() {
      return this.index + 1;
    },
    isList() {
      return this.layout === 'list';
    },
    mediaLabel() {
      if (this.item.video) {
        return 'Video';
      }
      return 'Photo';
    },
    sizeLabel() {
      const width = this.item.image?.width || this.item.video?.width;
      const height = this.item.image?.height || this.item.video?.height;
      if (!width || !height) {
        return '';
      }
      return `${width}×${height}`;
    }
  },
  template: `
    <div
      :class="isList ? 'ig-list-row' : 'ig-grid-tile'"
      @click="$emit('preview', index)"
    >
      <template v-if="isList">
        <span class="ig-list-row__index">{{ displayIndex }}</span>
        <div class="ig-list-row__thumb">
          <img
            v-if="imageSrc"
            :src="imageSrc"
            :alt="item.filename"
            class="ig-list-row__img"
            loading="lazy"
          />
          <div v-else class="ig-list-row__placeholder">
            <v-progress-circular size="18" width="2" indeterminate />
          </div>
          <v-icon v-if="item.video" class="ig-list-row__play" size="14">fi-rr-play-alt</v-icon>
        </div>
        <div class="ig-list-row__meta">
          <div class="ig-list-row__filename text-truncate">{{ item.filename }}</div>
          <div class="ig-list-row__sub text-truncate">
            <span>{{ mediaLabel }}</span>
            <span v-if="item.taken_at"> · {{ item.taken_at }}</span>
            <span v-if="sizeLabel"> · {{ sizeLabel }}</span>
          </div>
        </div>
        <div class="ig-list-row__actions" @click.stop>
          <v-btn
            icon
            size="small"
            variant="text"
            @click="$emit('download', item.image.url, item.filename)"
          >
            <v-icon size="18">fi-rr-download</v-icon>
          </v-btn>
        </div>
      </template>

      <template v-else>
        <span class="ig-grid-tile__index">{{ displayIndex }}</span>
        <div class="ig-grid-tile__media-badges">
          <v-icon size="12">fi-rr-picture</v-icon>
          <v-icon v-if="item.video" size="12">fi-rr-play-alt</v-icon>
        </div>
        <img
          v-if="imageSrc"
          :src="imageSrc"
          :alt="item.filename"
          class="ig-grid-tile__img"
          loading="lazy"
        />
        <div v-else class="ig-grid-tile__placeholder">
          <v-progress-circular size="24" width="2" indeterminate />
        </div>
        <div class="ig-grid-tile__overlay">
          <v-icon v-if="item.video" size="28">fi-rr-play-alt</v-icon>
          <v-btn
            icon
            size="small"
            variant="text"
            @click.stop="$emit('download', item.image.url, item.filename)"
          >
            <v-icon size="20">fi-rr-download</v-icon>
          </v-btn>
        </div>
      </template>
    </div>
  `
};
