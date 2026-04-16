const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');

const unlinkAsync = promisify(fs.unlink);
const rmdirAsync = promisify(fs.rmdir);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

/**
 * Gestor Nativo de Archivos (Sustituye a Limpieza_Extrema_Global.py y Organizador.py)
 * 
 * Opera directamente con el FileSystem de Node.js, siendo ultra-rápido I/O.
 * No invoca shells externos y envía métricas de bytes en tiempo real.
 */
class FileManager {
  constructor() {
    this.isCleaning = false;
  }

  /**
   * Ejecuta una purga de ficheros temporales.
   * @param {Function} onProgress Callback para actualizar la UI en vivo
   */
  async cleanJunk(onProgress = () => {}) {
    if (this.isCleaning) {
      throw new Error('Ya hay una limpieza en curso.');
    }
    this.isCleaning = true;

    try {
      // Rutas clásicas de basura en Windows
      const targets = [
        os.tmpdir(),
        process.env.TEMP,
        process.env.TMP,
        path.join(process.env.LOCALAPPDATA || '', 'Temp'),
        path.join(process.env.WINDIR || 'C:\\Windows', 'Temp'),
        path.join(process.env.WINDIR || 'C:\\Windows', 'SoftwareDistribution', 'Download')
      ].filter(Boolean); // Filtrar nulos/indefinidos

      // Evitar escanear dos veces la misma si TEMP y TMP apuntan a lo mismo
      const uniqueTargets = [...new Set(targets)];

      let totalFreed = 0;
      let filesDeleted = 0;

      for (const target of uniqueTargets) {
        if (!fs.existsSync(target)) continue;
        
        onProgress({ status: 'scanning', folder: target, totalFreedMB: (totalFreed / 1024 / 1024).toFixed(2), filesDeleted });
        
        // Artificial delay for UX: lets the user see the folder being scanned
        await new Promise((resolve) => setTimeout(resolve, 300));

        await this._cleanDirectory(target, (freed, file) => {
          totalFreed += freed;
          filesDeleted++;
          // Enviar updates paulatinamente para no saturar el IPC de Electron   
          if (filesDeleted % 5 === 0) { // Aumentado a cada 5 ficheros para mas feedback visual!
            onProgress({ status: 'cleaning', file: path.basename(file), totalFreedMB: (totalFreed / 1024 / 1024).toFixed(2), filesDeleted });
          }
        });
      }

      // Ensure final state shows properly
      const totalFreedMB = (totalFreed / 1024 / 1024).toFixed(2);
      onProgress({ status: 'done', totalFreedMB, filesDeleted });
      await new Promise(resolve => setTimeout(resolve, 500));
      this.isCleaning = false;
      return {
        success: true,
        freedMB: totalFreedMB,
        filesDeleted
      };
    } catch (error) {
      this.isCleaning = false;
      throw error;
    }
  }

  /**
   * Recorre y elimina recursivamente.
   */
  async _cleanDirectory(dirPath, onDeleted) {
    try {
      const entries = await readdirAsync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            await this._cleanDirectory(fullPath, onDeleted);
            // Intentar borrar la carpeta si quedó vacía
            await rmdirAsync(fullPath);
          } else {
            const stats = await statAsync(fullPath);
            await unlinkAsync(fullPath);
            onDeleted(stats.size, fullPath);
          }
        } catch (err) {
          // Archivos en uso o restringidos se ignoran silenciosamente
          // console.warn(`Skipped: ${fullPath}`);
        }
      }
    } catch (err) {
      // Carpetas sin permisos se ignoran
    }
  }

  /**
   * Busca archivos duplicados usando hashing.
   */
  async findDuplicates(onProgress = () => {}) {
    if (this.isCleaning) throw new Error('Ya hay una purga en curso.');
    this.isCleaning = true;

    try {
      const crypto = require('crypto');
      const util = require('util');
      const readdirAsync = util.promisify(fs.readdir);
      const statAsync = util.promisify(fs.stat);
      const renameAsync = util.promisify(fs.rename);
      const mkdirAsync = util.promisify(fs.mkdir);

      const target = path.join(os.homedir(), 'Downloads');
      const quarantineDir = path.join(target, 'DUPLICADOS_A_BORRAR');

      if (!fs.existsSync(quarantineDir)) {
        await mkdirAsync(quarantineDir, { recursive: true });
      }

      let duplicatesCount = 0;
      let totalMB = 0;

      onProgress({ status: 'scanning', folder: target, duplicatesCount, totalFreedMB: 0 });

      const filesBySize = new Map();
      let filesScanned = 0;
      let lastUIUpdate = Date.now();

      async function walkDir(dir) {
        if (dir === quarantineDir) return;
        const entries = await readdirAsync(dir, { withFileTypes: true }).catch(() => []);
        if (!entries) return;
        
        for (const entry of entries) {
           const fullPath = path.join(dir, entry.name);
           if (entry.isDirectory()) {
             await walkDir(fullPath);
           } else {
             try {
               const stats = await statAsync(fullPath);
               const size = stats.size;
               if (size > 0) { // Evita hashear archivos de 0 bytes o vacíos
                 if (!filesBySize.has(size)) filesBySize.set(size, []);
                 filesBySize.get(size).push(fullPath);
               }
             } catch (e) {}

             filesScanned++;
             const now = Date.now();
             // Refresco inteligente: No saturar el IPC. Actualiza UI máx 1 vez cada 60ms
             if (now - lastUIUpdate > 60) {
               onProgress({ status: 'scanning', file: entry.name, duplicatesCount, totalFreedMB: totalMB.toFixed(2) });
               lastUIUpdate = now;
               // Permitir respirar al backend para no congelar Electron
               await new Promise(r => setTimeout(r, 2));
             }
           }
        }
      }

      await walkDir(target);

      const candidates = Array.from(filesBySize.values()).filter(list => list.length > 1);
      const hashes = new Set();

      for (const group of candidates) {
        for (const file of group) {
           try {
             const nowParams = Date.now();
             if (nowParams - lastUIUpdate > 60) {
                 onProgress({ status: 'hashing', file: path.basename(file), duplicatesCount, totalFreedMB: totalMB.toFixed(2) });
                 lastUIUpdate = nowParams;
             }

             const hash = await new Promise((resolve, reject) => {
                const hasher = crypto.createHash('md5');
                const stream = fs.createReadStream(file);
                stream.on('data', chunk => hasher.update(chunk));
                stream.on('end', () => resolve(hasher.digest('hex')));
                stream.on('error', reject);
             });

             if (hashes.has(hash)) {
                duplicatesCount++;
                const stats = await statAsync(file);
                totalMB += (stats.size / 1024 / 1024);
                
                const baseName = path.basename(file);
                let newPath = path.join(quarantineDir, baseName);
                let counter = 1;
                while (fs.existsSync(newPath)) {
                   const parsed = path.parse(baseName);
                   newPath = path.join(quarantineDir, `${parsed.name} (${counter})${parsed.ext}`);
                   counter++;
                }

                await renameAsync(file, newPath);
                onProgress({ status: 'moving', file: baseName, duplicatesCount, totalFreedMB: totalMB.toFixed(2) });
                await new Promise(r => setTimeout(r, 40));
             } else {
                hashes.add(hash);
             }
           } catch(e) {}
        }
      }

      onProgress({ status: 'done', duplicatesCount, totalFreedMB: totalMB.toFixed(2) });
      await new Promise(r => setTimeout(r, 500));
      this.isCleaning = false;

      return {
        success: true,
        duplicatesCount,
        totalFreedMB: totalMB
      };
    } catch (err) {
      this.isCleaning = false;
      throw err;
    }
  }
}

module.exports = new FileManager();