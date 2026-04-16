import { byId } from '../core/utils.js';

export class Spotlight {
  constructor({ getScripts, onExecute, toast } = {}) {
    this.getScripts = getScripts;
    this.onExecute = onExecute;
    this.toast = toast;

    this.overlay = byId('spotlight-overlay');
    this.input = byId('spotlight-input');
    this.results = byId('spotlight-results');
    this.openButton = byId('btn-open-spotlight');

    this.items = [];
    this.activeIndex = 0;

    this.bindEvents();
  }

  bindEvents() {
    this.openButton?.addEventListener('click', () => this.open());

    window.addEventListener('keydown', (event) => {
      const commandShortcut = event.ctrlKey && event.key.toLowerCase() === 'p';
      const spotlightShortcut = event.altKey && event.code === 'Space';

      if (commandShortcut || spotlightShortcut) {
        event.preventDefault();
        this.open();
        return;
      }

      if (event.key === 'Escape' && this.isOpen()) {
        event.preventDefault();
        this.close();
      }
    });

    this.overlay?.addEventListener('click', (event) => {
      if (event.target === this.overlay) {
        this.close();
      }
    });

    this.input?.addEventListener('input', () => {
      this.activeIndex = 0;
      this.renderResults();
    });

    this.input?.addEventListener('keydown', (event) => {
      if (!this.items.length) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.activeIndex = (this.activeIndex + 1) % this.items.length;
        this.renderResults();
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.activeIndex = (this.activeIndex - 1 + this.items.length) % this.items.length;
        this.renderResults();
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const selected = this.items[this.activeIndex];
        if (selected) {
          this.execute(selected);
        }
      }
    });
  }

  isOpen() {
    return Boolean(this.overlay && !this.overlay.classList.contains('hidden'));
  }

  open() {
    if (!this.overlay || !this.input) {
      return;
    }

    this.overlay.classList.remove('hidden');
    this.input.value = '';
    this.input.focus();
    this.activeIndex = 0;
    this.renderResults();
  }

  close() {
    this.overlay?.classList.add('hidden');
  }

  getFilteredScripts() {
    const scripts = this.getScripts?.() || [];
    const query = (this.input?.value || '').toLowerCase().trim();

    if (!query) {
      return scripts.slice(0, 12);
    }

    return scripts
      .filter((script) => {
        const inName = script.name.toLowerCase().includes(query);
        const inCategory = script.category.toLowerCase().includes(query);
        const inPath = String(script.relativePath || '').toLowerCase().includes(query);
        return inName || inCategory || inPath;
      })
      .slice(0, 12);
  }

  renderResults() {
    if (!this.results) {
      return;
    }

    this.items = this.getFilteredScripts();

    this.results.innerHTML = '';

    if (!this.items.length) {
      const empty = document.createElement('li');
      empty.textContent = 'Sin resultados';
      this.results.appendChild(empty);
      return;
    }

    this.items.forEach((script, index) => {
      const row = document.createElement('li');
      if (index === this.activeIndex) {
        row.classList.add('active');
      }

      const name = document.createElement('span');
      name.textContent = script.name;

      const meta = document.createElement('small');
      const folderMeta = script.directory ? ` · ${script.directory}` : '';
      meta.textContent = script.requiresAdmin
        ? `${script.category}${folderMeta} · Admin`
        : `${script.category}${folderMeta}`;

      row.append(name, meta);

      row.addEventListener('click', () => {
        this.activeIndex = index;
        this.execute(script);
      });

      this.results.appendChild(row);
    });
  }

  async execute(script) {
    try {
      await this.onExecute?.(script, script.requiresAdmin);
      this.close();
    } catch (error) {
      this.toast?.push({
        type: 'error',
        title: 'Spotlight',
        message: error.message
      });
    }
  }
}
