import { byId } from '../core/utils.js';
import { bridge } from '../renderer/hybridBridge.js';

export function initializeWindowSystem() {
  const pulse = (id) => {
    const button = byId(id);
    if (!button) {
      return;
    }
    button.classList.add('is-pressed');
    setTimeout(() => button.classList.remove('is-pressed'), 220);
  };

  byId('btn-minimize')?.addEventListener('click', () => {
    pulse('btn-minimize');
    bridge.send('window:minimize');
  });

  byId('btn-maximize')?.addEventListener('click', () => {
    pulse('btn-maximize');
    bridge.send('window:toggle-maximize');
  });

  byId('btn-close')?.addEventListener('click', () => {
    pulse('btn-close');
    bridge.send('window:close');
  });
}
