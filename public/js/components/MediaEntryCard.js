export const MediaEntryCard = {
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    loadImages: { type: Boolean, default: false },
    label: { type: String, default: 'feed' },
    cols: { type: [String, Number], default: 6 },
    md: { type: [String, Number], default: undefined },
    xl: { type: [String, Number], default: undefined },
    getPath: { type: Function, required: true },
    getMediaImageSrc: { type: Function, required: true }
  },
  emits: ['preview', 'download'],
  computed: {
    imageSrc() {
      return this.loadImages ? this.getMediaImageSrc(this.item) : undefined;
    }
  },
  template: `
    <v-col :cols="cols" :md="md" :xl="xl">
      <v-card class="mb-3" rounded="xl" @click="$emit('preview', index)">
        <v-img cover :src="imageSrc">
          <div class="fill-height bg-gradient"></div>
          <div class="position-absolute top-0 left-0 ps-3 pt-2 text-white text-shadow text-left">
            <p class="text-h6 font-weight-bold mb-0">{{ item.username }}</p>
            <small>{{ item.filename }}</small>
            <div class="text-caption mt-1 opacity-90">{{ label }}</div>
          </div>
          <div class="position-absolute top-0 right-0 pe-3 pt-2 text-white text-shadow text-left">
            <p class="text-h6 font-weight-bold mb-0">{{ index + 1 }}</p>
          </div>
          <div class="position-absolute bottom-0 right-0 pe-2 pb-2 text-white text-shadow text-left d-flex flex-column">
            <v-btn
              v-if="item.video"
              icon
              size="large"
              target="_blank"
              variant="text"
              :href="item.video.url"
              :text="item.video.height"
            >
              <v-icon class="text-shadow" color="red">fi-rr-play-alt</v-icon>
              <v-tooltip activator="parent" location="start">
                {{ item.video.width + " x " + item.video.height }}
              </v-tooltip>
            </v-btn>
            <v-btn variant="plain" icon @click.stop="$emit('preview', index)">
              <v-icon class="text-shadow">fi-rr-eye</v-icon>
              <v-tooltip activator="parent" location="start">
                {{ item.image.width + " x " + item.image.height }}
              </v-tooltip>
            </v-btn>
            <v-btn variant="plain" icon @click.stop="$emit('download', item.image.url, item.filename)">
              <v-icon class="text-shadow">fi-rr-download</v-icon>
              <v-tooltip activator="parent" location="start">Download</v-tooltip>
            </v-btn>
          </div>
          <template #placeholder>
            <div class="d-flex align-center justify-center fill-height">
              <v-progress-circular color="primary" indeterminate></v-progress-circular>
            </div>
          </template>
        </v-img>
      </v-card>
    </v-col>
  `
};
