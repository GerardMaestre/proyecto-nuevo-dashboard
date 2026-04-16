function isPrivateIp(ip) {
  if (!ip) {
    return false;
  }

  return ip.startsWith('10.')
    || ip.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    || ip === '127.0.0.1'
    || ip === '::1';
}

export class ThreatIntel {
  constructor({
    blacklistedIps = [],
    highRiskPorts = [23, 445, 3389, 4444, 5555, 31337]
  } = {}) {
    this.blacklistedIps = new Set(blacklistedIps);
    this.highRiskPorts = new Set(highRiskPorts);
  }

  scoreConnection(connection = {}) {
    const reasons = [];
    let score = 0;

    if (connection.remoteIp && this.blacklistedIps.has(connection.remoteIp)) {
      score += 65;
      reasons.push(`IP marcada: ${connection.remoteIp}`);
    }

    if (connection.remotePort && this.highRiskPorts.has(Number(connection.remotePort))) {
      score += 35;
      reasons.push(`Puerto de riesgo: ${connection.remotePort}`);
    }

    if (connection.state === 'SYN_SENT') {
      score += 20;
      reasons.push('Conexion SYN_SENT persistente');
    }

    if (connection.state === 'ESTABLISHED' && connection.remoteIp && !isPrivateIp(connection.remoteIp)) {
      score += 10;
      reasons.push('Conexion externa establecida');
    }

    return {
      score,
      reasons,
      suspicious: score >= 45
    };
  }

  enrichSnapshot(snapshot = {}) {
    const baseConnections = Array.isArray(snapshot.connections) ? snapshot.connections : [];
    const baseSuspicious = Array.isArray(snapshot.suspicious) ? [...snapshot.suspicious] : [];

    const enrichedConnections = baseConnections.map((connection) => {
      const intel = this.scoreConnection(connection);
      return {
        ...connection,
        intel
      };
    });

    for (const connection of enrichedConnections) {
      if (!connection.intel.suspicious) {
        continue;
      }

      const alreadyIncluded = baseSuspicious.some((existing) => (
        existing.remoteIp === connection.remoteIp
        && existing.remotePort === connection.remotePort
        && existing.pid === connection.pid
      ));

      if (!alreadyIncluded) {
        baseSuspicious.push({
          ...connection,
          threatLevel: connection.intel.score > 75 ? 'high' : 'medium',
          reason: connection.intel.reasons.join(', ')
        });
      }
    }

    return {
      ...snapshot,
      connections: enrichedConnections,
      suspicious: baseSuspicious
    };
  }
}
