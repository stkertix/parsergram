export const AppBarInputs = {
  props: {
    username: { type: String, default: '' },
    postUrl: { type: String, default: '' },
    jsonString: { type: String, default: '' },
    usernameLoading: { type: Boolean, default: false },
    postUrlLoading: { type: Boolean, default: false },
    searchHistoryAutocompleteItems: { type: Array, default: () => [] },
    mobileInputMode: { type: String, default: 'username' },
    inputModeLabel: { type: String, default: 'Username' }
  },
  emits: [
    'update:username',
    'update:postUrl',
    'update:jsonString',
    'update:mobileInputMode',
    'username-autocomplete-update',
    'prompt-profile',
    'fetch-post',
    'reset-data'
  ],
  template: `
    <v-app-bar>
      <v-container :fluid="!$vuetify.display.mdAndUp" class="px-2 px-md-4">
        <v-row v-if="$vuetify.display.mdAndUp" class="pt-5 ma-5">
          <v-col cols="12" md="3">
            <v-combobox
              autocomplete="off"
              :model-value="username"
              @update:model-value="$emit('update:username', $event); $emit('username-autocomplete-update', $event)"
              :items="searchHistoryAutocompleteItems"
              item-title="title"
              item-value="value"
              :auto-select-first="false"
              clearable
              hide-no-data
              density="compact"
              rounded="lg"
              variant="outlined"
              label="Instagram username"
              placeholder="contoh: nasa"
              :loading="usernameLoading"
              :disabled="usernameLoading || postUrlLoading"
              @keyup.enter="$emit('prompt-profile')"
              close-text=""
            >
              <template #prepend-inner>
                <v-icon class="me-2" size="x-small">fi-rr-user</v-icon>
              </template>
            </v-combobox>
          </v-col>
          <v-col cols="12" md="5">
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
              @keyup.enter="$emit('fetch-post')"
            >
              <template #prepend-inner>
                <v-icon class="me-2" size="x-small">fi-rr-link</v-icon>
              </template>
              <template #append-inner>
                <v-icon
                  class="ms-2"
                  size="x-small"
                  :disabled="postUrlLoading || usernameLoading"
                  @click="$emit('fetch-post')"
                >
                  fi-rr-search
                </v-icon>
              </template>
            </v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              density="compact"
              rounded="lg"
              variant="outlined"
              :model-value="jsonString"
              @update:model-value="$emit('update:jsonString', $event)"
              label="Raw JSON"
            >
              <template #prepend-inner>
                <v-icon class="me-2" size="small">fi-rr-square-terminal</v-icon>
              </template>
              <template #append-inner>
                <v-icon class="ms-2" size="x-small" @click="$emit('reset-data')">fi-rr-refresh</v-icon>
              </template>
            </v-text-field>
          </v-col>
        </v-row>

        <v-row v-else class="py-2 align-center ma-0" no-gutters>
          <v-col cols="auto" class="pe-2 flex-shrink-0">
            <v-menu location="bottom start">
              <template #activator="{ props: menuProps }">
                <v-btn v-bind="menuProps" variant="tonal" color="primary" size="small" class="text-none px-3">
                  {{ inputModeLabel }}
                  <v-icon end size="small">fi-rr-angle-small-down</v-icon>
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
              </v-list>
            </v-menu>
          </v-col>
          <v-col class="flex-grow-1" style="min-width: 0">
            <v-combobox
              v-if="mobileInputMode === 'username'"
              autocomplete="off"
              :model-value="username"
              @update:model-value="$emit('update:username', $event); $emit('username-autocomplete-update', $event)"
              :items="searchHistoryAutocompleteItems"
              item-title="title"
              item-value="value"
              :auto-select-first="false"
              clearable
              hide-no-data
              density="compact"
              rounded="lg"
              variant="outlined"
              label="Instagram username"
              placeholder="contoh: nasa"
              :loading="usernameLoading"
              :disabled="usernameLoading || postUrlLoading"
              hide-details
              @keyup.enter="$emit('prompt-profile')"
            >
              <template #prepend-inner>
                <v-icon class="me-2" size="x-small">fi-rr-user</v-icon>
              </template>
              <template #append-inner>
                <v-icon
                  class="ms-2"
                  size="x-small"
                  :disabled="usernameLoading || postUrlLoading"
                  @click="$emit('prompt-profile')"
                >
                  fi-rr-search
                </v-icon>
              </template>
            </v-combobox>
            <v-text-field
              v-else-if="mobileInputMode === 'url'"
              density="compact"
              rounded="lg"
              variant="outlined"
              :model-value="postUrl"
              @update:model-value="$emit('update:postUrl', $event)"
              label="Post / Reel URL"
              placeholder="https://…"
              :loading="postUrlLoading"
              :disabled="postUrlLoading || usernameLoading"
              hide-details
              @keyup.enter="$emit('fetch-post')"
            >
              <template #prepend-inner>
                <v-icon class="me-2" size="x-small">fi-rr-link</v-icon>
              </template>
              <template #append-inner>
                <v-icon
                  class="ms-2"
                  size="x-small"
                  :disabled="postUrlLoading || usernameLoading"
                  @click="$emit('fetch-post')"
                >
                  fi-rr-search
                </v-icon>
              </template>
            </v-text-field>
            <v-text-field
              v-else
              density="compact"
              rounded="lg"
              variant="outlined"
              :model-value="jsonString"
              @update:model-value="$emit('update:jsonString', $event)"
              label="Raw JSON"
              hide-details
            >
              <template #prepend-inner>
                <v-icon class="me-2" size="small">fi-rr-square-terminal</v-icon>
              </template>
              <template #append-inner>
                <v-icon class="ms-2" size="x-small" @click="$emit('reset-data')">fi-rr-refresh</v-icon>
              </template>
            </v-text-field>
          </v-col>
        </v-row>
      </v-container>
    </v-app-bar>
  `
};
