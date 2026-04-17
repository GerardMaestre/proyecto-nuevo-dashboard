const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const execAsync = util.promisify(exec);
const fs = require('fs');

class DockerManager {
  constructor() {
    this.isBusy = false;
  }

  async startImmich(onProgress = () => {}) {
    if (this.isBusy) throw new Error('Operación de Docker en curso.');
    this.isBusy = true;

    try {
      const immichDir = process.env.HORUS_IMMICH_PATH || 'C:\\immich-app';

      onProgress({ status: 'checking', text: 'Verificando carpeta de origen...' });
      await new Promise(r => setTimeout(r, 500));

      if (!fs.existsSync(immichDir)) {
        throw new Error(`Carpeta no encontrada: ${immichDir}`);
      }

      onProgress({ status: 'checking_engine', text: 'Revisando motor Docker...' });
      
      let dockerUp = false;
      try {
        await execAsync('docker info');
        dockerUp = true;
      } catch (err) {
        dockerUp = false;
      }

      if (!dockerUp) {
        onProgress({ status: 'waking_engine', text: 'Despertando motor Desktop...' });
        
        if (fs.existsSync('C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe')) {
            exec('start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"', { shell: 'cmd.exe' });
        } else {
            exec('start docker-desktop://', { shell: 'cmd.exe' });
        }

        let attempts = 0;
        while (attempts < 24) {
          onProgress({ status: 'waking_engine_wait', text: `Esperando motor... (Intento ${attempts+1}/24)` });
          await new Promise(r => setTimeout(r, 5000));
          try {
            await execAsync('docker info');
            dockerUp = true;
            break;
          } catch(e) {}
          attempts++;
        }

        if (!dockerUp) {
          throw new Error('Docker no respondió tras 2 minutos.');
        }
      }

      onProgress({ status: 'deploying', text: 'Desplegando ecosistema (Postgres, Redis, IA, Servidor)...' });
      
      try {
        await execAsync('docker compose up -d', { cwd: immichDir });
      } catch (err) {
         try {
            await execAsync('docker-compose up -d', { cwd: immichDir });
         } catch(e) {
            throw new Error('Fallo la creación de los contenedores Docker.');
         }
      }

      onProgress({ status: 'done', text: 'Magia hecha! El servidor está en línea.' });
      await new Promise(r => setTimeout(r, 1000));

      this.isBusy = false;
      return { success: true };

    } catch (e) {
      this.isBusy = false;
      throw e;
    }
  }

  async stopImmich(onProgress = () => {}) {
    if (this.isBusy) throw new Error('Operación de Docker en curso.');
    this.isBusy = true;

    try {
      const immichDir = process.env.HORUS_IMMICH_PATH || 'C:\\immich-app';

      onProgress({ status: 'checking', text: 'Verificando motor Docker...' });
      await new Promise(r => setTimeout(r, 500));

      let dockerUp = false;
      try {
        await execAsync('docker info');
        dockerUp = true;
      } catch(e) {}

      if (!dockerUp) {
        onProgress({ status: 'done', text: 'Motor inactivo. Sistema limpio.' });
        await new Promise(r => setTimeout(r, 1000));
        this.isBusy = false;
        return { success: true };
      }

      onProgress({ status: 'stopping', text: 'Interceptando y apagando contenedores...' });

      try {
         await execAsync('docker compose down', { cwd: immichDir });
      } catch (err) {
         try {
            await execAsync('docker-compose down', { cwd: immichDir });
         } catch(e) {} // Ignorar fallo si ya está apagado
      }

      onProgress({ status: 'killing_engine', text: 'Cerrando Docker y purgando VmmemWSL en RAM...' });
      await new Promise(r => setTimeout(r, 1000));
      
      try {
         // Matar el proceso principal de la UI de Docker
         await execAsync('taskkill /IM "Docker Desktop.exe" /F');
      } catch(e) {}

      try {
         // Obligar a WSL a apagarse completamente liberando toda la RAM del VmmemWSL
         await execAsync('wsl --shutdown');
      } catch(e) {}

      onProgress({ status: 'done', text: 'Memoria liberada y contenedores neutralizados con éxito.' });
      await new Promise(r => setTimeout(r, 1500));

      this.isBusy = false;
      return { success: true };
    } catch(e) {
      this.isBusy = false;
      throw e;
    }
  }
}

module.exports = new DockerManager();
