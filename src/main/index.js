const { app } = require('electron');

const { registerMainIpcHandlers } = require('./ipc/registerHandlers');
const { createMainWindow, restoreMainWindow } = require('./window/createMainWindow');
const { createTrayIcon } = require('../../main/ui/trayIcon');
const { createLogger } = require('../../main/utils/logger');

const logger = createLogger('main-v2');

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;
/** @type {null | (() => void)} */
let cleanupIpc = null;
/** @type {import('electron').Tray | null} */
let tray = null;
let isQuitting = false;

/**
 * Initializes the V2 Electron lifecycle.
 */
function initializeApplication() {
  mainWindow = createMainWindow({
    logger,
    onMinimizeToTray: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }
    },
    onCloseToTray: () => {
      if (isQuitting) {
        return false;
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }

      return true;
    }
  });

  cleanupIpc = registerMainIpcHandlers({
    getMainWindow: () => mainWindow,
    onRequestQuit: () => {
      isQuitting = true;
      app.quit();
    }
  });

  tray = createTrayIcon({
    onShow: () => restoreMainWindow(mainWindow),
    onQuit: () => {
      isQuitting = true;
      app.quit();
    }
  });

  logger.info('Dashboard V2 initialized');
}

/**
 * Restores the current main window or creates it if needed.
 */
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow({
      logger,
      onMinimizeToTray: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.hide();
        }
      },
      onCloseToTray: () => {
        if (isQuitting) {
          return false;
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.hide();
        }

        return true;
      }
    });
  }

  restoreMainWindow(mainWindow);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    initializeApplication();
  });
}

app.on('before-quit', () => {
  isQuitting = true;

  if (cleanupIpc) {
    cleanupIpc();
    cleanupIpc = null;
  }

  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on('window-all-closed', (event) => {
  if (!isQuitting) {
    event.preventDefault();
  }
});

app.on('activate', () => {
  showMainWindow();
});
