const fs = require('fs');
let c = fs.readFileSync('src/renderer/components/ScriptList.js', 'utf8');

if (!c.includes('startVisualDuplicates')) {
  c = c.replace(/}\s*$/, 
  /**
   * V3: Animacion en vivo para la busqueda de Duplicados
   */
  async startVisualDuplicates(card) {
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

      modal.innerHTML = \<div style="background: #1a1b26; border: 1px solid #3b4261; border-radius: 20px; padding: 50px; width: 650px; max-width: 90vw; box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.9); position: relative; overflow: hidden; box-sizing: border-box; text-align: center; transition: all 0.5s ease;"><div style="position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #ff9e64, #e0af68, #ffc777); box-shadow: 0 0 20px rgba(255, 158, 100, 0.8); transition: background 0.5s ease;" id="v3d-gradient-top"></div><div style="width: 100px; height: 100px; border-radius: 50%; border: 3px dashed #ff9e64; margin: 0 auto 30px; display: flex; align-items: center; justify-content: center; transition: border-color 0.5s ease; animation: v3d-spin-slow 8s linear infinite;" id="v3d-ring"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 44px; height: 44px; stroke: #ff9e64; transition: stroke 0.5s ease; animation: v3d-pulse-glow 1.5s ease-in-out infinite alternate;" id="v3d-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></div><h2 style="color: #ff9e64; margin: 0 0 35px 0; font-size: 32px; text-transform: uppercase; letter-spacing: 4px; font-weight: 800; text-shadow: 0 0 15px rgba(255, 158, 100, 0.4);" id="v3d-title">CAZANDO DUPLICADOS</h2><div style="display: flex; justify-content: space-between; margin: 0 0 35px 0; background: rgba(0,0,0,0.5); padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 0 20px rgba(0,0,0,0.5);"><div style="width: 50%; border-right: 1px solid rgba(255,255,255,0.1);"><div style="color: #a9b1d6; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-weight: 600;">Clones Aislados</div><div id="v3d-files-count" style="color: white; font-size: 54px; font-weight: 900; font-family: Consolas, monospace; text-shadow: 0 0 15px rgba(255,255,255,0.3); transition: color 0.3s;">0</div></div><div style="width: 50%;"><div style="color: #a9b1d6; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-weight: 600;">Espacio Recuperado</div><div id="v3d-mb-freed" style="color: #e0af68; font-size: 54px; font-weight: 900; font-family: Consolas, monospace; text-shadow: 0 0 15px rgba(224,175,104,0.4); transition: color 0.3s;">0.00</div></div></div><div id="v3d-current-file" style="color: #ffc777; font-size: 14px; font-family: Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 25px; text-align: left; background: rgba(0,0,0,0.4); padding: 15px 20px; border-radius: 10px; border-left: 4px solid #ff9e64; transition: border-color 0.3s, color 0.3s;">Escaneando sectores de disco...</div><div style="height: 12px; background: rgba(0,0,0,0.6); border-radius: 6px; overflow: hidden; position: relative;"><div id="v3d-progress-bar" style="width: 2%; height: 100%; background: linear-gradient(90deg, #ff9e64, #e0af68); box-shadow: 0 0 20px rgba(255, 158, 100, 0.9); transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);"></div></div></div><style>@keyframes v3d-spin-slow { 100% { transform: rotate(360deg); } } @keyframes v3d-pulse-glow { 0% { filter: drop-shadow(0 0 5px rgba(255,158,100,0.5)); } 100% { filter: drop-shadow(0 0 15px rgba(255,158,100,1)); } }</style>\;

      document.body.appendChild(modal);
      requestAnimationFrame(() => { modal.style.opacity = '1'; modal.style.transform = 'scale(1)'; });

      const filesCountEl = modal.querySelector('#v3d-files-count');
      const mbFreedEl = modal.querySelector('#v3d-mb-freed');
      const currentFileEl = modal.querySelector('#v3d-current-file');
      const progressBarEl = modal.querySelector('#v3d-progress-bar');
      const ringEl = modal.querySelector('#v3d-ring');
      const iconEl = modal.querySelector('#v3d-icon');
      const titleEl = modal.querySelector('#v3d-title');
      const gradientTopEl = modal.querySelector('#v3d-gradient-top');

      let isScanning = true;
      let virtualProgress = 2;
      let visFiles = 0; let visMB = 0;
      let targetFiles = 0; let targetMB = 0;

      const progressTimer = setInterval(() => {
        if (!isScanning) return;
        virtualProgress += (95 - virtualProgress) * 0.05;
        progressBarEl.style.width = virtualProgress + '%';
        visFiles += (targetFiles - visFiles) * 0.1;
        visMB += (targetMB - visMB) * 0.1;
        filesCountEl.textContent = Math.round(visFiles);
        if (visMB > 1000) { mbFreedEl.textContent = (visMB / 1024).toFixed(2) + ' GB'; } else { mbFreedEl.textContent = visMB.toFixed(2) + ' MB'; }
      }, 30);

      this.duplicatesProgressUnsub = window.horus.events.onSystemProgress((data) => {
        if (!data) return;
        if (data.status === 'scanning' || data.status === 'hashing' || data.status === 'moving') {
          targetFiles = data.duplicatesCount || 0;
          targetMB = parseFloat(data.totalFreedMB) || 0;
          let actionStr = 'Scn: ';
          if (data.status === 'hashing') actionStr = 'Hash: ';
          if (data.status === 'moving') actionStr = 'Aisl: ';
          currentFileEl.textContent = actionStr + (data.file || data.folder || '...');
        }
      });

      const result = await window.horus.system.findDuplicates();

      clearInterval(progressTimer);
      isScanning = false;

      if (result && result.success) {
        if (result.freedMB !== undefined) { targetMB = parseFloat(result.freedMB) || targetMB; targetFiles = result.duplicatesCount || targetFiles; } else if (result.totalFreedMB !== undefined) { targetMB = parseFloat(result.totalFreedMB) || targetMB; targetFiles = result.duplicatesCount || targetFiles; }
      }

      filesCountEl.textContent = targetFiles;
      if (targetMB > 1000) { mbFreedEl.textContent = (targetMB / 1024).toFixed(2) + ' GB'; } else { mbFreedEl.textContent = targetMB.toFixed(2) + ' MB'; }

      currentFileEl.textContent = targetFiles > 0 ? '¡Clones aislados en Cuarentena!' : 'No hay duplicados (Limpio)';
      currentFileEl.style.color = '#9ece6a'; currentFileEl.style.borderLeftColor = '#9ece6a';
      progressBarEl.style.width = '100%'; progressBarEl.style.background = '#9ece6a'; progressBarEl.style.boxShadow = '0 0 25px rgba(158,206,106,0.9)';
      ringEl.style.borderColor = '#9ece6a'; ringEl.style.animation = 'none';
      iconEl.style.stroke = '#9ece6a'; iconEl.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'; iconEl.style.animation = 'none';
      titleEl.textContent = 'BÚSQUEDA EXITOSA'; titleEl.style.color = '#9ece6a'; titleEl.style.textShadow = '0 0 20px rgba(158,206,106,0.5)';
      gradientTopEl.style.background = '#9ece6a'; gradientTopEl.style.boxShadow = '0 0 20px rgba(158,206,106,0.8)';

      if (this.duplicatesProgressUnsub) { this.duplicatesProgressUnsub(); this.duplicatesProgressUnsub = null; }

      setTimeout(() => { modal.style.opacity = '0'; modal.style.transform = 'scale(1.05)'; setTimeout(() => { if (modal.parentNode) modal.remove(); if (cardActions) cardActions.style.display = oldActionsStyle; }, 500); }, 4000);

    } catch (err) {
      console.error('Critical modal error', err);
      if (cardActions) cardActions.style.display = oldActionsStyle;
    }
  }
}
);
  fs.writeFileSync('src/renderer/components/ScriptList.js', c);
  console.log('PATCHED!');
}
