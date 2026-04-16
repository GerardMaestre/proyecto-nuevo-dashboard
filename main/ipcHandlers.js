const { ipcMain } = require('electron');

const { AppManager } = require('./systems/appManager');
const { DiskManager } = require('./systems/diskManager');
const { NetworkRadar } = require('./systems/networkRadar');
const { RemoteServer } = require('./systems/remoteServer');
const { TelemetryManager } = require('./systems/telemetryManager');
const { Scheduler } = require('./autopilot/scheduler');
const { TaskQueue } = require('./autopilot/queue');
const { createLogger } = require('./utils/logger');
const { ProcessManager } = require('./utils/processManager');
const { elevateWithUac } = require('./utils/uac');

const logger = createLogger('ipc');

function registerInvokeHandler(channel, handler) {
  ipcMain.removeHandler(channel);

  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return await handler(payload);
    } catch (error) {
      logger.error(`IPC invoke failed on ${channel}`, error);
      throw new Error(error.message || `Failed IPC invoke on channel ${channel}`);
    }
  });
}

function registerIpcHandlers({ getMainWindow, onRequestQuit }) {
  const sendToRenderer = (channel, payload) => {
    const win = getMainWindow();

    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  };

  const processManager = new ProcessManager({ sendToRenderer, logger });
  const telemetryManager = new TelemetryManager({ logger });
  const networkRadar = new NetworkRadar({ logger });
  const diskManager = new DiskManager({ logger });
  const appManager = new AppManager({ logger });
  const queue = new TaskQueue();
  const scheduler = new Scheduler({
    queue,
    logger,
    processManager,
    onTaskEvent: (event) => sendToRenderer('autopilot:event', event)
  });
  const remoteServer = new RemoteServer({ logger, sendToRenderer });

  processManager.on('process:stdout', (payload) => {
    sendToRenderer('terminal:data', {
      type: 'stdout',
      ...payload
    });
  });

  processManager.on('process:stderr', (payload) => {
    sendToRenderer('terminal:data', {
      type: 'stderr',
      ...payload
    });
  });

  processManager.on('process:exit', (payload) => {
    sendToRenderer('terminal:data', {
      type: 'exit',
      ...payload
    });
  });

  processManager.on('process:error', (payload) => {
    sendToRenderer('terminal:data', {
      type: 'error',
      ...payload
    });
  });

  telemetryManager.on('telemetry:update', (snapshot) => {
    sendToRenderer('telemetry:update', snapshot);
  });

  networkRadar.on('network:update', (snapshot) => {
    sendToRenderer('network:update', snapshot);
  });

  networkRadar.on('network:threat', (threat) => {
    sendToRenderer('network:threat', threat);
  });

  scheduler.on('autopilot:event', (event) => {
    sendToRenderer('autopilot:event', event);
  });

  registerInvokeHandler('scripts:list', () => processManager.listScripts());
  registerInvokeHandler('scripts:run', (payload) => processManager.runScript(payload || {}));
  registerInvokeHandler('scripts:stop', (payload) => processManager.stopProcess(payload?.processId));

  registerInvokeHandler('telemetry:get-snapshot', () => telemetryManager.getSnapshot());
  registerInvokeHandler('telemetry:start-stream', () => telemetryManager.start());
  registerInvokeHandler('telemetry:stop-stream', () => telemetryManager.stop());

  registerInvokeHandler('network:get-snapshot', () => networkRadar.getSnapshot());
  registerInvokeHandler('network:start-monitoring', () => networkRadar.startMonitoring());
  registerInvokeHandler('network:stop-monitoring', () => networkRadar.stopMonitoring());
  registerInvokeHandler('network:get-blacklist', () => networkRadar.getBlacklist());

  registerInvokeHandler('disk:get-summary', () => diskManager.getSummary());
  registerInvokeHandler('disk:scan-mft', (payload) => diskManager.scanMft(payload));

  registerInvokeHandler('apps:list', () => appManager.getInstalledApplications());
  registerInvokeHandler('apps:find-duplicates', () => appManager.findDuplicateApplications());

  registerInvokeHandler('uac:elevate-command', async (payload) => {
    if (!payload?.command) {
      throw new Error('Command is required to elevate privileges');
    }

    return elevateWithUac(payload.command, payload.options || {});
  });

  registerInvokeHandler('autopilot:add-task', (task) => scheduler.addTask(task));
  registerInvokeHandler('autopilot:remove-task', (payload) => scheduler.removeTask(payload?.id));
  registerInvokeHandler('autopilot:list-tasks', () => scheduler.listTasks());

  registerInvokeHandler('remote:server:start', (payload) => remoteServer.start(payload));
  registerInvokeHandler('remote:server:stop', () => remoteServer.stop());
  registerInvokeHandler('remote:server:status', () => remoteServer.status());

  ipcMain.removeAllListeners('window:minimize');
  ipcMain.removeAllListeners('window:toggle-maximize');
  ipcMain.removeAllListeners('window:close');

  ipcMain.on('window:minimize', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.minimize();
    }
  });

  ipcMain.on('window:toggle-maximize', () => {
    const win = getMainWindow();

    if (!win || win.isDestroyed()) {
      return;
    }

    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    onRequestQuit();
  });

  telemetryManager.start();
  networkRadar.startMonitoring();
  scheduler.start();

  logger.info('IPC handlers registered');

  return () => {
    telemetryManager.stop();
    networkRadar.stopMonitoring();
    scheduler.stop();
    processManager.stopAll();
    remoteServer.stop();

    ipcMain.removeAllListeners('window:minimize');
    ipcMain.removeAllListeners('window:toggle-maximize');
    ipcMain.removeAllListeners('window:close');

    const invokeChannels = [
      'scripts:list',
      'scripts:run',
      'scripts:stop',
      'telemetry:get-snapshot',
      'telemetry:start-stream',
      'telemetry:stop-stream',
      'network:get-snapshot',
      'network:start-monitoring',
      'network:stop-monitoring',
      'network:get-blacklist',
      'disk:get-summary',
      'disk:scan-mft',
      'apps:list',
      'apps:find-duplicates',
      'uac:elevate-command',
      'autopilot:add-task',
      'autopilot:remove-task',
      'autopilot:list-tasks',
      'remote:server:start',
      'remote:server:stop',
      'remote:server:status'
    ];

    for (const channel of invokeChannels) {
      ipcMain.removeHandler(channel);
    }

    logger.info('IPC handlers cleaned up');
  };
}

module.exports = {
  registerIpcHandlers
};
