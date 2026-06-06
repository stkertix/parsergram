export const ProfileHeader = {
  props: {
    profileEntry: { type: Object, default: null },
    feedCount: { type: Number, default: 0 },
    storyCount: { type: Number, default: 0 },
    highlightCount: { type: Number, default: 0 },
    getPath: { type: Function, required: true },
    getMediaImageSrc: { type: Function, required: true }
  },
  computed: {
    username() {
      return this.profileEntry?.item?.username || '';
    },
    avatarSrc() {
      if (!this.profileEntry?.item) {
        return '';
      }
      return this.getMediaImageSrc(this.profileEntry.item);
    }
  },
  template: `
    <header v-if="profileEntry" class="ig-profile-header">
      <img
        v-if="avatarSrc"
        :src="avatarSrc"
        :alt="username"
        class="ig-profile-avatar"
      />
      <div v-else class="ig-profile-avatar ig-profile-avatar--placeholder">
        <v-icon size="36" color="grey">fi-rr-user</v-icon>
      </div>
      <div class="ig-profile-meta">
        <h1 class="ig-profile-username">{{ username }}</h1>
        <p class="ig-profile-stats">
          <strong>{{ feedCount }}</strong> <span>posts</span>
          · <strong>{{ storyCount }}</strong> <span>stories</span>
          · <strong>{{ highlightCount }}</strong> <span>highlights</span>
        </p>
      </div>
    </header>
  `
};
