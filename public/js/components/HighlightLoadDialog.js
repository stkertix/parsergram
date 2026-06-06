export const HighlightLoadDialog = {
  props: {
    isShow: { type: Boolean, required: true },
    pendingUsername: { type: String, default: '' }
  },
  emits: ['update:isShow', 'confirm'],
  template: `
    <v-dialog :model-value="isShow" @update:model-value="$emit('update:isShow', $event)" max-width="480" persistent>
      <v-card class="ig-dialog-card" rounded="xl">
        <v-card-title class="text-h6">Load Highlights?</v-card-title>
        <v-card-text>
          Highlights can contain many albums and media, which takes longer to load.
          Also load highlights for <strong>@{{ pendingUsername }}</strong>?
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="tonal" @click="$emit('confirm', false)">Skip</v-btn>
          <v-btn color="primary" variant="flat" @click="$emit('confirm', true)">Load Highlights</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  `
};
