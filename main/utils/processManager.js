const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const { buildRunAsPowerShell } = require('./uac');

const ALLOWED_EXTENSIONS = new Set(['.bat', '.cmd', '.ps1', '.py', '.js']);

const CATEGORY_BY_FOLDER = [
  { prefix: '01_', label: 'Mantenimiento' },
  { prefix: '02_', label: 'Optimizacion Gaming' },
  { prefix: '03_', label: 'Privacidad y Seguridad' },
  { prefix: '04_', label: 'Utilidades Archivos' },
  { prefix: '05_', label: 'Descargas Multimedia' },
  { prefix: '06_', label: 'Personalizacion' }
];

function guessCategory(fileName) {
  const normalized = fileName.toLowerCase();

  if (/telemet|privacidad|firewall|seguridad|defender|virus|dns/.test(normalized)) {
    return 'Privacidad y Seguridad';
  }

  if (/gaming|fps|gpu|latencia|nucleos|optimi|juego/.test(normalized)) {
    return 'Optimizacion Gaming';
  }

  if (/limpiar|clean|cache|ram|temp|mantenimiento|repair/.test(normalized)) {
    return 'Mantenimiento';
  }

  return 'Herramientas';
}

function normalizeFolderLabel(folderName) {
  const lower = String(folderName || '').toLowerCase();

  const known = CATEGORY_BY_FOLDER.find((item) => lower.startsWith(item.prefix));

  if (known) {
    return known.label;
  }

  return String(folderName || '')
    .replace(/^\d+_/, '')
    .replace(/_/g, ' ')
    .trim() || 'Herramientas';
}

function toScriptId(relativePath) {
  return String(relativePath || '').split(path.sep).join('/');
}

function normalizeScriptIdentifier(scriptIdentifier) {
  return String(scriptIdentifier || '').replace(/[\\/]+/g, path.sep);
}

function requiresAdmin(fileName) {
  return /(desinstalador|telemetria|firewall|registro|nucleos|drivers|defender|policy|servicios|services)/i
    .test(fileName);
}

class ProcessManager extends EventEmitter {
  constructor({ sendToRenderer, logger, scriptsDir } = {}) {
    super();
    this.sendToRenderer = sendToRenderer;
    this.logger = logger;
    this.scriptsDir = scriptsDir || path.join(process.cwd(), 'mis_scripts');
    this.running = new Map();
  }

  walkScriptFiles(rootDirectory) {
    const files = [];
    const stack = [rootDirectory];

    while (stack.length) {
      const currentDirectory = stack.pop();
      const entries = fs.readdirSync(currentDirectory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(currentDirectory, entry.name);

        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }

        if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  categoryFromRelativePath(relativePath) {
    const normalizedRelativePath = String(relativePath || '');
    const segments = normalizedRelativePath.split(path.sep);
    const rootFolder = segments.length > 1 ? segments[0] : '';

    if (rootFolder) {
      return normalizeFolderLabel(rootFolder);
    }

    return guessCategory(path.basename(normalizedRelativePath));
  }

  findScriptPathByBaseName(scriptName) {
    const targetName = path.basename(String(scriptName || '')).toLowerCase();

    if (!targetName) {
      return null;
    }

    const allFiles = this.walkScriptFiles(this.scriptsDir);
    const matches = allFiles
      .filter((filePath) => path.basename(filePath).toLowerCase() === targetName)
      .filter((filePath) => ALLOWED_EXTENSIONS.has(path.extname(filePath).toLowerCase()));

    if (!matches.length) {
      return null;
    }

    if (matches.length > 1) {
      throw new Error(`Ambiguous script name: ${scriptName}. Use script ID/relative path instead.`);
    }

    return matches[0];
  }

  async listScripts() {
    try {
      if (!fs.existsSync(this.scriptsDir)) {
        return [];
      }

      const files = this.walkScriptFiles(this.scriptsDir);
      const scripts = [];

      for (const file of files) {
        const extension = path.extname(file).toLowerCase();

        if (!ALLOWED_EXTENSIONS.has(extension)) {
          continue;
        }

        const relativePath = path.relative(this.scriptsDir, file);
        const directory = path.dirname(relativePath);
        const scriptId = toScriptId(relativePath);
        const fileName = path.basename(file);

        scripts.push({
          id: scriptId,
          name: fileName,
          relativePath: scriptId,
          directory: directory === '.' ? '' : toScriptId(directory),
          path: file,
          extension,
          category: this.categoryFromRelativePath(relativePath),
          requiresAdmin: requiresAdmin(relativePath)
        });
      }

      return scripts.sort((a, b) => {
        const categoryComparison = a.category.localeCompare(b.category);
        if (categoryComparison !== 0) {
          return categoryComparison;
        }

        return a.relativePath.localeCompare(b.relativePath);
      });
    } catch (error) {
      this.logger?.error('Failed to list scripts', error);
      throw error;
    }
  }

  resolveScriptPath(scriptIdentifier) {
    const normalizedIdentifier = normalizeScriptIdentifier(scriptIdentifier);
    const resolved = path.resolve(this.scriptsDir, normalizedIdentifier);
    const scriptsRoot = path.resolve(this.scriptsDir);
    const relative = path.relative(scriptsRoot, resolved);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid script path requested');
    }

    if (!fs.existsSync(resolved)) {
      const fallback = this.findScriptPathByBaseName(scriptIdentifier);

      if (!fallback) {
        throw new Error(`Script not found: ${scriptIdentifier}`);
      }

      return fallback;
    }

    const extension = path.extname(resolved).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error(`Script extension not allowed: ${extension}`);
    }

    return resolved;
  }

  buildExecutionDescriptor(scriptPath, args = []) {
    const extension = path.extname(scriptPath).toLowerCase();

    if (extension === '.py') {
      return {
        filePath: 'py.exe',
        argumentList: [scriptPath, ...args.map(String)]
      };
    }

    if (extension === '.ps1') {
      return {
        filePath: 'powershell.exe',
        argumentList: [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          ...args.map(String)
        ]
      };
    }

    if (extension === '.js') {
      return {
        filePath: 'node.exe',
        argumentList: [scriptPath, ...args.map(String)]
      };
    }

    return {
      filePath: 'cmd.exe',
      argumentList: ['/d', '/c', 'call', scriptPath, ...args.map(String)]
    };
  }

  async runScript(payload = {}) {
    const scriptIdentifier = payload.scriptId || payload.scriptName || payload.name;
    const args = Array.isArray(payload.args) ? payload.args : [];
    const elevated = Boolean(payload.elevated);

    if (!scriptIdentifier) {
      throw new Error('scriptId or scriptName is required');
    }

    const scriptPath = this.resolveScriptPath(scriptIdentifier);

    if (elevated) {
      return this.runElevated(scriptPath, args);
    }

    return this.runStandard(scriptPath, args);
  }

  runStandard(scriptPath, args = []) {
    const processId = uuidv4();
    const descriptor = this.buildExecutionDescriptor(scriptPath, args);
    const scriptWorkingDirectory = path.dirname(scriptPath);

    const child = spawn(descriptor.filePath, descriptor.argumentList, {
      cwd: scriptWorkingDirectory,
      windowsHide: true,
      shell: false
    });

    this.running.set(processId, {
      processId,
      child,
      elevated: false,
      scriptPath,
      startedAt: Date.now()
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      this.emit('process:stdout', { processId, scriptPath, text, timestamp: Date.now() });
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      this.emit('process:stderr', { processId, scriptPath, text, timestamp: Date.now() });
    });

    child.on('error', (error) => {
      this.emit('process:error', {
        processId,
        scriptPath,
        message: error.message,
        timestamp: Date.now()
      });
    });

    child.on('close', (code) => {
      this.running.delete(processId);
      this.emit('process:exit', {
        processId,
        scriptPath,
        code: Number.isInteger(code) ? code : -1,
        timestamp: Date.now()
      });
    });

    return {
      processId,
      elevated: false,
      scriptName: path.basename(scriptPath),
      startedAt: Date.now()
    };
  }

  runElevated(scriptPath, args = []) {
    const processId = uuidv4();
    const descriptor = this.buildExecutionDescriptor(scriptPath, args);
    const scriptWorkingDirectory = path.dirname(scriptPath);

    const tempFolder = path.join(os.tmpdir(), 'my-dashboard');
    fs.mkdirSync(tempFolder, { recursive: true });

    const stdoutFile = path.join(tempFolder, `${processId}.stdout.log`);
    const stderrFile = path.join(tempFolder, `${processId}.stderr.log`);

    fs.writeFileSync(stdoutFile, '', 'utf8');
    fs.writeFileSync(stderrFile, '', 'utf8');

    const command = buildRunAsPowerShell({
      filePath: descriptor.filePath,
      argumentList: descriptor.argumentList,
      outputFile: stdoutFile,
      errorFile: stderrFile,
      workingDirectory: scriptWorkingDirectory
    });

    const child = spawn('powershell.exe', ['-NoProfile', '-Command', command], {
      cwd: scriptWorkingDirectory,
      windowsHide: true,
      shell: false
    });

    const metadata = {
      processId,
      child,
      elevated: true,
      scriptPath,
      stdoutFile,
      stderrFile,
      stdoutOffset: 0,
      stderrOffset: 0,
      elevatedPid: null,
      startedAt: Date.now()
    };

    this.running.set(processId, metadata);

    const flushStreamFile = (streamType) => {
      const filePath = streamType === 'stdout' ? metadata.stdoutFile : metadata.stderrFile;
      const offsetKey = streamType === 'stdout' ? 'stdoutOffset' : 'stderrOffset';

      if (!fs.existsSync(filePath)) {
        return;
      }

      const fullContent = fs.readFileSync(filePath, 'utf8');

      if (fullContent.length <= metadata[offsetKey]) {
        return;
      }

      const delta = fullContent.slice(metadata[offsetKey]);
      metadata[offsetKey] = fullContent.length;

      if (!delta.trim().length) {
        return;
      }

      this.emit(`process:${streamType}`, {
        processId,
        scriptPath,
        text: delta,
        timestamp: Date.now()
      });
    };

    const poller = setInterval(() => {
      try {
        flushStreamFile('stdout');
        flushStreamFile('stderr');
      } catch (error) {
        this.logger?.warn('Failed while polling elevated process output', error.message);
      }
    }, 400);

    metadata.poller = poller;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      const pidMatch = text.match(/__PID__=(\d+)/);
      if (pidMatch) {
        metadata.elevatedPid = Number(pidMatch[1]);
      }
    });

    child.on('error', (error) => {
      clearInterval(poller);
      this.emit('process:error', {
        processId,
        scriptPath,
        message: error.message,
        timestamp: Date.now()
      });
    });

    child.on('close', (code) => {
      clearInterval(poller);

      try {
        flushStreamFile('stdout');
        flushStreamFile('stderr');
      } catch (error) {
        this.logger?.warn('Failed final output flush for elevated process', error.message);
      }

      this.running.delete(processId);

      this.emit('process:exit', {
        processId,
        scriptPath,
        code: Number.isInteger(code) ? code : -1,
        timestamp: Date.now()
      });

      this.cleanupTempFiles([stdoutFile, stderrFile]);
    });

    return {
      processId,
      elevated: true,
      scriptName: path.basename(scriptPath),
      startedAt: Date.now()
    };
  }

  async stopProcess(processId) {
    if (!processId) {
      throw new Error('processId is required to stop a process');
    }

    const metadata = this.running.get(processId);

    if (!metadata) {
      return { processId, stopped: false, reason: 'Process not found' };
    }

    try {
      if (metadata.elevatedPid) {
        await this.killPid(metadata.elevatedPid);
      }

      if (metadata.child && !metadata.child.killed) {
        metadata.child.kill();
      }

      if (metadata.poller) {
        clearInterval(metadata.poller);
      }

      this.running.delete(processId);

      this.emit('process:exit', {
        processId,
        scriptPath: metadata.scriptPath,
        code: -999,
        timestamp: Date.now(),
        stoppedByUser: true
      });

      return { processId, stopped: true };
    } catch (error) {
      this.logger?.error('Failed to stop process', error);
      throw error;
    }
  }

  async killPid(pid) {
    return new Promise((resolve, reject) => {
      const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        shell: false
      });

      killer.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`taskkill failed with code ${code}`));
      });

      killer.on('error', (error) => reject(error));
    });
  }

  stopAll() {
    for (const processId of this.running.keys()) {
      this.stopProcess(processId).catch((error) => {
        this.logger?.warn(`Unable to stop process ${processId}`, error.message);
      });
    }
  }

  cleanupTempFiles(filePaths) {
    for (const filePath of filePaths) {
      if (!filePath) {
        continue;
      }

      fs.promises.unlink(filePath).catch(() => {});
    }
  }
}

module.exports = {
  ProcessManager
};
