export const PreviewDialog = {
  props: {
    preview: { type: Object, required: true },
    result: { type: Array, required: true },
    getPath: { type: Function, required: true }
  },
  emits: [
    'update:isShow',
    'previous',
    'next',
    'reset-zoom',
    'download',
    'scroll',
    'start-drag',
    'drag',
    'set-image-mode',
    'set-video-mode'
  ],
  computed: {
    currentItem() {
      return this.result[this.preview.selected.index] || null;
    },
    displayIndex() {
      return this.preview.selected.index + 1;
    },
    totalCount() {
      return this.result.length;
    },
    activeDimensions() {
      if (!this.currentItem) {
        return '';
      }
      const source = this.preview.isVideo && this.currentItem.video
        ? this.currentItem.video
        : this.currentItem.image;
      if (!source?.width || !source?.height) {
        return '';
      }
      return source.width + ' × ' + source.height;
    }
  },
  template: `
    <v-dialog
      class="ig-preview-dialog"
      :model-value="preview.isShow"
      @update:model-value="$emit('update:isShow', $event)"
      fullscreen
      transition="fade-transition"
      scroll-strategy="none"
      :retain-focus="false"
    >
      <v-card class="ig-preview-card fill-height d-flex flex-column" rounded="0">
        <v-toolbar flat color="transparent" class="ig-preview-toolbar">
          <v-btn icon variant="text" @click="$emit('update:isShow', false)">
            <v-icon color="white">fi-rr-cross-small</v-icon>
          </v-btn>
          <v-toolbar-title class="text-white" style="min-width: 0;">
            <div class="text-body-2 text-truncate">{{ currentItem?.filename || '' }}</div>
            <div v-if="currentItem" class="ig-preview-meta text-truncate">
              #{{ displayIndex }} / {{ totalCount }} · {{ activeDimensions }}
            </div>
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon variant="text" @click="$emit('download')">
            <v-icon color="white">fi-rr-download</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text
          class="flex-grow-1 d-flex justify-center align-center pa-0"
          :class="{ 'preview-card-text--video': preview.isVideo }"
          :style="preview.isVideo ? {} : { overflow: 'hidden' }"
          @wheel.prevent="$emit('scroll', $event)"
          @click="$emit('start-drag', $event)"
          @mousemove="$emit('drag', $event)"
        >
          <div
            class="zoom-container"
            :style="{
              transform: 'translate(' + preview.pos.x + 'px, ' + preview.pos.y + 'px) scale(' + preview.zoom + ')',
              cursor: preview.isDragging ? 'grabbing' : preview.zoom > 1 ? 'grab' : 'default'
            }"
          >
            <v-img
              v-if="!preview.isVideo && currentItem"
              :src="getPath('/load?url=') + encodeURIComponent(currentItem.image.url)"
              contain
              width="auto"
              max-width="100%"
              max-height="calc(100vh - 120px)"
              rounded="0"
            >
              <template #placeholder>
                <div class="d-flex align-center justify-center fill-height">
                  <v-progress-circular color="white" indeterminate />
                </div>
              </template>
            </v-img>

            <video
              v-if="preview.isVideo && currentItem && currentItem.video"
              class="preview-dialog-video"
              controls
              playsinline
            >
              <source :src="getPath('/load?url=') + encodeURIComponent(currentItem.video.url)" type="video/mp4">
              Your browser does not support HTML video.
            </video>
          </div>
        </v-card-text>

        <v-card-actions
          v-if="currentItem"
          class="ig-preview-toolbar justify-center py-3"
        >
          <v-btn icon variant="text" @click="$emit('previous')" :disabled="preview.selected.index === 0">
            <v-icon color="white">fi-rr-arrow-small-left</v-icon>
          </v-btn>

          <v-btn icon variant="text" @click="$emit('set-image-mode')">
            <v-icon color="white">fi-rr-picture</v-icon>
          </v-btn>

          <v-btn
            v-if="currentItem.video !== undefined"
            icon
            variant="text"
            @click="$emit('set-video-mode')"
          >
            <v-icon color="white">fi-rr-play-alt</v-icon>
          </v-btn>

          <v-btn icon variant="text" @click="$emit('reset-zoom')">
            <v-icon color="white">fi-rr-refresh</v-icon>
          </v-btn>

          <v-btn
            icon
            variant="text"
            @click="$emit('next')"
            :disabled="preview.selected.index + 1 === result.length"
          >
            <v-icon color="white">fi-rr-arrow-small-right</v-icon>
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  `
};
