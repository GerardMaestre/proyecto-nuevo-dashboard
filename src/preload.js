const { contextBridge, ipcRenderer } = require('electron');

const allowedSendChannels = new Set([
  'window:minimize',
  'window:toggle-maximize',
  'window:close'
]);

const allowedInvokeChannels = new Set([
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
]);

const allowedReceiveChannels = new Set([
  'terminal:data',
  'telemetry:update',
  'network:update',
  'network:threat',
  'autopilot:event',
  'remote:server:event'
]);

const listenerRegistry = new Map();

function send(channel, data) {
  if (allowedSendChannels.has(channel)) {
    ipcRenderer.send(channel, data);
  }
}

function invoke(channel, data) {
  if (!allowedInvokeChannels.has(channel)) {
    return Promise.reject(new Error(`Channel not allowed: ${channel}`));
  }

  return ipcRenderer.invoke(channel, data);
}

function receive(channel, func) {
  if (!allowedReceiveChannels.has(channel) || typeof func !== 'function') {
    return;
  }

  let channelListeners = listenerRegistry.get(channel);

  if (!channelListeners) {
    channelListeners = new WeakMap();
    listenerRegistry.set(channel, channelListeners);
  }

  if (channelListeners.has(func)) {
    return;
  }

  const wrapped = (_event, payload) => func(payload);

  channelListeners.set(func, wrapped);
  ipcRenderer.on(channel, wrapped);
}

function removeListener(channel, func) {
  const channelListeners = listenerRegistry.get(channel);

  if (!channelListeners || typeof func !== 'function') {
    return;
  }

  const wrapped = channelListeners.get(func);

  if (!wrapped) {
    return;
  }

  ipcRenderer.removeListener(channel, wrapped);
  channelListeners.delete(func);
}

contextBridge.exposeInMainWorld('api', {
  send,
  receive,
  invoke,
  removeListener
});
