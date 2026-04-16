const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

class AppManager {
  constructor({ logger } = {}) {
    this.logger = logger;
  }

  async getInstalledApplications() {
    try {
      const command = [
        'powershell',
        '-NoProfile',
        '-Command',
        '"$paths = @(',
        "'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
        "'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
        "'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'",
        ');',
        '$apps = Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue |',
        'Where-Object { $_.DisplayName } |',
        'Select-Object DisplayName, DisplayVersion, Publisher, InstallDate;',
        '$apps | ConvertTo-Json -Depth 3"'
      ].join(' ');

      const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });

      if (!stdout || !stdout.trim()) {
        return [];
      }

      const parsed = JSON.parse(stdout);
      const array = Array.isArray(parsed) ? parsed : [parsed];

      return array
        .filter((item) => item && item.DisplayName)
        .map((item) => ({
          name: item.DisplayName,
          version: item.DisplayVersion || 'N/A',
          publisher: item.Publisher || 'Unknown',
          installDate: item.InstallDate || null,
          normalizedName: normalizeName(item.DisplayName)
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      this.logger?.error('Failed to read installed applications', error);
      throw error;
    }
  }

  async findDuplicateApplications() {
    const apps = await this.getInstalledApplications();
    const groups = new Map();

    for (const app of apps) {
      if (!groups.has(app.normalizedName)) {
        groups.set(app.normalizedName, []);
      }

      groups.get(app.normalizedName).push(app);
    }

    return [...groups.entries()]
      .filter(([, entries]) => entries.length > 1)
      .map(([key, entries]) => ({
        normalizedName: key,
        count: entries.length,
        items: entries
      }))
      .sort((a, b) => b.count - a.count);
  }
}

module.exports = {
  AppManager
};
