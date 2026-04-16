const { EventEmitter } = require('events');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const DEFAULT_BLACKLIST = {
  ips: [
    '185.220.101.1',
    '45.95.147.236',
    '103.27.202.12',
    '198.98.51.189'
  ],
  ports: [
    23,
    1337,
    4444,
    5555,
    6667,
    31337
  ]
};

function parseEndpoint(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed || trimmed === '*:*') {
    return { ip: '*', port: null };
  }

  if (trimmed.startsWith('[')) {
    const match = trimmed.match(/^\[(.+)]:(\d+)$/);
    if (match) {
      return { ip: match[1], port: Number(match[2]) };
    }
  }

  const lastColonIndex = trimmed.lastIndexOf(':');

  if (lastColonIndex === -1) {
    return { ip: trimmed, port: null };
  }

  const ip = trimmed.slice(0, lastColonIndex);
  const port = Number(trimmed.slice(lastColonIndex + 1));

  return {
    ip,
    port: Number.isFinite(port) ? port : null
  };
}

class NetworkRadar extends EventEmitter {
  constructor({ logger, intervalMs = 3000, blacklist } = {}) {
    super();
    this.logger = logger;
    this.intervalMs = intervalMs;
    this.blacklist = blacklist || DEFAULT_BLACKLIST;
    this.intervalRef = null;
    this.snapshot = {
      timestamp: Date.now(),
      connections: [],
      openPorts: [],
      suspicious: [],
      firewallBlockedRules: []
    };
  }

  async getNetstatConnections() {
    const { stdout } = await execAsync('netstat -ano -n');
    const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const connections = [];

    for (const line of lines) {
      if (!line.startsWith('TCP') && !line.startsWith('UDP')) {
        continue;
      }

      const parts = line.split(/\s+/);

      if (parts[0] === 'TCP' && parts.length >= 5) {
        const local = parseEndpoint(parts[1]);
        const remote = parseEndpoint(parts[2]);

        connections.push({
          protocol: 'TCP',
          localIp: local.ip,
          localPort: local.port,
          remoteIp: remote.ip,
          remotePort: remote.port,
          state: parts[3],
          pid: Number(parts[4]) || null
        });
      }

      if (parts[0] === 'UDP' && parts.length >= 4) {
        const local = parseEndpoint(parts[1]);
        const remote = parseEndpoint(parts[2]);

        connections.push({
          protocol: 'UDP',
          localIp: local.ip,
          localPort: local.port,
          remoteIp: remote.ip,
          remotePort: remote.port,
          state: 'STATELESS',
          pid: Number(parts[3]) || null
        });
      }
    }

    return connections;
  }

  async getBlockedFirewallRules() {
    try {
      const { stdout } = await execAsync('powershell -NoProfile -Command "Get-NetFirewallRule -Action Block -Enabled True | Select-Object -First 25 -ExpandProperty DisplayName"');
      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (_error) {
      return [];
    }
  }

  markThreats(connections) {
    const ipSet = new Set(this.blacklist.ips || []);
    const portSet = new Set(this.blacklist.ports || []);

    return connections
      .filter((connection) => {
        const remoteIp = connection.remoteIp;
        const remotePort = connection.remotePort;

        const isBlacklistedIp = remoteIp && ipSet.has(remoteIp);
        const isBlacklistedPort = remotePort && portSet.has(remotePort);

        return isBlacklistedIp || isBlacklistedPort;
      })
      .map((connection) => ({
        ...connection,
        threatLevel: 'medium',
        reason: ipSet.has(connection.remoteIp)
          ? `IP in blacklist: ${connection.remoteIp}`
          : `Port in blacklist: ${connection.remotePort}`
      }));
  }

  async collectSnapshot() {
    try {
      const [connections, firewallBlockedRules] = await Promise.all([
        this.getNetstatConnections(),
        this.getBlockedFirewallRules()
      ]);

      const openPorts = [...new Set(
        connections
          .filter((conn) => conn.localPort && (conn.state === 'LISTENING' || conn.protocol === 'UDP'))
          .map((conn) => conn.localPort)
      )].sort((a, b) => a - b);

      const suspicious = this.markThreats(connections);

      this.snapshot = {
        timestamp: Date.now(),
        connections: connections.slice(0, 350),
        openPorts,
        suspicious,
        firewallBlockedRules
      };

      return this.snapshot;
    } catch (error) {
      this.logger?.error('Failed to collect network snapshot', error);
      throw error;
    }
  }

  async getSnapshot() {
    return this.collectSnapshot();
  }

  startMonitoring() {
    if (this.intervalRef) {
      return { running: true, intervalMs: this.intervalMs };
    }

    const tick = async () => {
      try {
        const snapshot = await this.collectSnapshot();
        this.emit('network:update', snapshot);

        if (snapshot.suspicious.length) {
          this.emit('network:threat', {
            timestamp: Date.now(),
            count: snapshot.suspicious.length,
            top: snapshot.suspicious.slice(0, 5)
          });
        }
      } catch (error) {
        this.emit('network:update', {
          timestamp: Date.now(),
          error: error.message,
          connections: [],
          openPorts: [],
          suspicious: [],
          firewallBlockedRules: []
        });
      }
    };

    tick().catch(() => {});

    this.intervalRef = setInterval(() => {
      tick().catch(() => {});
    }, this.intervalMs);

    return { running: true, intervalMs: this.intervalMs };
  }

  stopMonitoring() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }

    return { running: false };
  }

  getBlacklist() {
    return this.blacklist;
  }
}

module.exports = {
  NetworkRadar
};
