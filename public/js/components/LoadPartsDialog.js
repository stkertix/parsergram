export const LoadPartsDialog = {
  props: {
    isShow: { type: Boolean, required: true },
    username: { type: String, default: '' },
    selectedParts: { type: Array, default: () => ['story', 'highlight', 'feed'] }
  },
  emits: ['update:isShow', 'update:selectedParts', 'confirm'],
  computed: {
    partsModel: {
      get() {
        return this.selectedParts;
      },
      set(value) {
        this.$emit('update:selectedParts', value);
      }
    },
    canLoad() {
      return this.partsModel.length > 0;
    }
  },
  methods: {
    togglePart(part) {
      const next = new Set(this.partsModel);
      if (next.has(part)) {
        next.delete(part);
      } else {
        next.add(part);
      }
      this.$emit('update:selectedParts', ['story', 'highlight', 'feed'].filter((key) => next.has(key)));
    },
    isSelected(part) {
      return this.partsModel.includes(part);
    },
    onConfirm() {
      if (!this.canLoad) {
        return;
      }
      this.$emit('confirm', [...this.partsModel]);
    }
  },
  template: `
    <v-dialog
      :model-value="isShow"
      @update:model-value="$emit('update:isShow', $event)"
      max-width="440"
      persistent
    >
      <v-card class="ig-dialog-card" rounded="xl">
        <v-card-title class="text-h6">Load for @{{ username }}</v-card-title>
        <v-card-text>
          <p class="ig-load-parts-hint mb-4">
            Choose what to fetch. Fewer parts means fewer Instagram requests.
          </p>
          <div class="ig-load-parts-chips" role="group" aria-label="Content to load">
            <v-chip
              filter
              :variant="isSelected('story') ? 'flat' : 'tonal'"
              :color="isSelected('story') ? 'primary' : undefined"
              prepend-icon="fi-rr-circle"
              @click="togglePart('story')"
            >
              Story
            </v-chip>
            <v-chip
              filter
              :variant="isSelected('highlight') ? 'flat' : 'tonal'"
              :color="isSelected('highlight') ? 'primary' : undefined"
              prepend-icon="fi-rr-star"
              @click="togglePart('highlight')"
            >
              Highlight
            </v-chip>
            <v-chip
              filter
              :variant="isSelected('feed') ? 'flat' : 'tonal'"
              :color="isSelected('feed') ? 'primary' : undefined"
              prepend-icon="fi-rr-apps"
              @click="togglePart('feed')"
            >
              Feed
            </v-chip>
          </div>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="tonal" @click="$emit('update:isShow', false)">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!canLoad"
            @click="onConfirm"
          >
            Load
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  `
};
