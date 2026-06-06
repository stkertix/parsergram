export const ResultPanel = {
  props: {
    result: { type: Array, required: true },
    resultProfileBlock: { type: Object, default: null },
    expandableSectionBlocks: { type: Array, required: true },
    resultHighlightGroups: { type: Array, required: true },
    expandedSections: { type: Array, required: true },
    expandedHighlightGroups: { type: Array, required: true },
    getPath: { type: Function, required: true },
    getMediaImageSrc: { type: Function, required: true },
    getMediaCardLabel: { type: Function, required: true },
    isSectionExpanded: { type: Function, required: true },
    isHighlightGroupExpanded: { type: Function, required: true }
  },
  emits: ['update:expandedSections', 'update:expandedHighlightGroups', 'preview', 'download'],
  computed: {
    localExpandedSections: {
      get() {
        return this.expandedSections;
      },
      set(value) {
        this.$emit('update:expandedSections', value);
      }
    },
    localExpandedHighlightGroups: {
      get() {
        return this.expandedHighlightGroups;
      },
      set(value) {
        this.$emit('update:expandedHighlightGroups', value);
      }
    }
  },
  template: `
    <v-card v-if="result.length > 0" class="mb-5" rounded="xl" variant="flat">
      <v-container>
        <h1 class="text-h4 mb-6">Result: {{ result.length }}</h1>

        <template v-if="resultProfileBlock">
          <h2 class="text-h5 font-weight-medium mb-3">{{ resultProfileBlock.title }}</h2>
          <v-row class="mb-8">
            <media-entry-card
              v-for="{ item, index } in resultProfileBlock.entries"
              :key="'profile-' + index"
              :item="item"
              :index="index"
              :load-images="true"
              :label="getMediaCardLabel(item)"
              :cols="6"
              :md="4"
              :xl="2"
              :get-path="getPath"
              :get-media-image-src="getMediaImageSrc"
              @preview="$emit('preview', $event)"
              @download="(url, filename) => $emit('download', url, filename)"
            />
          </v-row>
        </template>

        <v-expansion-panels
          v-if="expandableSectionBlocks.length > 0"
          v-model="localExpandedSections"
          multiple
          variant="accordion"
          class="mb-4"
        >
          <v-expansion-panel
            v-for="block in expandableSectionBlocks"
            :key="block.key"
            :value="block.key"
          >
            <v-expansion-panel-title>
              {{ block.title }} ({{ block.entries.length }})
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <template v-if="block.key === 'highlight'">
                <v-expansion-panels
                  v-model="localExpandedHighlightGroups"
                  multiple
                  variant="accordion"
                  class="mt-2"
                >
                  <v-expansion-panel
                    v-for="group in resultHighlightGroups"
                    :key="block.key + '-' + group.title"
                    :value="group.title"
                  >
                    <v-expansion-panel-title>
                      {{ group.title }} ({{ group.entries.length }})
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-row>
                        <media-entry-card
                          v-for="{ item, index } in group.entries"
                          :key="block.key + '-' + group.title + '-' + index"
                          :item="item"
                          :index="index"
                          :load-images="isSectionExpanded('highlight') && isHighlightGroupExpanded(group.title)"
                          :label="getMediaCardLabel(item)"
                          :cols="2"
                          :get-path="getPath"
                          :get-media-image-src="getMediaImageSrc"
                          @preview="$emit('preview', $event)"
                          @download="(url, filename) => $emit('download', url, filename)"
                        />
                      </v-row>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </template>

              <v-row v-else>
                <media-entry-card
                  v-for="{ item, index } in block.entries"
                  :key="block.key + '-' + index"
                  :item="item"
                  :index="index"
                  :load-images="isSectionExpanded(block.key)"
                  :label="getMediaCardLabel(item)"
                  :cols="6"
                  :md="4"
                  :xl="2"
                  :get-path="getPath"
                  :get-media-image-src="getMediaImageSrc"
                  @preview="$emit('preview', $event)"
                  @download="(url, filename) => $emit('download', url, filename)"
                />
              </v-row>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-container>
    </v-card>
  `
};
