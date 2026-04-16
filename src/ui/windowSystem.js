import { byId } from '../core/utils.js';
import { bridge } from '../renderer/hybridBridge.js';

export function initializeWindowSystem() {
  byId('btn-minimize')?.addEventListener('click', () => {
    bridge.send('window:minimize');
  });

  byId('btn-maximize')?.addEventListener('click', () => {
    bridge.send('window:toggle-maximize');
  });

  byId('btn-close')?.addEventListener('click', () => {
    bridge.send('window:close');
  });
}
