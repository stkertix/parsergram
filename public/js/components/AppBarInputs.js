import { getPath } from '../utils/path.js';

export const AppBarInputs = {
  props: {
    query: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    searchHistoryAutocompleteItems: { type: Array, default: () => [] },
    isDarkMode: { type: Boolean, default: false }
  },
  emits: [
    'update:query',
    'query-autocomplete-update',
    'submit-search',
    'toggle-theme',
    'request-delete-history',
    'open-cookie-settings'
  ],
  data() {
    return {
      rootPath: getPath('/')
    };
  },
  template: `
    <v-app-bar flat class="ig-app-bar" height="60">
      <div class="ig-header-inner">
        <a class="ig-logo" :href="rootPath">ParserGram</a>

        <v-combobox
          class="ig-search-pill"
          autocomplete="off"
          :model-value="query"
          @update:model-value="$emit('update:query', $event); $emit('query-autocomplete-update', $event)"
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
          placeholder="Username, URL, or JSON"
          :loading="loading"
          :disabled="loading"
          @keyup.enter="$emit('submit-search')"
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

        <div class="ig-header-actions">
          <v-btn icon variant="text" size="small" @click="$emit('toggle-theme')">
            <v-icon size="small">{{ isDarkMode ? 'fi-rr-sun' : 'fi-rr-moon' }}</v-icon>
          </v-btn>

          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn v-bind="menuProps" icon variant="text" size="small">
                <v-icon size="small">fi-rr-menu-dots</v-icon>
              </v-btn>
            </template>
            <v-list density="compact" min-width="200">
              <v-list-item @click="$emit('open-cookie-settings')">
                <template #prepend>
                  <v-icon size="small">fi-rr-key</v-icon>
                </template>
                <v-list-item-title>IG Cookie</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>
    </v-app-bar>
  `
};
