import { byId, safeText } from '../lib/dom.js';

const PYTHON_EXTENSIONS = new Set(['.py']);
const BATCH_EXTENSIONS = new Set(['.bat', '.cmd', '.ps1']);

/**
 * Script list renderer and filtering controller.
 */
export class ScriptList {
  /**
   * @param {{
   *  api: any,
   *  onProcessStarted?: (processId: string) => void,
   *  onError?: (message: string) => void
   * }} options
   */
  constructor(options) {
    this.api = options.api;
    this.onProcessStarted = options.onProcessStarted || (() => {});
    this.onError = options.onError || (() => {});

    this.gridElement = byId('script-grid');
    this.refreshButton = byId('btn-refresh-scripts');

    this.allScripts = [];
    this.search = '';
    this.category = 'all';
    this.activeProcesses = new Set();
  }

  /**
   * Sets up list events.
   */
  mount() {
    this.refreshButton?.addEventListener('click', () => {
      this.refresh().catch((error) => {
        this.onError(error.message || 'No se pudieron recargar scripts');
      });
    });
  }

  /**
   * Loads scripts from backend.
   * @returns {Promise<void>}
   */
  async refresh() {
    this.allScripts = await this.api.scripts.list();
    this.render();
  }

  /**
   * @param {string} value
   */
  setSearch(value) {
    this.search = String(value || '').toLowerCase();
    this.render();
  }

  /**
   * @param {string} value
   */
  setCategory(value) {
    this.category = String(value || 'all').toLowerCase();
    this.render();
  }

  /**
   * @param {string} processId
   */
  markProcessStarted(processId) {
    if (processId) {
      this.activeProcesses.add(String(processId));
    }
  }

  /**
   * @param {string} processId
   */
  markProcessEnded(processId) {
    if (processId) {
      this.activeProcesses.delete(String(processId));
    }
  }

  /**
   * @returns {{ total: number, python: number, batch: number, active: number }}
   */
  getCounters() {
    const python = this.allScripts.filter((item) => PYTHON_EXTENSIONS.has(String(item.extension || '').toLowerCase())).length;
    const batch = this.allScripts.filter((item) => BATCH_EXTENSIONS.has(String(item.extension || '').toLowerCase())).length;

    return {
      total: this.allScripts.length,
      python,
      batch,
      active: this.activeProcesses.size
    };
  }

  /**
   * @returns {Array<any>}
   */
  getFilteredScripts() {
    return this.allScripts.filter((script) => {
      const extension = String(script.extension || '').toLowerCase();
      const name = String(script.name || '').toLowerCase();
      const relativePath = String(script.relativePath || '').toLowerCase();

      if (this.category === 'python' && !PYTHON_EXTENSIONS.has(extension)) {
        return false;
      }

      if (this.category === 'batch' && !BATCH_EXTENSIONS.has(extension)) {
        return false;
      }

      if (this.category === 'activos' && this.activeProcesses.size === 0) {
        return false;
      }

      if (this.search && !name.includes(this.search) && !relativePath.includes(this.search)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Determines card risk markers from metadata.
   * @param {any} script
   */
  getRiskModel(script) {
    const name = String(script.name || '').toLowerCase();
    const high = Boolean(script.requiresAdmin) || /destructor|telemet|nucleos|ram|firewall/.test(name);

    return {
      dotClass: high ? 'blue' : 'yellow',
      riskTag: high
        ? '<span class="tag tag-red-border">RIESGO HIGH</span>'
        : '<span class="tag tag-yellow">RIESGO MEDIUM</span>'
    };
  }

  /**
   * Renders all visible scripts.
   */
  render() {
    if (!this.gridElement) {
      return;
    }

    const scripts = this.getFilteredScripts();
    this.gridElement.innerHTML = '';

    if (!scripts.length) {
      const empty = document.createElement('div');
      empty.className = 'script-card';
      empty.innerHTML = '<div class="card-title">Sin resultados</div><div class="card-desc">No hay scripts para los filtros actuales.</div>';
      this.gridElement.appendChild(empty);
      return;
    }

    for (const script of scripts) {
      const risk = this.getRiskModel(script);
      const title = safeText(script.name || 'Script');
      const category = safeText(script.category || 'General');

      const card = document.createElement('div');
      card.className = 'script-card';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-group">
            <div class="status-dot ${risk.dotClass}"></div>
            <div class="card-title">${title}</div>
          </div>
          <div class="card-controls">
            <div class="toggle-pill">&gt;_ WIN</div>
          </div>
        </div>
        <div class="card-body">
            <div class="card-desc">${safeText(script.metadata?.desc || `Script de la categoria ${category}. Modifica o interactua con tu sistema.`)}</div>
            <div class="card-params">
              <span class="params-label">Parámetros: ${safeText(script.metadata?.args || (script.requiresAdmin ? 'Ninguno (Admin)' : 'Ninguno'))}</span>
              ${script.metadata?.args && !script.metadata.args.toLowerCase().includes('ningun') ? `
                <div class="input-wrapper">
                  <input type="text" class="args-input custom-input" placeholder="Ingresa los argumentos aquí...">
                </div>
              ` : ''}
            </div>
            <div class="tag-row">
              ${risk.riskTag}
              ${script.requiresAdmin ? '<span class="tag tag-red-fill">ADMIN</span>' : ''}
              <span class="tag tag-blue-border">MODO VISUAL EXTERNO</span>
            </div>
            <div class="card-priority">Prioridad Script: ${script.requiresAdmin ? 'Visual externo' : 'Integrado'}</div>
          </div>
          <div class="card-actions">
            <button class="btn btn-edit" data-role="edit">Editar</button>
            <button class="btn btn-auto" data-role="auto">Auto</button>
            <button class="btn btn-run" data-role="run">Run</button>
          </div>
        `;

        const runButton = card.querySelector('[data-role="run"]');
        runButton?.addEventListener('click', () => {
          const argsInput = card.querySelector('.args-input');
          
          let parsedArgs = [];
          if (argsInput && argsInput.value.trim()) {
            const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
            let match;
            while ((match = regex.exec(argsInput.value.trim())) !== null) {
              parsedArgs.push(match[1] || match[2] || match[0]);
            }
          }

          this.runScript(script, parsedArgs).catch((error) => {
            this.onError(error.message || 'No se pudo ejecutar el script');
          });
        });

        this.gridElement.appendChild(card);
      }
    }

    /**
     * Executes a script from card actions.
     * @param {any} script
     * @param {string[]} args
     */
    async runScript(script, args = []) {
      const response = await this.api.scripts.run({
        scriptId: script.id,
        args: args,
        scriptName: script.name,
        elevated: Boolean(script.requiresAdmin)
      });

    if (response?.processId) {
      this.markProcessStarted(response.processId);
      this.onProcessStarted(response.processId);
      this.render();
      return;
    }

    if (response?.error) {
      throw new Error(response.error);
    }
  }
}
