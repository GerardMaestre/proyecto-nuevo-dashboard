import { appState } from './core/state.js';
import { byId } from './core/utils.js';
import { SettingsManager } from './core/settingsManager.js';
import { NetworkMonitor } from './core/NetworkMonitor.js';
import { ThreatIntel } from './core/ThreatIntel.js';
import { AutopilotSystem } from './features/autopilotSystem.js';
import { DashboardSystem } from './features/dashboardSystem.js';
import { OjoDeDios } from './features/ojoDeDios.js';
import { bridge } from './renderer/hybridBridge.js';
import { registerIpcListeners } from './renderer/ipcListeners.js';
import { Spotlight } from './renderer/spotlight.js';
import { updateTelemetryWidgets } from './renderer/telemetry.js';
import { TerminalSystem } from './ui/terminalSystem.js';
import { ToastSystem } from './ui/toastSystem.js';
import { initializeWindowSystem } from './ui/windowSystem.js';

const runningProcesses = new Set();

function updateProcessCounter() {
  const element = byId('active-processes');
  if (element) {
    element.textContent = String(runningProcesses.size);
  }
}

function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');

  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-view');
      if (!target) {
        return;
      }

      navButtons.forEach((otherButton) => otherButton.classList.remove('active'));
      button.classList.add('active');

      document.querySelectorAll('.view').forEach((view) => {
        view.classList.remove('active');
      });

      byId(`view-${target}`)?.classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const settings = new SettingsManager();
  settings.get();

  const toast = new ToastSystem();
  const terminal = new TerminalSystem();
  const ojoDeDios = new OjoDeDios({ toast });
  const autopilot = new AutopilotSystem({ bridge, toast });
  const threatIntel = new ThreatIntel();
  const networkMonitor = new NetworkMonitor({ bridge });

  const dashboard = new DashboardSystem({
    bridge,
    toast,
    onScriptsLoaded: (scripts) => {
      autopilot.setScripts(scripts);
      spotlight.renderResults();
    },
    onProcessStarted: (processId) => {
      runningProcesses.add(processId);
      updateProcessCounter();
    }
  });

  const spotlight = new Spotlight({
    toast,
    getScripts: () => dashboard.getScripts(),
    onExecute: (script, elevated) => dashboard.executeScript(script, elevated)
  });

  setupNavigation();
  initializeWindowSystem();

  registerIpcListeners({
    onTerminalData: (payload) => {
      terminal.consumeProcessEvent(payload);

      if (payload?.processId && payload.type !== 'exit') {
        runningProcesses.add(payload.processId);
      }

      if (payload?.processId && payload.type === 'exit') {
        runningProcesses.delete(payload.processId);
      }

      updateProcessCounter();
    },
    onTelemetryUpdate: (snapshot) => {
      appState.setState({ telemetry: snapshot });
      updateTelemetryWidgets(snapshot);
    },
    onNetworkUpdate: (snapshot) => {
      const enriched = threatIntel.enrichSnapshot(snapshot);
      appState.setState({ network: enriched });
      ojoDeDios.render(enriched);
    },
    onNetworkThreat: (threatEvent) => {
      ojoDeDios.pushThreatNotification(threatEvent);
    },
    onAutopilotEvent: (event) => {
      autopilot.consumeEvent(event);

      if (event?.type === 'task-dispatched' && event?.process?.processId) {
        runningProcesses.add(event.process.processId);
        updateProcessCounter();
      }
    },
    onRemoteEvent: (event) => {
      if (event?.type === 'error') {
        toast.push({
          type: 'error',
          title: 'Remote Server',
          message: event.message || 'Error desconocido'
        });
      }
    }
  });

  try {
    await Promise.all([
      bridge.invoke('telemetry:start-stream'),
      networkMonitor.start(),
      dashboard.initialize(),
      autopilot.initialize()
    ]);

    const [telemetrySnapshot, networkSnapshot] = await Promise.all([
      bridge.invoke('telemetry:get-snapshot'),
      networkMonitor.getSnapshot()
    ]);

    updateTelemetryWidgets(telemetrySnapshot);
    ojoDeDios.render(threatIntel.enrichSnapshot(networkSnapshot));
  } catch (error) {
    terminal.write(`Error de inicializacion: ${error.message}`, 'stderr');
    toast.push({
      type: 'error',
      title: 'Inicializacion fallida',
      message: error.message
    });
  }
});
