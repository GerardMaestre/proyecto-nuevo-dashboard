const path = require('path');
const { app, BrowserWindow } = require('electron');

const { registerIpcHandlers } = require('./ipcHandlers');
const { createTrayIcon } = require('./ui/trayIcon');
const { createLogger } = require('./utils/logger');

const logger = createLogger('main');

let mainWindow;
let cleanupIpc;
let tray;
let isQuitting = false;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    transparent: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true
    }
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'index.html')).catch((error) => {
    logger.error('Failed to load renderer HTML', error);
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('minimize', (event) => {
    event.preventDefault();
    win.hide();
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

function restoreMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
}

function initializeApplication() {
  mainWindow = createMainWindow();

  cleanupIpc = registerIpcHandlers({
    getMainWindow: () => mainWindow,
    onRequestQuit: () => {
      isQuitting = true;
      app.quit();
    }
  });

  tray = createTrayIcon({
    app,
    onShow: restoreMainWindow,
    onQuit: () => {
      isQuitting = true;
      app.quit();
    }
  });

  logger.info('Application initialized');
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    restoreMainWindow();
  });

  app.whenReady().then(() => {
    initializeApplication();
  });
}

app.on('before-quit', () => {
  isQuitting = true;

  if (cleanupIpc) {
    cleanupIpc();
  }

  if (tray) {
    tray.destroy();
  }
});

app.on('window-all-closed', (event) => {
  if (!isQuitting) {
    event.preventDefault();
  }
});

app.on('activate', () => {
  restoreMainWindow();
});
