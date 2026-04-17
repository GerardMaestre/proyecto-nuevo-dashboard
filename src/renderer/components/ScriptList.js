import { byId, safeText } from '../lib/dom.js';

const PYTHON_EXTENSIONS = new Set(['.py']);
const BATCH_EXTENSIONS = new Set(['.bat', '.cmd', '.ps1']);
const APPLE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const APPLE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const GLASS_MODAL_OVERLAY = 'radial-gradient(circle at 18% 6%, rgba(70, 110, 190, 0.3), rgba(8, 12, 20, 0.84) 52%, rgba(4, 7, 12, 0.94) 100%)';

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
   * Identifica el script de detector de puertos en la lista dinámica.
   * @param {any} script
   * @returns {boolean}
   */
  isPortScannerScript(script) {
    const id = String(script?.id || '').toLowerCase();
    const name = String(script?.name || '').toLowerCase();

    return id === '03_privacidad_seguridad/revisor_puertos_abiertos.py'
      || (name.includes('revisor') && name.includes('puerto'))
      || (name.includes('puertos') && name.includes('abiertos'));
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

      // Dashboard V3 (Native-First) - Override Detector de Puertos
      if (this.isPortScannerScript(script)) {
        const card = this.gridElement.querySelector(`[data-script-id="${script.id}"]`);
        this.startVisualPortScanner(card, script, args).catch((error) => {
          this.onError(error?.message || 'No se pudo ejecutar el detector de puertos');
        });
        return;
      }

      
      // Dashboard V3 (Native-First) - Override Encender Servidor Immich
      if (script.id === '06_Personalizacion/fotos.bat' || (script.name.toLowerCase().includes('encender') && script.name.toLowerCase().includes('fotos'))) {
        const card = this.gridElement.querySelector(`[data-script-id="${script.id}"]`);
        this.startVisualImmich(card, true);
        return;
      }

      // Dashboard V3 (Native-First) - Override Apagar Servidor Immich
      if (script.id === '06_Personalizacion/cerrar_fotos.bat' || (script.name.toLowerCase().includes('apagar') && script.name.toLowerCase().includes('fotos'))) {
        const card = this.gridElement.querySelector(`[data-script-id="${script.id}"]`);
        this.startVisualImmich(card, false);
        return;
      }

      // Universal Glassmorphism Feedback for Standard Scripts
      const card = this.gridElement.querySelector(`[data-script-id="${script.id}"]`);
      if (card) {
        return this.startVisualStandardScript(card, script, args).catch(err => {
          this.onError(err.message || 'No se pudo ejecutar el script');
        });
      } else {
        // Fallback preventivo
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

    /**
     * Inyecta el CSS universal para los scripts estándar si no existe.
     */
    injectAnimationsCSS() {
      if (document.getElementById('v3-standard-script-css')) return;
      const style = document.createElement('style');
      style.id = 'v3-standard-script-css';
      style.textContent = `
        .script-card {
          transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.4s cubic-bezier(0.32, 0.72, 0, 1), border-color 0.4s cubic-bezier(0.32, 0.72, 0, 1) !important;
          position: relative;
          overflow: hidden;
        }
        .script-card.is-processing {
          transform: scale(0.98);
        }
        .script-card.is-success-state {
          border-color: rgba(158, 206, 106, 0.6) !important;
          box-shadow: 0 0 20px rgba(158, 206, 106, 0.2) !important;
        }
        .script-card.is-error-state {
          border-color: rgba(247, 118, 142, 0.6) !important;
          box-shadow: 0 0 20px rgba(247, 118, 142, 0.2) !important;
        }
        .v3-script-overlay {
          position: absolute;
          inset: 0;
          z-index: 10;
          background: rgba(10, 14, 23, 0.85);
          backdrop-filter: blur(8px) saturate(150%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1), background-color 0.4s cubic-bezier(0.32, 0.72, 0, 1);
          border-radius: inherit;
        }
        .v3-script-overlay.show {
          opacity: 1;
        }
        .v3-script-overlay.success {
          background: rgba(158, 206, 106, 0.15);
        }
        .v3-script-overlay.error {
          background: rgba(247, 118, 142, 0.15);
        }
        .v3-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(122, 162, 247, 0.2);
          border-top-color: #7aa2f7;
          border-radius: 50%;
          animation: v3-spin 1s linear infinite;
          margin-bottom: 12px;
        }
        .v3-icon-wrapper {
          display: none;
          width: 44px;
          height: 44px;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          border-radius: 50%;
        }
        .success .v3-icon-wrapper {
          display: flex;
          background: rgba(158, 206, 106, 0.2);
          color: #9ece6a;
          box-shadow: 0 0 15px rgba(158, 206, 106, 0.4);
        }
        .error .v3-icon-wrapper {
          display: flex;
          background: rgba(247, 118, 142, 0.2);
          color: #f7768e;
          box-shadow: 0 0 15px rgba(247, 118, 142, 0.4);
        }
        .success .v3-spinner, .error .v3-spinner {
          display: none !important;
        }
        .v3-status-text {
          font-family: Consolas, monospace;
          font-size: 13px;
          color: #c0caf5;
          text-align: center;
          max-width: 90%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 4px 12px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 6px;
        }
        .success .v3-status-text { color: #9ece6a; }
        .error .v3-status-text { color: #f7768e; }
        @keyframes v3-spin { to { transform: rotate(360deg); } }
      `;
      document.head.appendChild(style);
    }

    /**
     * Inicia el script estándar con overlay Glassmorphism universal.
     * @param {HTMLElement} card
     * @param {any} script
     * @param {string[]} args
     */
    async startVisualStandardScript(card, script, args) {
      this.injectAnimationsCSS();

      card.classList.add('is-processing');

      const overlay = document.createElement('div');
      overlay.className = 'v3-script-overlay';
      overlay.innerHTML = `
        <div class="v3-spinner"></div>
        <div class="v3-icon-wrapper">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="v3-status-icon"></svg>
        </div>
        <div class="v3-status-text process-status-text">Iniciando entorno...</div>
      `;
      card.appendChild(overlay);

      // Trigger reflow
      overlay.getBoundingClientRect();
      overlay.classList.add('show');

      const statusText = overlay.querySelector('.process-status-text');
      const icon = overlay.querySelector('.v3-status-icon');

      let terminalUnsub = null;
      let finalExitPayload = null;
      let targetProcessId = null;

      try {
        const response = await this.api.scripts.run({
          scriptId: script.id,
          args: args,
          scriptName: script.name,
          elevated: Boolean(script.requiresAdmin)
        });

        if (response?.error) {
          throw new Error(response.error);
        }

        const processId = response?.processId;
        if (!processId) {
          throw new Error("No se obtuvo un ID de proceso.");
        }
        
        targetProcessId = processId;
        this.markProcessStarted(processId);
        this.onProcessStarted(processId);

        finalExitPayload = await new Promise((resolve) => {
          let hasSucceeded = false;
          // Timeout de 5 mins
          const timeoutId = setTimeout(() => {
            if (!hasSucceeded) resolve({ type: 'exit', processId, code: -1, error: 'Timeout de seguridad (5 min)' });
          }, 300000);

          terminalUnsub = this.api.events.onTerminalData((payload) => {
            if (!payload || payload.processId !== processId) return;

            if (payload.type === 'stdout' && payload.text) {
              const lines = payload.text.trim().split('\\n').filter(l => l.trim().length > 0);
              if (lines.length > 0) {
                const lastLine = lines[lines.length - 1].trim();
                statusText.textContent = lastLine.length > 40 ? lastLine.substring(0, 40) + '...' : lastLine;
              }
            } else if (payload.type === 'stderr' || payload.type === 'error') {
              const errText = payload.text || payload.message || 'Error en tiempo de ejecución';
              statusText.textContent = errText.length > 40 ? errText.substring(0, 40) + '...' : errText;
            } else if (payload.type === 'exit') {
              hasSucceeded = true;
              clearTimeout(timeoutId);
              resolve(payload);
            }
          });
        });

      } catch (err) {
        finalExitPayload = { error: err.message || "Error inesperado", code: -1 };
      }

      // Cleanup listener
      if (terminalUnsub) terminalUnsub();
      if (targetProcessId) this.markProcessEnded(targetProcessId);

      // Render Final Stage
      if (finalExitPayload?.code === 0 && !finalExitPayload?.error) {
        overlay.classList.add('success');
        card.classList.add('is-success-state');
        statusText.textContent = "¡Operación completada!";
        icon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
      } else {
        overlay.classList.add('error');
        card.classList.add('is-error-state');
        const finalErr = finalExitPayload?.error || "Operación fallida";
        statusText.textContent = finalErr.length > 35 ? finalErr.substring(0, 35) + '...' : finalErr;
        icon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
      }

      // Wait 3s then restore
      await new Promise(r => setTimeout(r, 3000));
      
      overlay.classList.remove('show');
      card.classList.remove('is-processing', 'is-success-state', 'is-error-state');
      
      setTimeout(() => {
        if (overlay.parentNode === card) card.removeChild(overlay);
        this.render(); // force UI refresh
      }, 400);
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
          background: GLASS_MODAL_OVERLAY, backdropFilter: 'blur(20px) saturate(180%)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontFamily: '"SF Pro Display", "Space Grotesk", "Segoe UI", sans-serif', userSelect: 'none',
          transition: `opacity 0.46s ${APPLE_EASE}, transform 0.46s ${APPLE_EASE}`,
          opacity: '0',
          transform: 'scale(0.95)'
        });
        
        modal.innerHTML = `
        <div style="background: linear-gradient(160deg, rgba(28,35,52,0.78), rgba(16,21,32,0.86)); border: 1px solid rgba(255,255,255,0.18); border-radius: 24px; padding: 50px; width: 650px; max-width: 90vw; box-shadow: 0 24px 70px rgba(3, 8, 20, 0.52), inset 0 1px 0 rgba(255,255,255,0.14); backdrop-filter: blur(20px) saturate(180%); position: relative; overflow: hidden; box-sizing: border-box; text-align: center; transition: transform 0.46s ${APPLE_EASE};">
          <div style="position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #bb9af7, #7aa2f7, #9ece6a); box-shadow: 0 0 20px rgba(122, 162, 247, 0.8); transition: background 0.46s ${APPLE_EASE};" id="v3-gradient-top"></div>
          
          <div style="width: 100px; height: 100px; border-radius: 50%; border: 3px dashed #7aa2f7; margin: 0 auto 30px; display: flex; align-items: center; justify-content: center; transition: border-color 0.46s ${APPLE_EASE}; animation: v3-spin-slow 10s linear infinite;" id="v3-ring">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 44px; height: 44px; stroke: #7aa2f7; transition: stroke 0.46s ${APPLE_EASE}; animation: v3-pulse-glow 2s ${APPLE_EASE} infinite alternate;" id="v3-icon">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          
          <h2 style="color: #7aa2f7; margin: 0 0 35px 0; font-size: 32px; text-transform: uppercase; letter-spacing: 4px; font-weight: 800; text-shadow: 0 0 15px rgba(122, 162, 247, 0.4);" id="v3-title">Iniciando Limpieza V3</h2>
          
          <div style="display: flex; justify-content: space-between; margin: 0 0 35px 0; background: rgba(0,0,0,0.5); padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
            <div style="width: 50%; border-right: 1px solid rgba(255,255,255,0.1);">
              <div style="color: #a9b1d6; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-weight: 600;">Archivos Borrados</div>
              <div id="v3-files-count" style="color: white; font-size: 54px; font-weight: 900; font-family: Consolas, monospace; text-shadow: 0 0 15px rgba(255,255,255,0.3); transition: color 0.36s ${APPLE_EASE};">0</div>
            </div>
            <div style="width: 50%;">
              <div style="color: #a9b1d6; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-weight: 600;">Gigas Liberados</div>
              <div id="v3-mb-freed" style="color: #9ece6a; font-size: 54px; font-weight: 900; font-family: Consolas, monospace; text-shadow: 0 0 15px rgba(158,206,106,0.4); transition: color 0.36s ${APPLE_EASE};">0.00</div>
            </div>
          </div>
          
          <div id="v3-current-file" style="color: #7dcfff; font-size: 14px; font-family: Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 25px; text-align: left; background: rgba(0,0,0,0.4); padding: 15px 20px; border-radius: 10px; border-left: 4px solid #7aa2f7; transition: border-color 0.36s ${APPLE_EASE}, color 0.36s ${APPLE_EASE};">Preparando Protocolo de Limpieza...</div>
          
          <div style="height: 12px; background: rgba(0,0,0,0.6); border-radius: 6px; overflow: hidden; position: relative;">
            <div id="v3-progress-bar" style="width: 2%; height: 100%; background: linear-gradient(90deg, #7aa2f7, #9ece6a); box-shadow: 0 0 20px rgba(122, 162, 247, 0.9); transition: width 0.4s ${APPLE_SPRING};"></div>
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
          modal.style.transform = 'scale(0.97)';
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

    /**
     * Mantiene compatibilidad con la ruta de ejecución de Duplicados.
     * @param {HTMLElement} card
     */
    async startVisualDuplicates(card) {
      return this.startVisualCleanup(card);
    }

    /**
     * Flujo visual para el detector de puertos con animacion en tiempo real.
     * @param {HTMLElement | null} card
     * @param {any} script
     * @param {string[]} args
     */
    async startVisualPortScanner(card, script, args = []) {
      const cardActions = card?.querySelector('.card-actions') || null;
      const oldActionsStyle = cardActions ? cardActions.style.display : 'flex';
      if (cardActions) {
        cardActions.style.display = 'none';
      }

      let modal = null;
      let terminalUnsub = null;
      let progressTimer = null;
      let processId = '';
      let isRunning = true;

      try {
        modal = document.createElement('div');
        Object.assign(modal.style, {
          position: 'fixed',
          inset: '0',
          zIndex: '999999',
          background: GLASS_MODAL_OVERLAY,
          backdropFilter: 'blur(20px) saturate(180%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: '"SF Pro Display", "Space Grotesk", "Segoe UI", sans-serif',
          transition: `opacity 0.42s ${APPLE_EASE}, transform 0.42s ${APPLE_EASE}`,
          opacity: '0',
          transform: 'scale(0.95)'
        });

        modal.innerHTML = `
          <div style="background:linear-gradient(160deg, rgba(28,35,52,0.78), rgba(16,21,32,0.86));border:1px solid rgba(255,255,255,0.18);border-radius:24px;padding:30px;width:700px;max-width:92vw;box-shadow:0 24px 70px rgba(3,8,20,.52), inset 0 1px 0 rgba(255,255,255,0.14);backdrop-filter:blur(20px) saturate(180%);position:relative;overflow:hidden;">
            <div id="portscan-top" style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#7dcfff,#7aa2f7,#9ece6a);box-shadow:0 0 18px rgba(122,162,247,.75);"></div>

            <div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap;">
              <div style="position:relative;width:126px;height:126px;flex:0 0 auto;">
                <div style="position:absolute;inset:0;border-radius:50%;border:1px solid rgba(125,207,255,0.35);"></div>
                <div style="position:absolute;inset:13px;border-radius:50%;border:1px dashed rgba(125,207,255,0.42);animation:portscan-ring 6.5s linear infinite;"></div>
                <div id="portscan-sweep" style="position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg, rgba(125,207,255,0.7), rgba(125,207,255,0.1), transparent 43%);animation:portscan-sweep 2.4s linear infinite;"></div>
                <div style="position:absolute;inset:35px;border-radius:50%;background:rgba(7,10,18,0.95);border:1px solid rgba(125,207,255,0.35);display:flex;align-items:center;justify-content:center;color:#7dcfff;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">scan</div>
              </div>

              <div style="flex:1;min-width:250px;">
                <h2 id="portscan-title" style="margin:0 0 10px 0;color:#7dcfff;font-size:31px;letter-spacing:1px;text-transform:uppercase;font-weight:900;text-shadow:0 0 16px rgba(125,207,255,0.25);">Detector de Puertos</h2>
                <div id="portscan-stage" style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(122,162,247,0.18);color:#7aa2f7;font-size:12px;letter-spacing:1px;font-weight:700;text-transform:uppercase;">Inicializando</div>
                <div id="portscan-message" style="margin-top:12px;color:#c0caf5;background:rgba(0,0,0,0.33);border:1px solid rgba(255,255,255,0.08);border-radius:11px;padding:12px 14px;line-height:1.3;min-height:46px;">Preparando exploracion local de servicios...</div>
              </div>
            </div>

            <div id="portscan-metrics" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:20px;">
              <div style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px;">
                <div style="font-size:11px;color:#a9b1d6;text-transform:uppercase;letter-spacing:1.1px;">Puertos Revisados</div>
                <div id="portscan-checked" style="margin-top:5px;color:#c0caf5;font-size:28px;font-weight:800;font-family:Consolas, monospace;">0</div>
              </div>
              <div style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px;">
                <div style="font-size:11px;color:#a9b1d6;text-transform:uppercase;letter-spacing:1.1px;">Puertos Abiertos</div>
                <div id="portscan-open" style="margin-top:5px;color:#f7768e;font-size:28px;font-weight:800;font-family:Consolas, monospace;">0</div>
              </div>
              <div style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px;">
                <div style="font-size:11px;color:#a9b1d6;text-transform:uppercase;letter-spacing:1.1px;">Riesgo Actual</div>
                <div id="portscan-risk" style="margin-top:5px;color:#7aa2f7;font-size:28px;font-weight:800;font-family:Consolas, monospace;">LOW</div>
              </div>
            </div>

            <div style="margin-top:15px;height:10px;background:rgba(0,0,0,0.58);border-radius:999px;overflow:hidden;">
              <div id="portscan-progress" style="height:100%;width:4%;background:linear-gradient(90deg,#7dcfff,#7aa2f7);box-shadow:0 0 15px rgba(122,162,247,0.55);transition:width .32s ${APPLE_EASE};"></div>
            </div>

            <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;color:#8e95b9;font-size:12px;letter-spacing:.8px;text-transform:uppercase;">
              <span>Escaneo de puertos criticos locales</span>
              <span id="portscan-elapsed">0.0s</span>
            </div>

            <div id="portscan-open-ports" style="margin-top:13px;display:flex;flex-wrap:wrap;gap:8px;min-height:30px;align-items:flex-start;color:#a9b1d6;font-size:13px;">Sin puertos peligrosos abiertos reportados.</div>

            <div style="margin-top:16px;color:#8e95b9;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Mitigacion segura desde HORUS</div>
            <div id="portscan-actions" style="margin-top:8px;display:flex;flex-direction:column;gap:8px;max-height:190px;overflow:auto;padding-right:3px;"></div>

            <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-auto" id="portscan-harden-smb" style="display:none;font-size:11px;">Blindaje SMB</button>
              <button class="btn btn-auto" id="portscan-force-public" style="display:none;font-size:11px;">Forzar red publica</button>
              <button class="btn btn-edit" id="portscan-close" style="font-size:11px;">Cerrar</button>
            </div>
          </div>

          <style>
            @keyframes portscan-sweep { to { transform: rotate(360deg); } }
            @keyframes portscan-ring { to { transform: rotate(-360deg); } }
            @media (max-width: 680px) {
              #portscan-metrics { grid-template-columns: 1fr !important; }
            }
          </style>
        `;

        document.body.appendChild(modal);
        requestAnimationFrame(() => {
          modal.style.opacity = '1';
          modal.style.transform = 'scale(1)';
        });

        const titleEl = modal.querySelector('#portscan-title');
        const topBarEl = modal.querySelector('#portscan-top');
        const stageEl = modal.querySelector('#portscan-stage');
        const messageEl = modal.querySelector('#portscan-message');
        const checkedEl = modal.querySelector('#portscan-checked');
        const openEl = modal.querySelector('#portscan-open');
        const riskEl = modal.querySelector('#portscan-risk');
        const progressEl = modal.querySelector('#portscan-progress');
        const elapsedEl = modal.querySelector('#portscan-elapsed');
        const openPortsEl = modal.querySelector('#portscan-open-ports');
        const actionsEl = modal.querySelector('#portscan-actions');
        const closeButton = modal.querySelector('#portscan-close');
        const forcePublicButton = modal.querySelector('#portscan-force-public');
        const hardenSmbButton = modal.querySelector('#portscan-harden-smb');

        const totalDangerPorts = 16;
        const openPorts = new Set();
        const findingsByPort = new Map();
        const mitigationByPort = new Map();
        const startedAt = Date.now();
        let summaryOpenPorts = null;
        let summaryData = null;
        let virtualChecked = 0;
        let targetChecked = 2;
        let virtualProgress = 4;
        let scanCompleted = false;
        let isGlobalMitigationBusy = false;
        let smbHardenStatus = 'idle';
        let profileHardenStatus = 'idle';

        const riskWeight = Object.freeze({
          LOW: 1,
          MEDIUM: 2,
          HIGH: 3
        });

        const updateRiskStateByCount = (count) => {
          let riskLabel = 'LOW';
          let riskColor = '#7aa2f7';

          if (count >= 3) {
            riskLabel = 'HIGH';
            riskColor = '#f7768e';
          } else if (count > 0) {
            riskLabel = 'MEDIUM';
            riskColor = '#e0af68';
          }

          riskEl.textContent = riskLabel;
          riskEl.style.color = riskColor;
        };

        const updateRiskStateFromFindings = () => {
          if (!findingsByPort.size) {
            updateRiskStateByCount(openPorts.size);
            return;
          }

          const findings = Array.from(findingsByPort.values());
          const hasPublicExposure = findings.some((item) => item.scope === 'PUBLIC');

          if (!hasPublicExposure) {
            riskEl.textContent = 'LOW';
            riskEl.style.color = '#9ece6a';
            return;
          }

          let maxScore = 1;
          for (const finding of findings) {
            maxScore = Math.max(maxScore, riskWeight[finding.risk] || 1);
          }

          if (maxScore >= 3) {
            riskEl.textContent = 'HIGH';
            riskEl.style.color = '#f7768e';
            return;
          }

          riskEl.textContent = 'MEDIUM';
          riskEl.style.color = '#e0af68';
        };

        const renderOpenPorts = () => {
          const sortedPorts = Array.from(openPorts).sort((a, b) => a - b);

          if (!sortedPorts.length) {
            openPortsEl.textContent = 'Sin puertos peligrosos abiertos reportados.';
            return;
          }

          const chips = sortedPorts.slice(0, 10)
            .map((port) => {
              const finding = findingsByPort.get(port);
              if (!finding) {
                return `<span style="padding:5px 10px;border-radius:999px;border:1px solid rgba(247,118,142,0.5);background:rgba(247,118,142,0.16);color:#f7768e;font-weight:700;font-family:Consolas, monospace;">:${port}</span>`;
              }

              const isPublic = finding.scope === 'PUBLIC';
              const borderColor = isPublic ? 'rgba(247,118,142,0.6)' : 'rgba(158,206,106,0.6)';
              const background = isPublic ? 'rgba(247,118,142,0.18)' : 'rgba(158,206,106,0.18)';
              const textColor = isPublic ? '#f7768e' : '#9ece6a';
              const scopeLabel = isPublic ? 'RED' : 'LOCAL';
              const riskLabel = finding.risk || 'LOW';

              return `<span style="padding:5px 10px;border-radius:999px;border:1px solid ${borderColor};background:${background};color:${textColor};font-weight:700;font-family:Consolas, monospace;">:${port} ${scopeLabel} ${riskLabel}</span>`;
            })
            .join('');

          const hidden = sortedPorts.length - 10;
          openPortsEl.innerHTML = hidden > 0
            ? `${chips}<span style="padding:5px 10px;border-radius:999px;border:1px solid rgba(224,175,104,0.5);background:rgba(224,175,104,0.16);color:#e0af68;font-weight:700;">+${hidden} mas</span>`
            : chips;
        };

        const mitigationLabel = (status) => {
          if (status === 'working') return 'Aplicando...';
          if (status === 'done') return 'Mitigado';
          if (status === 'error') return 'Error';
          return 'Pendiente';
        };

        const mitigationColor = (status) => {
          if (status === 'done') return '#9ece6a';
          if (status === 'error') return '#f7768e';
          if (status === 'working') return '#7dcfff';
          return '#a9b1d6';
        };

        const renderMitigationActions = () => {
          if (!actionsEl) {
            return;
          }

          if (!scanCompleted) {
            actionsEl.innerHTML = '<div style="padding:10px;border-radius:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.07);color:#8e95b9;">Las acciones de bloqueo estaran disponibles al terminar el escaneo.</div>';
            return;
          }

          const orderedPorts = Array.from(openPorts).sort((a, b) => a - b);

          if (!orderedPorts.length) {
            actionsEl.innerHTML = '<div style="padding:10px;border-radius:10px;background:rgba(158,206,106,0.12);border:1px solid rgba(158,206,106,0.35);color:#9ece6a;">No hay puertos detectados para mitigar.</div>';
            return;
          }

          actionsEl.innerHTML = orderedPorts
            .map((port) => {
              const finding = findingsByPort.get(port) || { scope: 'LOCAL', risk: 'LOW' };
              const state = mitigationByPort.get(port) || 'idle';
              const busy = state === 'working';
              const done = state === 'done';

              const scopeColor = finding.scope === 'PUBLIC' ? '#f7768e' : '#9ece6a';
              const actionLabel = finding.scope === 'PUBLIC' ? 'Bloquear puerto' : 'Bloquear (opcional)';

              return `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);">
                  <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                    <span style="color:#c0caf5;font-weight:700;font-family:Consolas, monospace;">:${port}</span>
                    <span style="font-size:11px;color:${scopeColor};">${finding.scope} · RIESGO ${finding.risk || 'LOW'}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                    <span style="font-size:11px;color:${mitigationColor(state)};">${mitigationLabel(state)}</span>
                    <button class="btn"
                      data-action="block-port"
                      data-port="${port}"
                      ${busy || done ? 'disabled' : ''}
                      style="font-size:11px;background:${done ? '#27C93F' : 'var(--accent-blue)'};color:#fff;opacity:${busy || done ? '0.72' : '1'};"
                    >${done ? 'Aplicado' : actionLabel}</button>
                  </div>
                </div>
              `;
            })
            .join('');
        };

        const waitForManualClose = (timeoutMs = 300000) => {
          return new Promise((resolve) => {
            let settled = false;

            const finish = (reason) => {
              if (settled) {
                return;
              }

              settled = true;
              clearTimeout(timeoutId);
              closeButton?.removeEventListener('click', onClose);
              modal?.removeEventListener('click', onBackdropClick);
              resolve(reason);
            };

            const onClose = () => finish('manual');
            const onBackdropClick = (event) => {
              if (event.target === modal) {
                finish('backdrop');
              }
            };

            const timeoutId = setTimeout(() => finish('timeout'), timeoutMs);

            closeButton?.addEventListener('click', onClose);
            modal?.addEventListener('click', onBackdropClick);
          });
        };

        const updateGlobalButtons = () => {
          const hasPorts = openPorts.size > 0;
          const summaryPublic = Number(summaryData?.public_count);
          const hasPublicPorts = Array.from(findingsByPort.values()).some((item) => item.scope === 'PUBLIC')
            || (Number.isInteger(summaryPublic) && summaryPublic > 0);

          const summaryPorts = Array.isArray(summaryData?.ports)
            ? summaryData.ports.map((port) => Number(port)).filter((port) => Number.isInteger(port))
            : [];
          const hasSmbPort = openPorts.has(139)
            || openPorts.has(445)
            || summaryPorts.includes(139)
            || summaryPorts.includes(445);

          forcePublicButton.style.display = scanCompleted && hasPublicPorts ? 'inline-flex' : 'none';
          hardenSmbButton.style.display = scanCompleted && hasSmbPort ? 'inline-flex' : 'none';

          const smbBusy = smbHardenStatus === 'working';
          const smbDone = smbHardenStatus === 'done';
          hardenSmbButton.disabled = smbBusy || smbDone;
          hardenSmbButton.textContent = smbBusy
            ? 'Blindaje SMB...'
            : (smbDone ? 'SMB protegido' : 'Blindaje SMB');
          hardenSmbButton.style.opacity = smbBusy || smbDone ? '0.72' : '1';

          const profileBusy = profileHardenStatus === 'working';
          const profileDone = profileHardenStatus === 'done';
          forcePublicButton.disabled = profileBusy || profileDone;
          forcePublicButton.textContent = profileBusy
            ? 'Aplicando perfil...'
            : (profileDone ? 'Perfil publico activo' : 'Forzar red publica');
          forcePublicButton.style.opacity = profileBusy || profileDone ? '0.72' : '1';

          closeButton.textContent = hasPorts ? 'Cerrar panel' : 'Cerrar';
        };

        const blockPortSafely = async (port) => {
          if (isGlobalMitigationBusy) {
            return;
          }

          isGlobalMitigationBusy = true;
          mitigationByPort.set(port, 'working');
          renderMitigationActions();

          try {
            await this.api.system.blockPort(port);
            mitigationByPort.set(port, 'done');
            const finding = findingsByPort.get(port);
            if (finding) {
              findingsByPort.set(port, {
                ...finding,
                mitigated: true
              });
            }
            messageEl.textContent = `Puerto ${port} bloqueado en firewall (TCP/UDP inbound).`;
          } catch (error) {
            mitigationByPort.set(port, 'error');
            messageEl.textContent = error?.message || `No se pudo mitigar el puerto ${port}.`;
          } finally {
            isGlobalMitigationBusy = false;
            renderMitigationActions();
            renderOpenPorts();
            updateGlobalButtons();
          }
        };

        const hardenSmbSafely = async () => {
          if (isGlobalMitigationBusy || smbHardenStatus === 'done') {
            return;
          }

          isGlobalMitigationBusy = true;
          smbHardenStatus = 'working';
          updateGlobalButtons();

          try {
            await this.api.system.hardenSmb();
            smbHardenStatus = 'done';
            mitigationByPort.set(139, 'done');
            mitigationByPort.set(445, 'done');
            messageEl.textContent = 'Hardening SMB aplicado. SMB1 deshabilitado y puertos SMB bloqueados.';
          } catch (error) {
            smbHardenStatus = 'error';
            messageEl.textContent = error?.message || 'No se pudo aplicar hardening SMB.';
          } finally {
            isGlobalMitigationBusy = false;
            renderMitigationActions();
            updateGlobalButtons();
          }
        };

        const forcePublicProfileSafely = async () => {
          if (isGlobalMitigationBusy || profileHardenStatus === 'done') {
            return;
          }

          isGlobalMitigationBusy = true;
          profileHardenStatus = 'working';
          updateGlobalButtons();

          try {
            await this.api.system.forcePublicNetwork();
            profileHardenStatus = 'done';
            messageEl.textContent = 'Perfiles de red activos cambiados a Public para endurecer exposicion.';
          } catch (error) {
            profileHardenStatus = 'error';
            messageEl.textContent = error?.message || 'No se pudo forzar el perfil de red a publico.';
          } finally {
            isGlobalMitigationBusy = false;
            updateGlobalButtons();
          }
        };

        actionsEl?.addEventListener('click', (event) => {
          const button = event.target?.closest('button[data-action="block-port"]');
          if (!button) {
            return;
          }

          const port = Number(button.getAttribute('data-port'));
          if (!Number.isInteger(port)) {
            return;
          }

          blockPortSafely(port).catch(() => {});
        });

        hardenSmbButton?.addEventListener('click', () => {
          hardenSmbSafely().catch(() => {});
        });

        forcePublicButton?.addEventListener('click', () => {
          forcePublicProfileSafely().catch(() => {});
        });

        renderMitigationActions();
        updateGlobalButtons();

        const formatFinalPorts = () => {
          const ordered = Array.from(openPorts).sort((a, b) => a - b);
          if (!ordered.length) {
            return 'ninguno';
          }

          return ordered
            .map((port) => {
              const finding = findingsByPort.get(port);
              if (!finding) {
                return String(port);
              }
              const scopeLabel = finding.scope === 'PUBLIC' ? 'RED' : 'LOCAL';
              return `${port} (${scopeLabel})`;
            })
            .join(', ');
        };

        const parseStructuredLine = (line) => {
          if (line.startsWith('[PORT_RESULT]')) {
            const rawPayload = line.slice('[PORT_RESULT]'.length).trim();

            try {
              const payload = JSON.parse(rawPayload);
              const port = Number(payload?.port);
              if (!Number.isInteger(port)) {
                return true;
              }

              const scope = String(payload?.scope || 'LOCAL').toUpperCase() === 'PUBLIC' ? 'PUBLIC' : 'LOCAL';
              const maybeRisk = String(payload?.risk || 'LOW').toUpperCase();
              const risk = ['LOW', 'MEDIUM', 'HIGH'].includes(maybeRisk) ? maybeRisk : 'LOW';
              const binds = Array.isArray(payload?.binds)
                ? payload.binds.map((item) => String(item || '').trim()).filter(Boolean)
                : [];

              findingsByPort.set(port, {
                scope,
                risk,
                binds,
                service: String(payload?.service || '')
              });

              openPorts.add(port);
              targetChecked = totalDangerPorts;
              openEl.textContent = String(openPorts.size);

              const bindText = binds.length ? binds.join(', ') : 'desconocido';
              messageEl.textContent = scope === 'PUBLIC'
                ? `Puerto ${port} expuesto en red (${bindText}).`
                : `Puerto ${port} solo local (${bindText}).`;

              renderOpenPorts();
              updateRiskStateFromFindings();
              renderMitigationActions();
              updateGlobalButtons();
            } catch {
              // Se mantiene parser por texto como respaldo.
            }

            return true;
          }

          if (line.startsWith('[PORT_SUMMARY]')) {
            const rawPayload = line.slice('[PORT_SUMMARY]'.length).trim();

            try {
              summaryData = JSON.parse(rawPayload);
              const parsedOpen = Number(summaryData?.open_count);
              if (Number.isInteger(parsedOpen)) {
                summaryOpenPorts = parsedOpen;
                openEl.textContent = String(parsedOpen);
              }
              targetChecked = totalDangerPorts;
              updateRiskStateFromFindings();
              renderMitigationActions();
              updateGlobalButtons();
            } catch {
              // No-op: fallback con parser por texto.
            }

            return true;
          }

          return false;
        };

        progressTimer = setInterval(() => {
          const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
          elapsedEl.textContent = `${elapsedSeconds}s`;

          if (isRunning) {
            const targetProgress = Math.min(93, (targetChecked / totalDangerPorts) * 88 + 5);
            virtualProgress += (targetProgress - virtualProgress) * 0.08;
          } else {
            virtualProgress += (100 - virtualProgress) * 0.22;
          }

          virtualChecked += (targetChecked - virtualChecked) * 0.08;
          checkedEl.textContent = String(Math.max(0, Math.min(totalDangerPorts, Math.round(virtualChecked))));
          progressEl.style.width = `${Math.min(100, virtualProgress)}%`;
        }, 33);

        const processStdoutChunk = (textChunk) => {
          const lines = String(textChunk || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

          if (!lines.length) {
            return;
          }

          for (const line of lines) {
            if (parseStructuredLine(line)) {
              continue;
            }

            const lowerLine = line.toLowerCase();

            if (lowerLine.includes('escaneando')) {
              stageEl.textContent = 'Escaneando';
              messageEl.textContent = 'Explorando puertos locales con verificacion concurrente...';
              targetChecked = 10;
            }

            if (lowerLine.includes('alerta roja')) {
              messageEl.textContent = line;
            }

            if (lowerLine.includes('[ok] excelente')) {
              summaryOpenPorts = 0;
              targetChecked = totalDangerPorts;
            }

            const summaryMatch = lowerLine.match(/se encontraron\s+(\d+)\s+puertos/i);
            if (summaryMatch) {
              summaryOpenPorts = Number(summaryMatch[1]);
              targetChecked = totalDangerPorts;
              messageEl.textContent = line;
            }

            const portMatches = line.matchAll(/puerto\s+(\d+)/gi);
            for (const match of portMatches) {
              const port = Number(match[1]);
              if (Number.isInteger(port)) {
                openPorts.add(port);
              }
            }

            if (openPorts.size > 0) {
              openEl.textContent = String(openPorts.size);
              updateRiskStateFromFindings();
              renderOpenPorts();
            }
          }
        };

        const response = await this.api.scripts.run({
          scriptId: script.id,
          scriptName: script.name,
          args,
          elevated: Boolean(script.requiresAdmin)
        });

        if (response?.error) {
          throw new Error(response.error);
        }

        if (!response?.processId) {
          throw new Error('No se recibio el identificador del proceso de escaneo');
        }

        processId = response.processId;
        this.markProcessStarted(processId);
        this.onProcessStarted(processId);
        this.render();

        stageEl.textContent = 'Escaneando';
        messageEl.textContent = 'Escaneo activo. Monitorizando salida del detector de puertos...';

        const exitPayload = await new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve({ type: 'exit', processId, code: -1, timeout: true });
          }, 180000);

          terminalUnsub = this.api.events.onTerminalData((payload) => {
            if (!payload || payload.processId !== processId) {
              return;
            }

            if (payload.type === 'stdout') {
              processStdoutChunk(payload.text || '');
              return;
            }

            if (payload.type === 'stderr' || payload.type === 'error') {
              stageEl.textContent = 'Atencion';
              messageEl.textContent = payload.text || payload.message || 'Error durante la inspeccion de puertos.';
              return;
            }

            if (payload.type === 'exit') {
              clearTimeout(timeoutId);
              resolve(payload);
            }
          });
        });

        isRunning = false;
        targetChecked = totalDangerPorts;

        const detectedCount = openPorts.size;
        const structuredOpenCount = Number(summaryData?.open_count);
        const effectiveOpenCount = Number.isInteger(structuredOpenCount)
          ? structuredOpenCount
          : (Number.isInteger(summaryOpenPorts) ? Math.max(summaryOpenPorts, detectedCount) : detectedCount);

        const structuredPublicCount = Number(summaryData?.public_count);
        const effectivePublicCount = Number.isInteger(structuredPublicCount)
          ? structuredPublicCount
          : Array.from(findingsByPort.values()).filter((item) => item.scope === 'PUBLIC').length;

        const structuredHighCount = Number(summaryData?.high_count);
        const effectiveHighCount = Number.isInteger(structuredHighCount)
          ? structuredHighCount
          : Array.from(findingsByPort.values()).filter((item) => item.risk === 'HIGH').length;

        const finalPortsText = formatFinalPorts();

        openEl.textContent = String(effectiveOpenCount);
        updateRiskStateFromFindings();
        progressEl.style.width = '100%';
        renderOpenPorts();

        if (exitPayload?.timeout) {
          stageEl.textContent = 'Timeout';
          messageEl.textContent = 'El escaneo tardo demasiado. Revisa la terminal para mas detalles.';
          titleEl.style.color = '#f7768e';
          topBarEl.style.background = 'linear-gradient(90deg,#f7768e,#ff9e64)';
          progressEl.style.background = 'linear-gradient(90deg,#f7768e,#ff9e64)';
          await new Promise((resolve) => setTimeout(resolve, 2300));
          return;
        }

        if (Number(exitPayload?.code) !== 0) {
          stageEl.textContent = 'Error';
          messageEl.textContent = 'El detector de puertos finalizo con errores. Consulta la terminal.';
          titleEl.style.color = '#f7768e';
          topBarEl.style.background = 'linear-gradient(90deg,#f7768e,#ff9e64)';
          progressEl.style.background = 'linear-gradient(90deg,#f7768e,#ff9e64)';
          await new Promise((resolve) => setTimeout(resolve, 2300));
          return;
        }

        if (effectiveOpenCount > 0) {
          scanCompleted = true;

          if (effectivePublicCount > 0) {
            const highRisk = effectiveHighCount > 0;
            stageEl.textContent = highRisk ? 'Riesgo Alto' : 'Riesgo Medio';
            messageEl.textContent = `Puertos finales: ${finalPortsText}. ${effectivePublicCount} estan expuestos en red y requieren revision.`;
            titleEl.style.color = highRisk ? '#f7768e' : '#e0af68';
            topBarEl.style.background = highRisk
              ? 'linear-gradient(90deg,#f7768e,#ff9e64)'
              : 'linear-gradient(90deg,#e0af68,#ff9e64)';
            progressEl.style.background = highRisk
              ? 'linear-gradient(90deg,#f7768e,#ff9e64)'
              : 'linear-gradient(90deg,#e0af68,#ff9e64)';
          } else {
            stageEl.textContent = 'Solo Local';
            messageEl.textContent = `Puertos finales: ${finalPortsText}. Estan abiertos solo en local, riesgo externo bajo.`;
            titleEl.style.color = '#9ece6a';
            topBarEl.style.background = 'linear-gradient(90deg,#9ece6a,#73daca)';
            progressEl.style.background = 'linear-gradient(90deg,#9ece6a,#73daca)';
            riskEl.textContent = 'LOW';
            riskEl.style.color = '#9ece6a';
          }

          renderMitigationActions();
          updateGlobalButtons();
          await waitForManualClose();
          return;
        }

        stageEl.textContent = 'Sistema Blindado';
        messageEl.textContent = 'No se detectaron puertos peligrosos abiertos en este escaneo local. Puertos finales: ninguno.';
        titleEl.style.color = '#9ece6a';
        topBarEl.style.background = 'linear-gradient(90deg,#9ece6a,#73daca)';
        progressEl.style.background = 'linear-gradient(90deg,#9ece6a,#73daca)';
        riskEl.textContent = 'LOW';
        riskEl.style.color = '#9ece6a';
        await new Promise((resolve) => setTimeout(resolve, 1800));
      } finally {
        isRunning = false;

        if (terminalUnsub) {
          terminalUnsub();
        }

        if (progressTimer) {
          clearInterval(progressTimer);
        }

        if (modal && modal.parentNode) {
          modal.style.opacity = '0';
          modal.style.transform = 'scale(0.97)';
          await new Promise((resolve) => setTimeout(resolve, 320));
          if (modal.parentNode) {
            modal.remove();
          }
        }

        if (cardActions) {
          cardActions.style.display = oldActionsStyle;
        }
      }
    }

    /**
     * V3: Flujo visual para iniciar/detener Immich con progreso en vivo.
     * @param {HTMLElement} card
     * @param {boolean} shouldStart
     */
    async startVisualImmich(card, shouldStart = true) {
      if (!card) return;

      const cardActions = card.querySelector('.card-actions');
      const oldActionsStyle = cardActions ? cardActions.style.display : 'flex';
      if (cardActions) cardActions.style.display = 'none';

      let progressUnsub = null;
      let modal = null;

      try {
        modal = document.createElement('div');
        Object.assign(modal.style, {
          position: 'fixed', inset: '0', zIndex: '999999',
          background: GLASS_MODAL_OVERLAY, backdropFilter: 'blur(20px) saturate(180%)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontFamily: '"SF Pro Display", "Space Grotesk", "Segoe UI", sans-serif',
          transition: `opacity 0.42s ${APPLE_EASE}, transform 0.42s ${APPLE_EASE}`,
          opacity: '0',
          transform: 'scale(0.95)'
        });

        const accentColor = shouldStart ? '#7aa2f7' : '#f7768e';
        const doneColor = '#9ece6a';

        modal.innerHTML = `
          <div style="background:linear-gradient(160deg, rgba(28,35,52,0.78), rgba(16,21,32,0.86));border:1px solid rgba(255,255,255,0.18);border-radius:24px;padding:36px;width:620px;max-width:90vw;box-shadow:0 24px 70px rgba(3,8,20,.52), inset 0 1px 0 rgba(255,255,255,0.14);backdrop-filter:blur(20px) saturate(180%);position:relative;overflow:hidden;">
            <div id="immich-top-bar" style="position:absolute;top:0;left:0;right:0;height:4px;background:${accentColor};box-shadow:0 0 18px ${accentColor};"></div>
            <h2 id="immich-title" style="margin:0 0 18px 0;color:${accentColor};font-size:30px;letter-spacing:2px;text-transform:uppercase;font-weight:800;">
              ${shouldStart ? 'Arranque Immich' : 'Apagado Immich'}
            </h2>

            <div id="immich-stage" style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(122,162,247,.15);color:${accentColor};font-weight:700;font-size:12px;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">
              PREPARANDO
            </div>

            <div id="immich-message" style="color:#c0caf5;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px 16px;min-height:50px;line-height:1.35;margin-bottom:16px;">
              ${shouldStart ? 'Inicializando secuencia de despliegue...' : 'Inicializando secuencia de apagado...'}
            </div>

            <div style="height:12px;background:rgba(0,0,0,.55);border-radius:999px;overflow:hidden;">
              <div id="immich-progress" style="height:100%;width:8%;background:linear-gradient(90deg, ${accentColor}, #7dcfff);box-shadow:0 0 16px ${accentColor};transition:width .35s ${APPLE_EASE};"></div>
            </div>

            <div style="margin-top:12px;color:#a9b1d6;font-size:12px;letter-spacing:.8px;text-transform:uppercase;">Docker + WSL Orchestrator</div>
          </div>
        `;

        document.body.appendChild(modal);
        requestAnimationFrame(() => {
          modal.style.opacity = '1';
          modal.style.transform = 'scale(1)';
        });

        const stageEl = modal.querySelector('#immich-stage');
        const messageEl = modal.querySelector('#immich-message');
        const progressEl = modal.querySelector('#immich-progress');
        const titleEl = modal.querySelector('#immich-title');
        const topBarEl = modal.querySelector('#immich-top-bar');

        const startSteps = {
          checking: { pct: 14, stage: 'CHECKING', label: 'Verificando carpeta y prerequisitos...' },
          checking_engine: { pct: 28, stage: 'DOCKER', label: 'Comprobando estado del motor Docker...' },
          waking_engine: { pct: 44, stage: 'WAKE', label: 'Despertando Docker Desktop...' },
          waking_engine_wait: { pct: 58, stage: 'WAIT', label: 'Esperando confirmación del motor...' },
          deploying: { pct: 84, stage: 'DEPLOY', label: 'Levantando contenedores de Immich...' },
          done: { pct: 100, stage: 'ONLINE', label: 'Servidor Immich operativo.' }
        };

        const stopSteps = {
          checking: { pct: 20, stage: 'CHECKING', label: 'Verificando estado del motor Docker...' },
          stopping: { pct: 55, stage: 'STOPPING', label: 'Apagando contenedores activos...' },
          killing_engine: { pct: 82, stage: 'PURGE', label: 'Cerrando Docker y liberando VmmemWSL...' },
          done: { pct: 100, stage: 'OFFLINE', label: 'Servicios detenidos y memoria liberada.' }
        };

        const stepMap = shouldStart ? startSteps : stopSteps;

        const applyStep = (status, text) => {
          const step = stepMap[status] || {};
          if (typeof step.pct === 'number') {
            progressEl.style.width = `${step.pct}%`;
          }
          stageEl.textContent = step.stage || String(status || 'PROCESSING').toUpperCase();
          messageEl.textContent = text || step.label || 'Procesando...';
        };

        applyStep('checking');

        if (window.horus?.events?.onSystemProgress) {
          progressUnsub = window.horus.events.onSystemProgress((data) => {
            if (!data || !data.status || !stepMap[data.status]) {
              return;
            }
            applyStep(data.status, data.text);
          });
        }

        if (shouldStart) {
          await window.horus.system.startImmich();
        } else {
          await window.horus.system.stopImmich();
        }

        progressEl.style.width = '100%';
        progressEl.style.background = `linear-gradient(90deg, ${doneColor}, #73daca)`;
        progressEl.style.boxShadow = `0 0 16px ${doneColor}`;
        stageEl.textContent = 'COMPLETADO';
        stageEl.style.background = 'rgba(158,206,106,.18)';
        stageEl.style.color = doneColor;
        messageEl.textContent = shouldStart
          ? 'Immich en línea. Docker quedó listo para recibir tráfico.'
          : 'Immich detenido. Docker y VmmemWSL fueron purgados.';
        messageEl.style.color = '#9ece6a';
        titleEl.style.color = doneColor;
        topBarEl.style.background = doneColor;
        topBarEl.style.boxShadow = `0 0 18px ${doneColor}`;

        await new Promise((resolve) => setTimeout(resolve, 1300));
      } catch (error) {
        if (modal) {
          const stageEl = modal.querySelector('#immich-stage');
          const messageEl = modal.querySelector('#immich-message');
          const progressEl = modal.querySelector('#immich-progress');
          const titleEl = modal.querySelector('#immich-title');
          const topBarEl = modal.querySelector('#immich-top-bar');

          if (stageEl) {
            stageEl.textContent = 'ERROR';
            stageEl.style.background = 'rgba(247,118,142,.18)';
            stageEl.style.color = '#f7768e';
          }

          if (messageEl) {
            messageEl.textContent = error?.message || 'No se pudo completar la operación de Immich.';
            messageEl.style.color = '#f7768e';
          }

          if (progressEl) {
            progressEl.style.background = 'linear-gradient(90deg, #f7768e, #ff9e64)';
          }

          if (titleEl) {
            titleEl.style.color = '#f7768e';
          }

          if (topBarEl) {
            topBarEl.style.background = '#f7768e';
            topBarEl.style.boxShadow = '0 0 18px #f7768e';
          }

          await new Promise((resolve) => setTimeout(resolve, 2800));
        }

        throw error;
      } finally {
        if (progressUnsub) {
          progressUnsub();
        }

        if (modal && modal.parentNode) {
          modal.style.opacity = '0';
          modal.style.transform = 'scale(0.97)';
          await new Promise((resolve) => setTimeout(resolve, 320));
          if (modal.parentNode) modal.remove();
        }

        if (cardActions) {
          cardActions.style.display = oldActionsStyle;
        }
      }
    }
}
