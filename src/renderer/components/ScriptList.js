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
      card.dataset.scriptId = script.id; // Added for V3 visual selections
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
      // Dashboard V3 (Native-First) - Override Purgador de RAM
      if (script.id === '02_Optimizacion_Gaming/Purgar_ram.py' || script.name.toLowerCase().includes('purgar ram')) {
        try {
          await window.horus.system.optimizeRam();
        } catch (error) {
          console.error('Error nativo purgar RAM:', error);
        }
        return;
      }

      // Dashboard V3 (Native-First) - Override Limpieza Extrema Global
      if (script.id === '04_Utilidades_Archivos/Limpieza_Extrema_Global.py' || script.name.toLowerCase().includes('limpieza extrema') || script.name.toLowerCase().includes('limpieza_extrema')) {
        const card = this.gridElement.querySelector(`[data-script-id="${script.id}"]`);
        this.startVisualCleanup(card);
        return;
      }

      // Dashboard V3 (Native-First) - Override Duplicados
      if (script.id === '04_Utilidades_Archivos/Duplicados.py' || script.name.toLowerCase().includes('duplicado')) {
        const card = this.gridElement.querySelector(`[data-script-id="${script.id}"]`);
        this.startVisualDuplicates(card);
        return;
      }

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

    /**
     * V3: Animación y métricas en vivo para limpieza en lugar de texto en terminal
     * @param {HTMLElement} card 
     */
    async startVisualCleanup(card) {
      if (!card) return;
      const cardActions = card.querySelector('.card-actions');
      const oldActionsStyle = cardActions ? cardActions.style.display : 'flex';
      if (cardActions) cardActions.style.display = 'none';

      try {
        const modal = document.createElement('div');
        Object.assign(modal.style, {
          position: 'fixed', inset: '0', zIndex: '999999',
          background: 'rgba(10, 10, 15, 0.9)', backdropFilter: 'blur(15px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', userSelect: 'none',
          transition: 'all 0.5s ease', opacity: '0', transform: 'scale(1.05)'
        });
        
        modal.innerHTML = `
        <div style="background: #1a1b26; border: 1px solid #3b4261; border-radius: 20px; padding: 50px; width: 650px; max-width: 90vw; box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.9); position: relative; overflow: hidden; box-sizing: border-box; text-align: center; transition: all 0.5s ease;">
          <div style="position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #bb9af7, #7aa2f7, #9ece6a); box-shadow: 0 0 20px rgba(122, 162, 247, 0.8); transition: background 0.5s ease;" id="v3-gradient-top"></div>
          
          <div style="width: 100px; height: 100px; border-radius: 50%; border: 3px dashed #7aa2f7; margin: 0 auto 30px; display: flex; align-items: center; justify-content: center; transition: border-color 0.5s ease; animation: v3-spin-slow 10s linear infinite;" id="v3-ring">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 44px; height: 44px; stroke: #7aa2f7; transition: stroke 0.5s ease; animation: v3-pulse-glow 2s ease-in-out infinite alternate;" id="v3-icon">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          
          <h2 style="color: #7aa2f7; margin: 0 0 35px 0; font-size: 32px; text-transform: uppercase; letter-spacing: 4px; font-weight: 800; text-shadow: 0 0 15px rgba(122, 162, 247, 0.4);" id="v3-title">Iniciando Limpieza V3</h2>
          
          <div style="display: flex; justify-content: space-between; margin: 0 0 35px 0; background: rgba(0,0,0,0.5); padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
            <div style="width: 50%; border-right: 1px solid rgba(255,255,255,0.1);">
              <div style="color: #a9b1d6; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-weight: 600;">Archivos Borrados</div>
              <div id="v3-files-count" style="color: white; font-size: 54px; font-weight: 900; font-family: Consolas, monospace; text-shadow: 0 0 15px rgba(255,255,255,0.3); transition: color 0.3s;">0</div>
            </div>
            <div style="width: 50%;">
              <div style="color: #a9b1d6; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-weight: 600;">Gigas Liberados</div>
              <div id="v3-mb-freed" style="color: #9ece6a; font-size: 54px; font-weight: 900; font-family: Consolas, monospace; text-shadow: 0 0 15px rgba(158,206,106,0.4); transition: color 0.3s;">0.00</div>
            </div>
          </div>
          
          <div id="v3-current-file" style="color: #7dcfff; font-size: 14px; font-family: Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 25px; text-align: left; background: rgba(0,0,0,0.4); padding: 15px 20px; border-radius: 10px; border-left: 4px solid #7aa2f7; transition: border-color 0.3s, color 0.3s;">Preparando Protocolo de Limpieza...</div>
          
          <div style="height: 12px; background: rgba(0,0,0,0.6); border-radius: 6px; overflow: hidden; position: relative;">
            <div id="v3-progress-bar" style="width: 2%; height: 100%; background: linear-gradient(90deg, #7aa2f7, #9ece6a); box-shadow: 0 0 20px rgba(122, 162, 247, 0.9); transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
          </div>
        </div>
        <style>
          @keyframes v3-spin-slow { 100% { transform: rotate(360deg); } }
          @keyframes v3-pulse-glow { 0% { filter: drop-shadow(0 0 5px rgba(122,162,247,0.5)); } 100% { filter: drop-shadow(0 0 15px rgba(122,162,247,1)); } }
        </style>
        `;
        
        document.body.appendChild(modal);

        // Animate entrance
        requestAnimationFrame(() => {
          modal.style.opacity = '1';
          modal.style.transform = 'scale(1)';
        });

        const filesCountEl = modal.querySelector('#v3-files-count');
        const mbFreedEl = modal.querySelector('#v3-mb-freed');
        const currentFileEl = modal.querySelector('#v3-current-file');
        const progressBarEl = modal.querySelector('#v3-progress-bar');
        const ringEl = modal.querySelector('#v3-ring');
        const iconEl = modal.querySelector('#v3-icon');
        const titleEl = modal.querySelector('#v3-title');
        const gradientTopEl = modal.querySelector('#v3-gradient-top');

                        let isScanning = true;
        let virtualProgress = 2;
        let visFiles = 0;
        let visMB = 0;
        let targetFiles = 0;
        let targetMB = 0;

        const progressTimer = setInterval(() => {
          if (!isScanning) return;
          virtualProgress += (95 - virtualProgress) * 0.05;
          progressBarEl.style.width = virtualProgress + '%';
          
          visFiles += (targetFiles - visFiles) * 0.1;
          visMB += (targetMB - visMB) * 0.1;

          filesCountEl.textContent = Math.round(visFiles);
          if (visMB > 1000) {
             mbFreedEl.textContent = (visMB / 1024).toFixed(2) + ' GB';
          } else {
             mbFreedEl.textContent = visMB.toFixed(2) + ' MB';
          }
        }, 30);

        if (this.duplicatesProgressUnsub) this.duplicatesProgressUnsub();
        
        let finalMB = "0.00";
        let finalFiles = 0;

        if (window.horus && window.horus.events && window.horus.events.onSystemProgress) {
          this.duplicatesProgressUnsub = window.horus.events.onSystemProgress((data) => {
            if (!data) return;
            
            if (data.status === 'scanning' || data.status === 'hashing' || data.status === 'moving') {
              finalFiles = data.duplicatesCount || 0;
              let parsedMB = parseFloat(data.totalFreedMB) || 0;
              
              targetFiles = finalFiles;
              targetMB = parsedMB;

              if (parsedMB > 1000) {
                 finalMB = (parsedMB / 1024).toFixed(2) + ' GB';
              } else {
                 finalMB = parsedMB.toFixed(2) + ' MB';
              }

              let actionStr = 'Scn: ';
              if (data.status === 'hashing') actionStr = 'Hash: ';
              if (data.status === 'moving') actionStr = 'Aisl: ';

              currentFileEl.textContent = actionStr + (data.file || data.folder || '...');
            } 
          });
        }

        const result = await window.horus.system.findDuplicates();

        clearInterval(progressTimer);
        isScanning = false;
        
        if (result && result.success) {
          if (result.totalFreedMB !== undefined) {
              let resMB = parseFloat(result.totalFreedMB) || 0;
              if (resMB > 1000) {
                 finalMB = (resMB / 1024).toFixed(2) + ' GB';
              } else {
                 finalMB = resMB.toFixed(2) + ' MB';
              }
              finalFiles = result.duplicatesCount || 0;
          }
        }
        
        filesCountEl.textContent = finalFiles;
        mbFreedEl.textContent = finalMB;
        
        currentFileEl.textContent = finalFiles > 0 ? '¡Clones aislados con éxito en Cuarentena!' : 'Sistema limpio de duplicados';
        currentFileEl.style.color = '#9ece6a';
        currentFileEl.style.borderLeftColor = '#9ece6a';
        progressBarEl.style.width = '100%';
        progressBarEl.style.background = '#9ece6a';
        progressBarEl.style.boxShadow = '0 0 25px rgba(158,206,106,0.9)';
        ringEl.style.borderColor = '#9ece6a';
        ringEl.style.animation = 'none'; 
        iconEl.style.stroke = '#9ece6a';
        iconEl.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
        iconEl.style.animation = 'none';
        titleEl.textContent = "BÚSQUEDA FINALIZADA";
        titleEl.style.color = '#9ece6a';
        titleEl.style.textShadow = '0 0 20px rgba(158,206,106,0.5)';
        gradientTopEl.style.background = '#9ece6a';
        gradientTopEl.style.boxShadow = '0 0 20px rgba(158,206,106,0.8)';
        
        if (this.duplicatesProgressUnsub) { 
           this.duplicatesProgressUnsub(); 
           this.duplicatesProgressUnsub = null; 
        }

        setTimeout(() => {
          modal.style.opacity = '0';
          modal.style.transform = 'scale(1.05)';
          setTimeout(() => {
            if (modal.parentNode) modal.remove();
            if (cardActions) cardActions.style.display = oldActionsStyle;
          }, 500);
        }, 4000);

      } catch (err) {
        console.error('Critical modal error', err);
        if (cardActions) cardActions.style.display = oldActionsStyle;
      }
    }
}
