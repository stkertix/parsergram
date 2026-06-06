export const DeleteHistoryDialog = {
  props: {
    isShow: { type: Boolean, required: true },
    pendingUsername: { type: String, default: '' }
  },
  emits: ['update:isShow', 'confirm'],
  template: `
    <v-dialog :model-value="isShow" @update:model-value="$emit('update:isShow', $event)" max-width="480" persistent>
      <v-card class="ig-dialog-card" rounded="xl">
        <v-card-title class="text-h6">Remove from history?</v-card-title>
        <v-card-text>
          Remove <strong>@{{ pendingUsername }}</strong> from search history?
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="tonal" @click="$emit('confirm', false)">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="$emit('confirm', true)">Remove</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  `
};
