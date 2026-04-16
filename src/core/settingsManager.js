const KEY = 'my-dashboard-settings';

const defaults = {
  spotlightShortcutHintSeen: false,
  lastCategoryFilter: 'all'
};

export class SettingsManager {
  constructor(storage = window.localStorage) {
    this.storage = storage;
  }

  get() {
    try {
      const raw = this.storage.getItem(KEY);

      if (!raw) {
        return { ...defaults };
      }

      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        ...parsed
      };
    } catch (_error) {
      return { ...defaults };
    }
  }

  set(partial) {
    const current = this.get();
    const next = {
      ...current,
      ...partial
    };

    this.storage.setItem(KEY, JSON.stringify(next));
    return next;
  }
}
