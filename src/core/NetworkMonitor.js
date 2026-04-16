export class NetworkMonitor {
  constructor({ bridge } = {}) {
    this.bridge = bridge;
  }

  async start() {
    await this.bridge.invoke('network:start-monitoring');
  }

  async stop() {
    await this.bridge.invoke('network:stop-monitoring');
  }

  async getSnapshot() {
    return this.bridge.invoke('network:get-snapshot');
  }

  async getBlacklist() {
    return this.bridge.invoke('network:get-blacklist');
  }
}
