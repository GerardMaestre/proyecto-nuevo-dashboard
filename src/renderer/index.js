import { ScriptList } from './components/ScriptList.js';
import { Sidebar } from './components/Sidebar.js';
import { Terminal } from './components/Terminal.js';
import { WindowControls } from './components/WindowControls.js';

/** @type {any} */
const api = window.horus;

/**
 * Boots the renderer composition root.
 */
async function bootstrap() {
  if (!api) {
    throw new Error('window.horus is not available. Verify preload/index.js wiring.');
  }

  const terminal = new Terminal({ maxLines: 1500 });
  const scriptList = new ScriptList({
    api,
    onProcessStarted: (processId) => {
      terminal.write(`Proceso iniciado: ${processId}`, 'info');
      refreshCounters();
    },
    onError: (message) => {
      terminal.write(message, 'stderr');
    }
  });

  const sidebar = new Sidebar({
    onSearchChange: (value) => {
      scriptList.setSearch(value);
    },
    onCategoryChange: (category) => {
      scriptList.setCategory(category);
    }
  });

  const controls = new WindowControls(api);

  /**
   * Syncs sidebar badges with current scripts/process state.
   */
  function refreshCounters() {
    sidebar.updateCounters(scriptList.getCounters());
  }

  terminal.mount();
  sidebar.mount();
  scriptList.mount();
  controls.mount();

  const unsubscribeTerminal = api.events.onTerminalData((payload) => {
    terminal.consume(payload);

    if (payload?.type === 'exit' && payload?.processId) {
      scriptList.markProcessEnded(payload.processId);
      refreshCounters();
    }
  });

  window.addEventListener('beforeunload', () => {
    unsubscribeTerminal?.();
  });

  try {
    await scriptList.refresh();
    refreshCounters();

    await Promise.allSettled([
      api.telemetry.start(),
      api.network.start()
    ]);

    terminal.write('Dashboard V2 inicializado correctamente.', 'info');
  } catch (error) {
    terminal.write(`Error de inicializacion: ${error.message}`, 'stderr');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((error) => {
    console.error('Renderer bootstrap failed:', error);
  });
});

window.__horusRendererModuleLoaded = true;
