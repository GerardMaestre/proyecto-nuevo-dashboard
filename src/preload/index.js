const { contextBridge, ipcRenderer } = require('electron');

/**
 * @typedef {{
 *  scriptId?: string,
 *  scriptName?: string,
 *  args?: string[],
 *  elevated?: boolean
 * }} RunScriptRequest
 */

/**
 * @typedef {(payload: any) => void} EventHandler
 */

const CHANNELS = Object.freeze({
  invoke: {
    scriptsList: 'scripts:list',
    scriptsRun: 'scripts:run',
    scriptsStop: 'scripts:stop',
    telemetryStart: 'telemetry:start-stream',
    telemetryStop: 'telemetry:stop-stream',
    telemetrySnapshot: 'telemetry:get-snapshot',
    networkStart: 'network:start-monitoring',
    networkStop: 'network:stop-monitoring',
    networkSnapshot: 'network:get-snapshot',
    autopilotList: 'autopilot:list-tasks',
    autopilotAdd: 'autopilot:add-task',
    autopilotRemove: 'autopilot:remove-task',
    remoteStart: 'remote:server:start',
    remoteStop: 'remote:server:stop',
    remoteStatus: 'remote:server:status'
  },
  send: {
    minimize: 'window:minimize',
    maximize: 'window:toggle-maximize',
    close: 'window:close'
  },
  receive: {
    terminalData: 'terminal:data',
    telemetryUpdate: 'telemetry:update',
    networkUpdate: 'network:update',
    networkThreat: 'network:threat',
    autopilotEvent: 'autopilot:event',
    remoteEvent: 'remote:server:event'
  }
});

/**
 * @param {string} value
 * @returns {string}
 */
function safeString(value) {
  return String(value || '').trim();
}

/**
 * @param {any} value
 * @returns {string[]}
 */
function safeArgs(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((arg) => safeString(arg))
    .filter(Boolean)
    .slice(0, 16);
}

/**
 * @param {EventHandler} handler
 * @returns {EventHandler}
 */
function ensureHandler(handler) {
  return typeof handler === 'function' ? handler : () => {};
}

/**
 * Subscribes to a validated IPC receive channel.
 * @param {string} channel
 * @param {EventHandler} handler
 * @returns {() => void}
 */
function subscribe(channel, handler) {
  const safeHandler = ensureHandler(handler);
  const wrapped = (_event, payload) => safeHandler(payload);
  ipcRenderer.on(channel, wrapped);

  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

/**
 * Sanitizes run payload so renderer never sends raw objects.
 * @param {RunScriptRequest} payload
 * @returns {RunScriptRequest}
 */
function normalizeRunPayload(payload = {}) {
  return {
    scriptId: safeString(payload.scriptId),
    scriptName: safeString(payload.scriptName),
    args: safeArgs(payload.args),
    elevated: Boolean(payload.elevated)
  };
}

const api = Object.freeze({
  window: Object.freeze({
    minimize() {
      ipcRenderer.send(CHANNELS.send.minimize);
    },
    toggleMaximize() {
      ipcRenderer.send(CHANNELS.send.maximize);
    },
    close() {
      ipcRenderer.send(CHANNELS.send.close);
    }
  }),
  scripts: Object.freeze({
    list() {
      return ipcRenderer.invoke(CHANNELS.invoke.scriptsList);
    },
    run(payload) {
      return ipcRenderer.invoke(CHANNELS.invoke.scriptsRun, normalizeRunPayload(payload));
    },
    stop(processId) {
      return ipcRenderer.invoke(CHANNELS.invoke.scriptsStop, { processId: safeString(processId) });
    }
  }),
  telemetry: Object.freeze({
    start() {
      return ipcRenderer.invoke(CHANNELS.invoke.telemetryStart);
    },
    stop() {
      return ipcRenderer.invoke(CHANNELS.invoke.telemetryStop);
    },
    snapshot() {
      return ipcRenderer.invoke(CHANNELS.invoke.telemetrySnapshot);
    }
  }),
  network: Object.freeze({
    start() {
      return ipcRenderer.invoke(CHANNELS.invoke.networkStart);
    },
    stop() {
      return ipcRenderer.invoke(CHANNELS.invoke.networkStop);
    },
    snapshot() {
      return ipcRenderer.invoke(CHANNELS.invoke.networkSnapshot);
    }
  }),
  autopilot: Object.freeze({
    list() {
      return ipcRenderer.invoke(CHANNELS.invoke.autopilotList);
    },
    add(task) {
      return ipcRenderer.invoke(CHANNELS.invoke.autopilotAdd, task || {});
    },
    remove(id) {
      return ipcRenderer.invoke(CHANNELS.invoke.autopilotRemove, { id: safeString(id) });
    }
  }),
  remote: Object.freeze({
    start(payload) {
      return ipcRenderer.invoke(CHANNELS.invoke.remoteStart, payload || {});
    },
    stop() {
      return ipcRenderer.invoke(CHANNELS.invoke.remoteStop);
    },
    status() {
      return ipcRenderer.invoke(CHANNELS.invoke.remoteStatus);
    }
  }),
  events: Object.freeze({
    onTerminalData(handler) {
      return subscribe(CHANNELS.receive.terminalData, handler);
    },
    onTelemetryUpdate(handler) {
      return subscribe(CHANNELS.receive.telemetryUpdate, handler);
    },
    onNetworkUpdate(handler) {
      return subscribe(CHANNELS.receive.networkUpdate, handler);
    },
    onNetworkThreat(handler) {
      return subscribe(CHANNELS.receive.networkThreat, handler);
    },
    onAutopilotEvent(handler) {
      return subscribe(CHANNELS.receive.autopilotEvent, handler);
    },
    onRemoteEvent(handler) {
      return subscribe(CHANNELS.receive.remoteEvent, handler);
    }
  })
});

contextBridge.exposeInMainWorld('horus', api);
