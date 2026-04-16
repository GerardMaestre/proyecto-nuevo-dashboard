import { byId, formatBytes, formatPercent } from '../core/utils.js';

function updateBar(id, percent) {
  const element = byId(id);

  if (!element) {
    return;
  }

  const bounded = Math.max(0, Math.min(Number(percent) || 0, 100));
  element.style.width = `${bounded}%`;
}

export function updateTelemetryWidgets(snapshot = {}) {
  if (!snapshot || snapshot.error) {
    return;
  }

  const cpuUsage = Number(snapshot.cpu?.usage || 0);
  const ramUsage = Number(snapshot.memory?.usagePercent || 0);
  const diskUsage = Number(snapshot.disk?.usagePercent || 0);
  const rxBytes = Number(snapshot.network?.rxBytes || 0);
  const txBytes = Number(snapshot.network?.txBytes || 0);

  const cpuLabel = byId('cpu-usage');
  if (cpuLabel) {
    cpuLabel.textContent = formatPercent(cpuUsage);
  }

  const ramLabel = byId('ram-usage');
  if (ramLabel) {
    ramLabel.textContent = formatPercent(ramUsage);
  }

  const diskLabel = byId('disk-usage');
  if (diskLabel) {
    diskLabel.textContent = formatPercent(diskUsage);
  }

  const networkLabel = byId('network-throughput');
  if (networkLabel) {
    networkLabel.textContent = `${formatBytes(rxBytes + txBytes)}/s`;
  }

  const networkMeta = byId('network-meta');
  if (networkMeta) {
    networkMeta.textContent = `RX ${formatBytes(rxBytes)} | TX ${formatBytes(txBytes)}`;
  }

  updateBar('cpu-bar', cpuUsage);
  updateBar('ram-bar', ramUsage);
  updateBar('disk-bar', diskUsage);
}
