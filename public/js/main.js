import { App } from './App.js';
import { MediaEntryCard } from './components/MediaEntryCard.js';
import { AppBarInputs } from './components/AppBarInputs.js';
import { HighlightLoadDialog } from './components/HighlightLoadDialog.js';
import { ResultPanel } from './components/ResultPanel.js';
import { PreviewDialog } from './components/PreviewDialog.js';

const { createApp } = Vue;
const { createVuetify } = Vuetify;

const app = createApp(App);

app.component('MediaEntryCard', MediaEntryCard);
app.component('AppBarInputs', AppBarInputs);
app.component('HighlightLoadDialog', HighlightLoadDialog);
app.component('ResultPanel', ResultPanel);
app.component('PreviewDialog', PreviewDialog);

app.use(createVuetify()).mount('#app');
