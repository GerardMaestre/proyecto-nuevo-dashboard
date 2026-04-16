const defaultState = {
  scripts: [],
  telemetry: null,
  network: null,
  autopilotTasks: [],
  activeProcesses: 0,
  filters: {
    search: '',
    category: 'all'
  },
  remoteServer: {
    running: false,
    port: null
  }
};

export class StateStore {
  constructor(initialState = defaultState) {
    this.state = {
      ...initialState,
      filters: {
        ...initialState.filters
      }
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(partialState = {}) {
    this.state = {
      ...this.state,
      ...partialState,
      filters: {
        ...this.state.filters,
        ...(partialState.filters || {})
      }
    };

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const appState = new StateStore(defaultState);
