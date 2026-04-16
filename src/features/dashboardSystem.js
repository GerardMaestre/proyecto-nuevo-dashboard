import { appState } from '../core/state.js';
import { byId, debounce } from '../core/utils.js';

export class DashboardSystem {
  constructor({ bridge, toast, onScriptsLoaded, onProcessStarted } = {}) {
    this.bridge = bridge;
    this.toast = toast;
    this.onScriptsLoaded = onScriptsLoaded;
    this.onProcessStarted = onProcessStarted;

    this.grid = byId('script-grid');
    this.searchInput = byId('script-filter-input');
    this.categorySelect = byId('script-category-filter');
    this.refreshButton = byId('btn-refresh-scripts');
    this.totalScriptsElement = byId('total-scripts');

    this.bindFilterEvents();
  }

  bindFilterEvents() {
    this.searchInput?.addEventListener(
      'input',
      debounce((event) => {
        appState.setState({
          filters: {
            search: event.target.value || ''
          }
        });
        this.render();
      }, 120)
    );

    this.categorySelect?.addEventListener('change', (event) => {
      appState.setState({
        filters: {
          category: event.target.value || 'all'
        }
      });
      this.render();
    });

    this.refreshButton?.addEventListener('click', () => {
      this.reloadScripts().catch((error) => {
        this.toast?.push({
          type: 'error',
          title: 'No se pudieron recargar scripts',
          message: error.message
        });
      });
    });
  }

  async initialize() {
    await this.reloadScripts();
  }

  populateCategories(scripts = []) {
    if (!this.categorySelect) {
      return;
    }

    const categories = [...new Set(scripts.map((script) => script.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    const selectedBefore = appState.getState().filters?.category || 'all';

    this.categorySelect.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'Todas las categorias';
    this.categorySelect.appendChild(allOption);

    for (const category of categories) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      this.categorySelect.appendChild(option);
    }

    const selectedIsValid = selectedBefore === 'all' || categories.includes(selectedBefore);
    this.categorySelect.value = selectedIsValid ? selectedBefore : 'all';

    appState.setState({
      filters: {
        category: this.categorySelect.value
      }
    });
  }

  async reloadScripts() {
    try {
      const scripts = await this.bridge.invoke('scripts:list');
      appState.setState({ scripts });
      this.populateCategories(scripts);

      this.totalScriptsElement.textContent = String(scripts.length);
      this.onScriptsLoaded?.(scripts);
      this.render();

      return scripts;
    } catch (error) {
      this.toast?.push({
        type: 'error',
        title: 'No se pudieron cargar scripts',
        message: error.message
      });
      throw error;
    }
  }

  getScripts() {
    return appState.getState().scripts || [];
  }

  getFilteredScripts() {
    const state = appState.getState();
    const scripts = state.scripts || [];
    const search = String(state.filters?.search || '').toLowerCase();
    const category = state.filters?.category || 'all';

    return scripts.filter((script) => {
      const inCategory = category === 'all' || script.category === category;
      const inSearch = !search
        || script.name.toLowerCase().includes(search)
        || String(script.relativePath || '').toLowerCase().includes(search);
      return inCategory && inSearch;
    });
  }

  render() {
    if (!this.grid) {
      return;
    }

    const scripts = this.getFilteredScripts();
    this.grid.innerHTML = '';

    if (!scripts.length) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'script-card';
      emptyCard.innerHTML = '<h4>Sin resultados</h4><p class="card-desc">No hay scripts que coincidan con los filtros actuales.</p>';
      this.grid.appendChild(emptyCard);
      return;
    }

    for (const script of scripts) {
      const card = document.createElement('div');
      card.className = 'script-card';

      // Identify risk and priority
      const isHighRisk = script.requiresAdmin || script.name.toLowerCase().includes('purgar') || script.name.toLowerCase().includes('destructor');
      const priorityLabel = script.requiresAdmin ? 'Visual externo' : 'Integrado';

      const dotColor = isHighRisk ? 'blue' : 'yellow';

      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-group">
            <div class="status-dot ${dotColor}"></div>
            <div class="card-title">${script.name}</div>
          </div>
          <div class="card-controls">
            <button class="star-btn">★</button>
            <div class="toggle-pill">
              <span class="active">&gt;_ WIN</span>
            </div>
            <label class="switch">
              <input type="checkbox">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        
        <div class="card-body">
          <div class="card-desc">Script de la categoria ${script.category || 'General'}. Modifica o interactua con tu sistema.</div>
          <div class="card-params">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Parámetros: Ninguno ${script.requiresAdmin ? '(Pedirá permisos de Administrador)' : ''}
          </div>
          
          <div class="tag-row">
            ${isHighRisk ? '<span class="tag tag-red-border">RIESGO HIGH</span>' : '<span class="tag tag-yellow">RIESGO MEDIUM</span>'}
            ${script.requiresAdmin ? '<span class="tag tag-red-fill">ADMIN</span>' : ''}
            <span class="tag tag-blue-border">MODO VISUAL EXTERNO</span>
          </div>

          <div class="card-priority">Prioridad Script: ${priorityLabel}</div>
        </div>

        <div class="card-actions">
          <button class="btn btn-edit">Editar</button>
          <button class="btn btn-auto">⚙ Auto</button>
          <button class="btn btn-run run-btn-hook">▶ Run</button>
        </div>
      `;

      const runBtn = card.querySelector('.run-btn-hook');
      runBtn.addEventListener('click', () => {
        this.executeScript(script, script.requiresAdmin);
      });

      this.grid.appendChild(card);
    }
  }

  async executeScript(script, elevated = false) {
    try {
      const result = await this.bridge.invoke('scripts:run', {
        scriptId: script.id,
        scriptName: script.name,
        args: [],
        elevated
      });

      this.toast?.push({
        type: 'success',
        title: 'Script iniciado',
        message: `${script.name} se esta ejecutando.`
      });

      if (result?.processId) {
        this.onProcessStarted?.(result.processId);
      }

      return result;
    } catch (error) {
      this.toast?.push({
        type: 'error',
        title: 'Error al ejecutar script',
        message: error.message
      });
      throw error;
    }
  }
}
