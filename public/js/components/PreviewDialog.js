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
    }
  },
  template: `
    <v-dialog
      :model-value="preview.isShow"
      @update:model-value="$emit('update:isShow', $event)"
      max-width="90%"
      scroll-strategy="none"
      :retain-focus="false"
    >
      <v-card class="pa-2" color="black" rounded="xl">
        <v-card-text
          class="d-flex justify-center align-center rounded-xl"
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
              max-height="80vh"
              rounded="lg"
            >
              <template #placeholder>
                <div class="d-flex align-center justify-center fill-height">
                  <v-progress-circular color="primary" indeterminate></v-progress-circular>
                </div>
              </template>
            </v-img>

            <video v-if="preview.isVideo && currentItem && currentItem.video" class="preview-dialog-video rounded-lg" controls playsinline>
              <source :src="getPath('/load?url=') + encodeURIComponent(currentItem.video.url)" type="video/mp4">
              Your browser does not support HTML video.
            </video>
          </div>

          <v-divider class="mx-5" vertical></v-divider>
        </v-card-text>

        <v-card-actions class="justify-center" v-if="currentItem">
          <div class="d-flex flex-column">
            <div class="d-flex flex-column justify-center align-center">
              <span>{{ currentItem.filename }}</span>
              <span class="text-caption text-grey-lighten-1">
                media_kind: {{ currentItem.media_kind || 'feed' }}
              </span>
              <span class="text-caption">
                {{
                  preview.isVideo && currentItem.video
                    ? currentItem.video.width + ' x ' + currentItem.video.height
                    : currentItem.image.width + ' x ' + currentItem.image.height
                }}
              </span>
            </div>
            <div class="d-flex">
              <v-btn icon @click="$emit('previous')" :disabled="preview.selected.index == 0">
                <v-icon color="white">fi-rr-arrow-small-left</v-icon>
              </v-btn>

              <v-btn icon @click="$emit('next')" :disabled="preview.selected.index + 1 == result.length">
                <v-icon color="white">fi-rr-arrow-small-right</v-icon>
              </v-btn>

              <v-btn color="info" icon @click="$emit('set-image-mode')">
                <v-icon color="info">fi-rr-picture</v-icon>
              </v-btn>

              <v-btn v-if="currentItem.video !== undefined" color="red" icon @click="$emit('set-video-mode')">
                <v-icon color="red">fi-rr-play-alt</v-icon>
              </v-btn>

              <v-btn icon @click="$emit('download')">
                <v-icon color="white">fi-rr-download</v-icon>
              </v-btn>

              <v-btn icon @click="$emit('reset-zoom')">
                <v-icon color="white">fi-rr-refresh</v-icon>
              </v-btn>

              <v-btn icon @click="$emit('update:isShow', false)">
                <v-icon color="white">fi-rr-cross-small</v-icon>
              </v-btn>
            </div>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>
  `
};
