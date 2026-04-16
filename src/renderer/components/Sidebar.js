import { byId, debounce } from '../lib/dom.js';

/**
 * Manages sidebar interactions (search, category selection, counters).
 */
export class Sidebar {
  /**
   * @param {{ onSearchChange: (value: string) => void, onCategoryChange: (category: string, label: string) => void }} handlers
   */
  constructor(handlers) {
    this.handlers = handlers;
    this.searchInput = byId('script-filter-input');
    this.navButtons = Array.from(document.querySelectorAll('#category-list .nav-item'));
    this.titleElement = byId('current-category-title');

    this.totalScriptsElement = byId('total-scripts');
    this.pyScriptsElement = byId('py-scripts');
    this.batchScriptsElement = byId('bat-scripts');
    this.activeScriptsElement = byId('active-scripts');
  }

  /**
   * Binds sidebar events.
   */
  mount() {
    this.searchInput?.addEventListener(
      'input',
      debounce((event) => {
        const value = String(event.target?.value || '');
        this.handlers.onSearchChange(value);
      }, 120)
    );

    for (const button of this.navButtons) {
      button.addEventListener('click', () => {
        this.navButtons.forEach((item) => item.classList.remove('active'));
        button.classList.add('active');

        const category = String(button.dataset.category || 'all').toLowerCase();
        const label = String(button.querySelector('.nav-text')?.textContent || 'Todos');

        if (this.titleElement) {
          this.titleElement.textContent = label;
        }

        this.handlers.onCategoryChange(category, label);
      });
    }
  }

  /**
   * @param {{ total: number, python: number, batch: number, active: number }} counters
   */
  updateCounters(counters) {
    if (this.totalScriptsElement) {
      this.totalScriptsElement.textContent = String(counters.total);
    }

    if (this.pyScriptsElement) {
      this.pyScriptsElement.textContent = String(counters.python);
    }

    if (this.batchScriptsElement) {
      this.batchScriptsElement.textContent = String(counters.batch);
    }

    if (this.activeScriptsElement) {
      this.activeScriptsElement.textContent = String(counters.active);
    }
  }
}
