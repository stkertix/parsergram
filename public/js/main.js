import { App } from './App.js';
import { MediaEntryCard } from './components/MediaEntryCard.js';
import { AppBarInputs } from './components/AppBarInputs.js';
import { HighlightLoadDialog } from './components/HighlightLoadDialog.js';
import { DeleteHistoryDialog } from './components/DeleteHistoryDialog.js';
import { CookieSettingsDialog } from './components/CookieSettingsDialog.js';
import { ResultPanel } from './components/ResultPanel.js';
import { PreviewDialog } from './components/PreviewDialog.js';
import { ProfileHeader } from './components/ProfileHeader.js';

const { createApp } = Vue;
const { createVuetify } = Vuetify;

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          background: '#fafafa',
          surface: '#ffffff',
          primary: '#0095f6',
          'on-background': '#262626',
          'on-surface': '#262626'
        }
      },
      dark: {
        colors: {
          background: '#000000',
          surface: '#121212',
          primary: '#0095f6',
          'on-background': '#f5f5f5',
          'on-surface': '#f5f5f5'
        }
      }
    }
  }
});

const app = createApp(App);

app.component('MediaEntryCard', MediaEntryCard);
app.component('AppBarInputs', AppBarInputs);
app.component('HighlightLoadDialog', HighlightLoadDialog);
app.component('DeleteHistoryDialog', DeleteHistoryDialog);
app.component('CookieSettingsDialog', CookieSettingsDialog);
app.component('ResultPanel', ResultPanel);
app.component('PreviewDialog', PreviewDialog);
app.component('ProfileHeader', ProfileHeader);

app.use(vuetify).mount('#app');
