import { bridge } from './hybridBridge.js';

export function registerIpcListeners(handlers = {}) {
  const mapping = {
    'terminal:data': handlers.onTerminalData,
    'telemetry:update': handlers.onTelemetryUpdate,
    'network:update': handlers.onNetworkUpdate,
    'network:threat': handlers.onNetworkThreat,
    'autopilot:event': handlers.onAutopilotEvent,
    'remote:server:event': handlers.onRemoteEvent
  };

  const attached = [];

  for (const [channel, handler] of Object.entries(mapping)) {
    if (typeof handler !== 'function') {
      continue;
    }

    bridge.on(channel, handler);
    attached.push({ channel, handler });
  }

  return () => {
    for (const item of attached) {
      bridge.off(item.channel, item.handler);
    }
  };
}
