const { registerIpcHandlers } = require('../../../main/ipcHandlers');

/**
 * Registers all IPC channels used by Dashboard V2.
 *
 * This function delegates to the existing backend handlers while the
 * migration to fully native src/main services continues.
 *
 * @param {{
 *  getMainWindow: () => import('electron').BrowserWindow | null,
 *  onRequestQuit: () => void
 * }} options
 * @returns {() => void}
 */
function registerMainIpcHandlers(options) {
  return registerIpcHandlers(options);
}

module.exports = {
  registerMainIpcHandlers
};
