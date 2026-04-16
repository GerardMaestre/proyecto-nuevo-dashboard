const { EventEmitter } = require('events');
const si = require('systeminformation');

class TelemetryManager extends EventEmitter {
  constructor({ logger, intervalMs = 1000 } = {}) {
    super();
    this.logger = logger;
    this.intervalMs = intervalMs;
    this.intervalRef = null;
    this.snapshot = null;
  }

  async collectSnapshot() {
    try {
      const [cpu, mem, fsSize, networkStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats()
      ]);

      const totalDisk = fsSize.reduce((acc, item) => acc + (item.size || 0), 0);
      const usedDisk = fsSize.reduce((acc, item) => acc + (item.used || 0), 0);

      const network = (networkStats || []).reduce((acc, item) => {
        acc.rxBytes += item.rx_bytes || 0;
        acc.txBytes += item.tx_bytes || 0;
        return acc;
      }, { rxBytes: 0, txBytes: 0 });

      this.snapshot = {
        timestamp: Date.now(),
        cpu: {
          usage: Number((cpu.currentLoad || 0).toFixed(2)),
          average: Number((cpu.avgLoad || 0).toFixed(2)),
          cores: (cpu.cpus || []).map((core, index) => ({
            core: index,
            load: Number((core.load || 0).toFixed(2))
          }))
        },
        memory: {
          total: mem.total || 0,
          used: mem.used || 0,
          free: mem.free || 0,
          usagePercent: mem.total ? Number((((mem.used || 0) / mem.total) * 100).toFixed(2)) : 0,
          swapTotal: mem.swaptotal || 0,
          swapUsed: mem.swapused || 0
        },
        disk: {
          total: totalDisk,
          used: usedDisk,
          usagePercent: totalDisk ? Number(((usedDisk / totalDisk) * 100).toFixed(2)) : 0,
          volumes: fsSize.map((volume) => ({
            fs: volume.fs,
            type: volume.type,
            mount: volume.mount,
            size: volume.size,
            used: volume.used,
            usePercent: volume.use
          }))
        },
        network
      };

      return this.snapshot;
    } catch (error) {
      this.logger?.error('Failed to collect telemetry snapshot', error);
      throw error;
    }
  }

  async getSnapshot() {
    if (!this.snapshot) {
      return this.collectSnapshot();
    }

    return this.snapshot;
  }

  start() {
    if (this.intervalRef) {
      return { running: true, intervalMs: this.intervalMs };
    }

    const tick = async () => {
      try {
        const snapshot = await this.collectSnapshot();
        this.emit('telemetry:update', snapshot);
      } catch (error) {
        this.emit('telemetry:update', {
          timestamp: Date.now(),
          error: error.message
        });
      }
    };

    tick().catch(() => {});

    this.intervalRef = setInterval(() => {
      tick().catch(() => {});
    }, this.intervalMs);

    return { running: true, intervalMs: this.intervalMs };
  }

  stop() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }

    return { running: false };
  }
}

module.exports = {
  TelemetryManager
};
