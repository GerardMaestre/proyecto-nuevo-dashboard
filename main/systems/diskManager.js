const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const si = require('systeminformation');

class DiskManager {
  constructor({ logger } = {}) {
    this.logger = logger;
    this.nativeModulePath = path.join(process.cwd(), 'native_modules', 'mft_reader.exe');
  }

  async getSummary() {
    try {
      const [layouts, fsSize] = await Promise.all([
        si.diskLayout(),
        si.fsSize()
      ]);

      return {
        timestamp: Date.now(),
        drives: layouts.map((drive) => ({
          device: drive.device,
          name: drive.name,
          type: drive.type,
          size: drive.size,
          interfaceType: drive.interfaceType,
          smartStatus: drive.smartStatus || 'unknown'
        })),
        volumes: fsSize.map((volume) => ({
          fs: volume.fs,
          mount: volume.mount,
          type: volume.type,
          size: volume.size,
          used: volume.used,
          usePercent: volume.use
        }))
      };
    } catch (error) {
      this.logger?.error('Failed to get disk summary', error);
      throw error;
    }
  }

  async scanMft(payload = {}) {
    const args = Array.isArray(payload.args) ? payload.args : [];

    if (!fs.existsSync(this.nativeModulePath)) {
      return {
        success: false,
        message: `Native module not found at ${this.nativeModulePath}`,
        output: ''
      };
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.nativeModulePath, args, {
        windowsHide: true,
        shell: false
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', (error) => {
        this.logger?.error('MFT reader execution failed', error);
        reject(error);
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code,
          output: stdout,
          error: stderr
        });
      });
    });
  }
}

module.exports = {
  DiskManager
};
