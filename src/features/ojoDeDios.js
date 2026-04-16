import { byId, safeText } from '../core/utils.js';

export class OjoDeDios {
  constructor({ toast } = {}) {
    this.toast = toast;
    this.suspiciousList = byId('suspicious-list');
    this.openPortsList = byId('open-ports-list');
    this.firewallRulesList = byId('firewall-rules-list');
    this.connectionsTableBody = byId('connections-table-body');
    this.threatCounter = byId('threat-counter');
  }

  render(snapshot = {}) {
    const suspicious = Array.isArray(snapshot.suspicious) ? snapshot.suspicious : [];
    const openPorts = Array.isArray(snapshot.openPorts) ? snapshot.openPorts : [];
    const firewallRules = Array.isArray(snapshot.firewallBlockedRules) ? snapshot.firewallBlockedRules : [];
    const connections = Array.isArray(snapshot.connections) ? snapshot.connections : [];

    if (this.threatCounter) {
      this.threatCounter.textContent = String(suspicious.length);
    }

    this.renderSuspicious(suspicious);
    this.renderOpenPorts(openPorts);
    this.renderFirewallRules(firewallRules);
    this.renderConnections(connections);
  }

  renderSuspicious(items) {
    if (!this.suspiciousList) {
      return;
    }

    this.suspiciousList.innerHTML = '';

    if (!items.length) {
      const li = document.createElement('li');
      li.textContent = 'Sin amenazas detectadas';
      this.suspiciousList.appendChild(li);
      return;
    }

    items.slice(0, 80).forEach((item) => {
      const li = document.createElement('li');
      li.className = 'danger';
      li.innerHTML = `${safeText(item.remoteIp || '?')} : ${safeText(item.remotePort || '-')}<br/><small>${safeText(item.reason || 'Actividad sospechosa')}</small>`;
      this.suspiciousList.appendChild(li);
    });
  }

  renderOpenPorts(ports) {
    if (!this.openPortsList) {
      return;
    }

    this.openPortsList.innerHTML = '';

    if (!ports.length) {
      const li = document.createElement('li');
      li.textContent = 'Sin puertos listados';
      this.openPortsList.appendChild(li);
      return;
    }

    ports.slice(0, 120).forEach((port) => {
      const li = document.createElement('li');
      li.textContent = `Puerto ${port}`;
      this.openPortsList.appendChild(li);
    });
  }

  renderFirewallRules(rules) {
    if (!this.firewallRulesList) {
      return;
    }

    this.firewallRulesList.innerHTML = '';

    if (!rules.length) {
      const li = document.createElement('li');
      li.textContent = 'Sin reglas bloqueadas detectadas';
      this.firewallRulesList.appendChild(li);
      return;
    }

    rules.slice(0, 120).forEach((rule) => {
      const li = document.createElement('li');
      li.textContent = rule;
      this.firewallRulesList.appendChild(li);
    });
  }

  renderConnections(connections) {
    if (!this.connectionsTableBody) {
      return;
    }

    this.connectionsTableBody.innerHTML = '';

    connections.slice(0, 260).forEach((connection) => {
      const row = document.createElement('tr');

      const values = [
        connection.protocol,
        `${connection.localIp || '?'}:${connection.localPort || '-'}`,
        `${connection.remoteIp || '?'}:${connection.remotePort || '-'}`,
        connection.state,
        connection.pid || '-'
      ];

      values.forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        row.appendChild(cell);
      });

      this.connectionsTableBody.appendChild(row);
    });
  }

  pushThreatNotification(threatEvent) {
    if (!threatEvent?.count) {
      return;
    }

    this.toast?.push({
      type: 'warning',
      title: 'Alerta Ojo de Dios',
      message: `${threatEvent.count} conexiones sospechosas detectadas.`
    });
  }
}
