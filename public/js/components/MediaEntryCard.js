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
    }
  },
  template: `
    <div class="ig-grid-tile" @click="$emit('preview', index)">
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
    </div>
  `
};
