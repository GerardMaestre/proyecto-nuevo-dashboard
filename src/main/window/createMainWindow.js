const path = require('path');
const { BrowserWindow } = require('electron');

/**
 * Creates the main BrowserWindow for Dashboard V2.
 * @param {{ onMinimizeToTray?: Function, onCloseToTray?: Function, logger?: any }} options
 * @returns {import('electron').BrowserWindow}
 */
function createMainWindow(options = {}) {
  const { onMinimizeToTray, onCloseToTray, logger } = options;

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    transparent: false,
    show: false,
    backgroundColor: '#1c1c1e',
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true
    }
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.loadFile(path.join(__dirname, '..', '..', 'assets', 'index.html')).catch((error) => {
    logger?.error('Failed to load V2 renderer HTML', error);
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('minimize', (event) => {
    event.preventDefault();
    onMinimizeToTray?.();
  });

  win.on('close', (event) => {
    if (onCloseToTray?.() === true) {
      event.preventDefault();
    }
  });

  return win;
}

/**
 * Restores and focuses the main window if hidden/minimized.
 * @param {import('electron').BrowserWindow | null} win
 */
function restoreMainWindow(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  if (!win.isVisible()) {
    win.show();
  }

  if (win.isMinimized()) {
    win.restore();
  }

  win.focus();
}

module.exports = {
  createMainWindow,
  restoreMainWindow
};
