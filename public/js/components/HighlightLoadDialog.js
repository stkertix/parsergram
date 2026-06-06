export const HighlightLoadDialog = {
  props: {
    isShow: { type: Boolean, required: true },
    pendingUsername: { type: String, default: '' }
  },
  emits: ['update:isShow', 'confirm'],
  template: `
    <v-dialog :model-value="isShow" @update:model-value="$emit('update:isShow', $event)" max-width="480" persistent>
      <v-card rounded="xl">
        <v-card-title class="text-h6">Muat Highlight?</v-card-title>
        <v-card-text>
          Highlight bisa berisi banyak album dan media, sehingga loading lebih lama.
          Muat highlight juga untuk <strong>@{{ pendingUsername }}</strong>?
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="tonal" @click="$emit('confirm', false)">Lewati</v-btn>
          <v-btn color="primary" variant="flat" @click="$emit('confirm', true)">Muat Highlight</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  `
};
