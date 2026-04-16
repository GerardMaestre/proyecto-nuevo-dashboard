import { byId } from '../lib/dom.js';

/**
 * Renders terminal/process output events in the bottom panel.
 */
export class Terminal {
  /**
   * @param {{ maxLines?: number }} options
   */
  constructor(options = {}) {
    this.outputElement = byId('terminal-output');
    this.clearButton = byId('btn-clear-terminal');
    this.copyButton = byId('btn-copy-terminal');
    this.maxLines = Number(options.maxLines) || 1200;
  }

  /**
   * Sets up terminal UI event handlers.
   */
  mount() {
    this.clearButton?.addEventListener('click', () => {
      this.clear();
    });

    this.copyButton?.addEventListener('click', async () => {
      await this.copyAll();
    });
  }

  /**
   * Parses ANSI color codes and highlights patterns (IPs, Brackets, etc.)
   * @param {string} text
   * @returns {string} Safe HTML string
   */
  formatANSI(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 1. Convert ANSI color codes to styled spans
    let openSpans = 0;
    html = html.replace(/\x1b\[(\d+(?:;\d+)*)m/g, (match, codeStr) => {
      const codes = codeStr.split(';');
      let replacement = '';
      
      for (const code of codes) {
        if (code === '0' || code === '39') {
          // Reset
          while (openSpans > 0) { replacement += '</span>'; openSpans--; }
        } else if (code === '1') {
          replacement += '<span style="font-weight:bold;text-shadow:0 0 5px rgba(255,255,255,0.4);">'; openSpans++;
        } else if (code === '30') {
          replacement += '<span style="color:#565f89;">'; openSpans++;
        } else if (code === '31') {
          replacement += '<span style="color:#f7768e;text-shadow:0 0 8px rgba(247,118,142,0.4);">'; openSpans++;
        } else if (code === '32') {
          replacement += '<span style="color:#9ece6a;text-shadow:0 0 8px rgba(158,206,106,0.4);">'; openSpans++;
        } else if (code === '33') {
          replacement += '<span style="color:#e0af68;text-shadow:0 0 8px rgba(224,175,104,0.4);">'; openSpans++;
        } else if (code === '34') {
          replacement += '<span style="color:#7aa2f7;text-shadow:0 0 8px rgba(122,162,247,0.4);">'; openSpans++;
        } else if (code === '35') {
          replacement += '<span style="color:#bb9af7;text-shadow:0 0 8px rgba(187,154,247,0.4);">'; openSpans++;
        } else if (code === '36') {
          replacement += '<span style="color:#7dcfff;text-shadow:0 0 8px rgba(125,207,255,0.4);">'; openSpans++;
        } else if (code === '37' || code === '97') {
          replacement += '<span style="color:#c0caf5;">'; openSpans++;
        } else if (code === '90') {
          replacement += '<span style="color:#565f89;">'; openSpans++;
        }
      }
      return replacement;
    });

    while (openSpans > 0) { html += '</span>'; openSpans--; }

    // 2. Syntax mapping
    // Bracket tags like [*] [!] [OK]
    html = html.replace(/(\[[*!?>OK~✔\-+#]+\])/g, '<span class="term-bullet">$1</span>');
    // Lines of separators ==== or -----
    if (/^[=\-─_]{10,}$/.test(text.trim()) || /^[━]{10,}$/.test(text.trim())) {
      html = `<span class="term-separator">${html}</span>`;
    }
    // IP Addresses
    html = html.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, '<span class="term-ip">$1</span>');

    return html;
  }

  /**
   * @param {string} text
   * @param {'info' | 'stderr'} type
   */
  write(text, type = 'info') {
    if (!this.outputElement) {
      return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    
    const timeSpan = `<span class="term-time">[${timestamp}]</span>`;
    const formattedContent = this.formatANSI(String(text || ''));

    line.innerHTML = `${timeSpan}${formattedContent}`;

    this.outputElement.appendChild(line);

    while (this.outputElement.childElementCount > this.maxLines) {
      this.outputElement.firstChild?.remove();
    }

    this.outputElement.scrollTop = this.outputElement.scrollHeight;
  }

  /**
   * Consumes IPC payloads from terminal/process events.
   * @param {{ type?: string, processId?: string, text?: string, message?: string, code?: number }} payload
   */
  consume(payload = {}) {
    const type = String(payload.type || 'info');

    if (type === 'stdout') {
      this.write(payload.text || '', 'info');
      return;
    }

    if (type === 'stderr' || type === 'error') {
      this.write(payload.text || payload.message || 'Error de proceso', 'stderr');
      return;
    }

    if (type === 'exit') {
      this.write(`Proceso ${payload.processId || '?'} finalizado. Codigo ${payload.code ?? -1}`, 'info');
      return;
    }

    this.write(JSON.stringify(payload), 'info');
  }

  /**
   * Clears the terminal output panel.
   */
  clear() {
    if (this.outputElement) {
      this.outputElement.textContent = '';
    }
  }

  /**
   * Copies terminal output to clipboard when available.
   */
  async copyAll() {
    if (!this.outputElement || !navigator.clipboard) {
      return;
    }

    const lines = Array.from(this.outputElement.querySelectorAll('.terminal-line'))
      .map((line) => line.textContent || '')
      .join('\n');

    if (!lines.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(lines);
      this.write('Logs copiados al portapapeles.', 'info');
    } catch {
      this.write('No se pudieron copiar los logs.', 'stderr');
    }
  }
}
