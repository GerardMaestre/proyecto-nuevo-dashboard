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
    byId('btn-minimize')?.addEventListener('click', () => {
      this.api.window.minimize();
    });

    byId('btn-maximize')?.addEventListener('click', () => {
      this.api.window.toggleMaximize();
    });

    byId('btn-close')?.addEventListener('click', () => {
      this.api.window.close();
    });
  }
}
