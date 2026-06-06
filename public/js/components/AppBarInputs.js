export const AppBarInputs = {
  props: {
    username: { type: String, default: '' },
    postUrl: { type: String, default: '' },
    jsonString: { type: String, default: '' },
    usernameLoading: { type: Boolean, default: false },
    postUrlLoading: { type: Boolean, default: false },
    searchHistoryAutocompleteItems: { type: Array, default: () => [] },
    mobileInputMode: { type: String, default: 'username' },
    inputModeLabel: { type: String, default: 'Username' },
    isDarkMode: { type: Boolean, default: false }
  },
  emits: [
    'update:username',
    'update:postUrl',
    'update:jsonString',
    'update:mobileInputMode',
    'username-autocomplete-update',
    'prompt-profile',
    'fetch-post',
    'reset-data',
    'toggle-theme',
    'request-delete-history'
  ],
  data() {
    return {
      showToolsDialog: false
    };
  },
  template: `
    <v-app-bar flat class="ig-app-bar" height="60">
      <div class="ig-header-inner">
        <span class="ig-logo">ParserGram</span>

        <template v-if="$vuetify.display.mdAndUp">
          <v-combobox
            class="ig-search-pill"
            autocomplete="off"
            :model-value="username"
            @update:model-value="$emit('update:username', $event); $emit('username-autocomplete-update', $event)"
            :items="searchHistoryAutocompleteItems"
            item-title="title"
            item-value="value"
            :auto-select-first="false"
            clearable
            hide-no-data
            hide-details
            density="compact"
            rounded="pill"
            variant="solo-filled"
            placeholder="Search"
            :loading="usernameLoading"
            :disabled="usernameLoading || postUrlLoading"
            @keyup.enter="$emit('prompt-profile')"
          >
            <template #prepend-inner>
              <v-icon size="small" color="grey">fi-rr-search</v-icon>
            </template>
            <template #item="{ props, item }">
              <v-list-subheader v-if="item.raw.type === 'subheader'">
                {{ item.raw.title }}
              </v-list-subheader>
              <v-divider v-else-if="item.raw.type === 'divider'" />
              <v-list-item v-else v-bind="props">
                <template
                  v-if="item.raw.value && item.raw.value !== '__clear_history__'"
                  #append
                >
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    @click.stop="$emit('request-delete-history', item.raw.value)"
                  >
                    <v-icon size="small">fi-rr-trash</v-icon>
                  </v-btn>
                </template>
              </v-list-item>
            </template>
          </v-combobox>
        </template>

        <template v-else>
          <v-combobox
            v-if="mobileInputMode === 'username'"
            class="ig-search-pill"
            autocomplete="off"
            :model-value="username"
            @update:model-value="$emit('update:username', $event); $emit('username-autocomplete-update', $event)"
            :items="searchHistoryAutocompleteItems"
            item-title="title"
            item-value="value"
            :auto-select-first="false"
            clearable
            hide-no-data
            hide-details
            density="compact"
            rounded="pill"
            variant="solo-filled"
            placeholder="Search"
            :loading="usernameLoading"
            :disabled="usernameLoading || postUrlLoading"
            @keyup.enter="$emit('prompt-profile')"
          >
            <template #prepend-inner>
              <v-icon size="small" color="grey">fi-rr-search</v-icon>
            </template>
            <template #item="{ props, item }">
              <v-list-subheader v-if="item.raw.type === 'subheader'">
                {{ item.raw.title }}
              </v-list-subheader>
              <v-divider v-else-if="item.raw.type === 'divider'" />
              <v-list-item v-else v-bind="props">
                <template
                  v-if="item.raw.value && item.raw.value !== '__clear_history__'"
                  #append
                >
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    @click.stop="$emit('request-delete-history', item.raw.value)"
                  >
                    <v-icon size="small">fi-rr-trash</v-icon>
                  </v-btn>
                </template>
              </v-list-item>
            </template>
          </v-combobox>
          <v-text-field
            v-else-if="mobileInputMode === 'url'"
            class="ig-search-pill"
            density="compact"
            rounded="pill"
            variant="solo-filled"
            hide-details
            :model-value="postUrl"
            @update:model-value="$emit('update:postUrl', $event)"
            placeholder="Post URL"
            :loading="postUrlLoading"
            :disabled="postUrlLoading || usernameLoading"
            @keyup.enter="$emit('fetch-post')"
          />
          <v-text-field
            v-else
            class="ig-search-pill"
            density="compact"
            rounded="pill"
            variant="solo-filled"
            hide-details
            :model-value="jsonString"
            @update:model-value="$emit('update:jsonString', $event)"
            placeholder="Raw JSON"
          />
        </template>

        <div class="ig-header-actions">
          <v-btn icon variant="text" size="small" @click="$emit('toggle-theme')">
            <v-icon size="small">{{ isDarkMode ? 'fi-rr-sun' : 'fi-rr-moon' }}</v-icon>
          </v-btn>

          <v-menu v-if="!$vuetify.display.mdAndUp" location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn v-bind="menuProps" icon variant="text" size="small">
                <v-icon size="small">fi-rr-menu-burger</v-icon>
              </v-btn>
            </template>
            <v-list density="compact" min-width="200">
              <v-list-item @click="$emit('update:mobileInputMode', 'username')">
                <template #prepend>
                  <v-icon size="small">fi-rr-user</v-icon>
                </template>
                <v-list-item-title>Username</v-list-item-title>
              </v-list-item>
              <v-list-item @click="$emit('update:mobileInputMode', 'url')">
                <template #prepend>
                  <v-icon size="small">fi-rr-link</v-icon>
                </template>
                <v-list-item-title>Post / Reel URL</v-list-item-title>
              </v-list-item>
              <v-list-item @click="$emit('update:mobileInputMode', 'json')">
                <template #prepend>
                  <v-icon size="small">fi-rr-square-terminal</v-icon>
                </template>
                <v-list-item-title>Raw JSON</v-list-item-title>
              </v-list-item>
              <v-divider />
              <v-list-item
                v-if="mobileInputMode === 'url'"
                @click="$emit('fetch-post')"
              >
                <template #prepend>
                  <v-icon size="small">fi-rr-search</v-icon>
                </template>
                <v-list-item-title>Fetch post</v-list-item-title>
              </v-list-item>
              <v-list-item
                v-if="mobileInputMode === 'json'"
                @click="$emit('reset-data')"
              >
                <template #prepend>
                  <v-icon size="small">fi-rr-refresh</v-icon>
                </template>
                <v-list-item-title>Reset data</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

          <v-btn
            v-if="$vuetify.display.mdAndUp"
            icon
            variant="text"
            size="small"
            @click="showToolsDialog = true"
          >
            <v-icon size="small">fi-rr-menu-dots</v-icon>
          </v-btn>
        </div>
      </div>

      <v-dialog v-model="showToolsDialog" max-width="480">
        <v-card class="ig-dialog-card" rounded="xl">
          <v-card-title class="text-h6">More tools</v-card-title>
          <v-card-text class="d-flex flex-column ga-4">
            <v-text-field
              density="compact"
              rounded="lg"
              variant="outlined"
              :model-value="postUrl"
              @update:model-value="$emit('update:postUrl', $event)"
              label="Post / Reel URL"
              placeholder="https://www.instagram.com/p/…"
              :loading="postUrlLoading"
              :disabled="postUrlLoading || usernameLoading"
              @keyup.enter="$emit('fetch-post'); showToolsDialog = false"
            >
              <template #append-inner>
                <v-icon
                  size="small"
                  :disabled="postUrlLoading || usernameLoading"
                  @click="$emit('fetch-post'); showToolsDialog = false"
                >
                  fi-rr-search
                </v-icon>
              </template>
            </v-text-field>
            <v-text-field
              density="compact"
              rounded="lg"
              variant="outlined"
              :model-value="jsonString"
              @update:model-value="$emit('update:jsonString', $event)"
              label="Raw JSON"
            >
              <template #append-inner>
                <v-icon size="small" @click="$emit('reset-data')">fi-rr-refresh</v-icon>
              </template>
            </v-text-field>
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn variant="text" @click="showToolsDialog = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-app-bar>
  `
};
