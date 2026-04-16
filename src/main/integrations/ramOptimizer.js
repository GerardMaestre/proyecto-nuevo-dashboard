const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = util.promisify(exec);

/**
 * Optimizador Nativo de Memoria RAM (Sustituye a Purgar_ram.py)
 * 
 * Llama a la API de Windows psapi.dll -> EmptyWorkingSet para todos los procesos
 * de forma invisible mediante la compilación dinámica de código C# en PowerShell.
 * Otorga permisos de Administrador usando el verbo "RunAs".
 */
class RamOptimizer {
  constructor() {
    this.isOptimizing = false;
  }

  /**
   * Ejecuta la rutina de purgado de memoria.
   * @param {Function} onProgress Callback para enviar logs a la consola de la UI (Terminal V3)
   * @returns {Promise<{ success: boolean, freedMB: string, message: string }>}
   */
  async optimize(onProgress = () => {}) {
    if (this.isOptimizing) {
      throw new Error('La optimización ya está en curso.');
    }
    this.isOptimizing = true;

    try {
      const memBeforeObj = os.freemem();
      const memBeforeMB = (memBeforeObj / 1024 / 1024).toFixed(2);
      
      onProgress(`\x1b[36m[*] Iniciando purgado de memoria a nivel del Kernel...\x1b[0m`);
      onProgress(`\x1b[90m    RAM Libre actual: ${memBeforeMB} MB\x1b[0m`);
      onProgress(`\x1b[33m[*] Inyectando llamada a psapi.dll (EmptyWorkingSet)...\x1b[0m`);

      // Script C# embebido en PowerShell para forzar la liberación de Working Set
      const psScript = `
        $code = @"
        using System;
        using System.Runtime.InteropServices;
        public class RamCleaner {
            [DllImport("psapi.dll")]
            public static extern int EmptyWorkingSet(IntPtr hwProc);
        }
"@
        Add-Type -TypeDefinition $code
        $count = 0
        Get-Process | ForEach-Object {
            try {
                [RamCleaner]::EmptyWorkingSet($_.Handle) | Out-Null
                $count++
            } catch {}
        }
        Write-Output "Procesos purgados: $count"
      `;

      // Se guarda el payload de powershell en temporales
      const tmpPath = path.join(os.tmpdir(), 'horus_ram_purge.ps1');
      fs.writeFileSync(tmpPath, psScript, 'utf8');

      // Se lanza invisible usando Start-Process con credenciales RunAs
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \\"${tmpPath}\\"' -Verb RunAs -Wait"`;

      await execAsync(command);

      // Limpieza segura
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }

      // Dejar que el kernel respire
      await new Promise(r => setTimeout(r, 1000));

      const memAfterObj = os.freemem();
      const memAfterMB = (memAfterObj / 1024 / 1024).toFixed(2);
      const freed = (memAfterObj - memBeforeObj) / 1024 / 1024;
      const freedMBStr = freed > 0 ? freed.toFixed(2) : "0.00";

      onProgress(`\n\x1b[32m[OK] PURGA COMPLETADA.\x1b[0m`);
      onProgress(`\x1b[36m[>] Se han recuperado \x1b[1m\x1b[32m${freedMBStr} MB\x1b[0m \x1b[36mde RAM inactiva.\x1b[0m`);
      onProgress(`\x1b[90m    RAM Libre actual: ${memAfterMB} MB\x1b[0m`);

      this.isOptimizing = false;

      return {
        success: true,
        freedMB: freedMBStr,
        message: 'Optimización de memoria completada con éxito.'
      };
    } catch (error) {
      this.isOptimizing = false;
      onProgress(`\n\x1b[31m[!] Error del Kernel durante la purga:\x1b[0m ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RamOptimizer();