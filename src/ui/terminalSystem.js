import { byId, safeText } from '../core/utils.js';

export class TerminalSystem {
  constructor() {
    this.outputElement = byId('terminal-output');
    this.clearButton = byId('btn-clear-terminal');
    this.maxLines = 1500;

    this.clearButton?.addEventListener('click', () => this.clear());
  }

  write(text, type = 'info') {
    if (!this.outputElement) {
      return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.innerHTML = `<span>[${safeText(timestamp)}]</span> ${safeText(text)}`;

    this.outputElement.appendChild(line);

    while (this.outputElement.childElementCount > this.maxLines) {
      this.outputElement.firstChild?.remove();
    }

    this.outputElement.scrollTop = this.outputElement.scrollHeight;
  }

  consumeProcessEvent(payload = {}) {
    const type = payload.type || 'info';

    if (type === 'stdout') {
      this.write(payload.text || '', 'info');
      return;
    }

    if (type === 'stderr' || type === 'error') {
      this.write(payload.text || payload.message || 'Unknown stderr/error event', 'stderr');
      return;
    }

    if (type === 'exit') {
      this.write(`Proceso ${payload.processId} finalizado. Exit code: ${payload.code}`, 'info');
      return;
    }

    this.write(JSON.stringify(payload), 'info');
  }

  clear() {
    if (this.outputElement) {
      this.outputElement.textContent = '';
    }
  }
}
