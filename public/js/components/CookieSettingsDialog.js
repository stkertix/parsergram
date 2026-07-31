export const CookieSettingsDialog = {
  props: {
    isShow: { type: Boolean, default: false },
    profiles: { type: Array, default: () => [] },
    activeId: { type: String, default: '' }
  },
  emits: ['update:isShow', 'select', 'save', 'remove'],
  data() {
    return {
      draftName: '',
      draftValue: '',
      editingId: ''
    };
  },
  computed: {
    selectItems() {
      return this.profiles.map((p) => ({
        title: p.name,
        value: p.id
      }));
    },
    canSave() {
      return Boolean((this.draftValue || '').trim());
    },
    dialogTitle() {
      return this.editingId ? 'Edit IG Cookie' : 'IG Cookie';
    }
  },
  watch: {
    isShow(open) {
      if (!open) {
        this.resetDraft();
      }
    }
  },
  methods: {
    resetDraft() {
      this.draftName = '';
      this.draftValue = '';
      this.editingId = '';
    },
    startEdit(profile) {
      this.editingId = profile.id;
      this.draftName = profile.name;
      this.draftValue = profile.value;
    },
    submitSave() {
      if (!this.canSave) {
        return;
      }
      this.$emit('save', {
        id: this.editingId || undefined,
        name: (this.draftName || '').trim() || this.suggestName(),
        value: this.draftValue.trim()
      });
      this.resetDraft();
    },
    suggestName() {
      const match = this.draftValue.match(/(?:^|;\s*)ds_user_id=([^;]+)/i);
      if (match?.[1]) {
        return `user ${match[1]}`;
      }
      return `Cookie ${(this.profiles.length || 0) + 1}`;
    },
    onSelect(id) {
      if (id) {
        this.$emit('select', id);
      }
    }
  },
  template: `
    <v-dialog
      :model-value="isShow"
      max-width="560"
      @update:model-value="$emit('update:isShow', $event)"
    >
      <v-card class="ig-dialog-card" rounded="xl">
        <v-card-title class="text-h6">{{ dialogTitle }}</v-card-title>
        <v-card-text class="d-flex flex-column ga-4">
          <p class="text-body-2 text-medium-emphasis mb-0">
            Save multiple Instagram cookies in this browser and switch accounts without editing .env.
            The active cookie is sent as <code>X-IG-Cookie</code>.
            If none is selected, the server falls back to <code>IG_COOKIE</code> from .env.
          </p>

          <v-select
            v-if="profiles.length"
            :model-value="activeId"
            :items="selectItems"
            label="Active cookie"
            density="compact"
            variant="outlined"
            rounded="lg"
            hide-details
            @update:model-value="onSelect"
          />

          <v-list
            v-if="profiles.length"
            density="compact"
            class="ig-cookie-list"
            rounded="lg"
          >
            <v-list-item
              v-for="profile in profiles"
              :key="profile.id"
              :active="profile.id === activeId"
              @click="onSelect(profile.id)"
            >
              <v-list-item-title>{{ profile.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ profile.value.slice(0, 48) }}{{ profile.value.length > 48 ? '…' : '' }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  @click.stop="startEdit(profile)"
                >
                  <v-icon size="small">fi-rr-pencil</v-icon>
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  @click.stop="$emit('remove', profile.id)"
                >
                  <v-icon size="small">fi-rr-trash</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>

          <v-text-field
            v-model="draftName"
            density="compact"
            rounded="lg"
            variant="outlined"
            label="Name (optional)"
            placeholder="Main account"
            hide-details
          />
          <v-textarea
            v-model="draftValue"
            density="compact"
            rounded="lg"
            variant="outlined"
            label="Cookie string"
            placeholder="sessionid=…; csrftoken=…; ds_user_id=…"
            rows="4"
            auto-grow
            hide-details
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-btn
            v-if="editingId"
            variant="text"
            @click="resetDraft"
          >
            Cancel edit
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="$emit('update:isShow', false)">Close</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!canSave"
            @click="submitSave"
          >
            {{ editingId ? 'Update' : 'Save' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  `
};
