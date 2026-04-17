import { byId } from '../lib/dom.js';

/**
 * Handles native window control buttons in the renderer.
 */
export class WindowControls {
  /**
   * @param {{ window: { minimize: Function, toggleMaximize: Function, close: Function } }} api
   */
  constructor(api) {
    this.api = api;
  }

  /**
   * Binds minimize, maximize and close events.
   */
  mount() {
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
      this.api.window.minimize();
    });

    byId('btn-maximize')?.addEventListener('click', () => {
      pulse('btn-maximize');
      this.api.window.toggleMaximize();
    });

    byId('btn-close')?.addEventListener('click', () => {
      pulse('btn-close');
      this.api.window.close();
    });
  }
}
