const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src', 'renderer', 'components', 'ScriptList.js');
let scriptList = fs.readFileSync(targetPath, 'utf8');

// The replacement logic for cleanJunk
const cleanJunkOld = `        let isScanning = true;
        let virtualProgress = 2;

        const progressTimer = setInterval(() => {
          if (!isScanning) return;
          virtualProgress += (95 - virtualProgress) * 0.05; // Suavizado asintónico sin parpadeos a 15
          progressBarEl.style.width = virtualProgress + '%';
        }, 100);

        if (this.cleanupProgressUnsub) this.cleanupProgressUnsub();
        
        let finalMB = "0.00";
        let finalFiles = 0;

        if (window.horus && window.horus.events && window.horus.events.onSystemProgress) {
          this.cleanupProgressUnsub = window.horus.events.onSystemProgress((data) => {
            if (!data) return;
            
            if (data.status === 'scanning' || data.status === 'cleaning') {
              finalFiles = data.filesDeleted || 0;
              finalMB = (data.totalFreedMB / 1024).toFixed(2); // Convert to Gigas visually or just Mega? Mmm let's keep it MB but larger format. Wait, if it's MB, I'll divide by 1024 to make it GB if large.
              
              if (data.totalFreedMB > 1000) {
                 finalMB = (data.totalFreedMB / 1024).toFixed(2) + ' GB';
              } else {
                 finalMB = (data.totalFreedMB || 0).toFixed(2) + ' MB';
              }
              
              filesCountEl.textContent = finalFiles;
              mbFreedEl.textContent = finalMB;
              currentFileEl.textContent = data.file || data.folder || 'Escaneando sectores...';
            } 
          });
        }`;

const cleanJunkNew = `        let isScanning = true;
        let virtualProgress = 2;
        let visFiles = 0;
        let visMB = 0;
        let targetFiles = 0;
        let targetMB = 0;

        const progressTimer = setInterval(() => {
          if (!isScanning) return;
          virtualProgress += (95 - virtualProgress) * 0.05;
          progressBarEl.style.width = virtualProgress + '%';
          
          visFiles += (targetFiles - visFiles) * 0.1;
          visMB += (targetMB - visMB) * 0.1;

          filesCountEl.textContent = Math.round(visFiles);
          if (visMB > 1000) {
             mbFreedEl.textContent = (visMB / 1024).toFixed(2) + ' GB';
          } else {
             mbFreedEl.textContent = visMB.toFixed(2) + ' MB';
          }
        }, 30);

        if (this.cleanupProgressUnsub) this.cleanupProgressUnsub();
        
        let finalMB = "0.00";
        let finalFiles = 0;

        if (window.horus && window.horus.events && window.horus.events.onSystemProgress) {
          this.cleanupProgressUnsub = window.horus.events.onSystemProgress((data) => {
            if (!data) return;
            
            if (data.status === 'scanning' || data.status === 'cleaning') {
              finalFiles = data.filesDeleted || 0;
              targetFiles = finalFiles;
              targetMB = data.totalFreedMB || 0;
              
              if (data.totalFreedMB > 1000) {
                 finalMB = (data.totalFreedMB / 1024).toFixed(2) + ' GB';
              } else {
                 finalMB = (data.totalFreedMB || 0).toFixed(2) + ' MB';
              }
              
              currentFileEl.textContent = data.file || data.folder || 'Escaneando sectores...';
            } 
          });
        }`;

// The replacement logic for findDuplicates
const duplicatesOld = `        let isScanning = true;
        let virtualProgress = 2;

        const progressTimer = setInterval(() => {
          if (!isScanning) return;
          virtualProgress += (95 - virtualProgress) * 0.05; // Suavizado asintónico progresivo continuo
          progressBarEl.style.width = virtualProgress + '%';
        }, 100);

        if (this.duplicatesProgressUnsub) this.duplicatesProgressUnsub();
        
        let finalMB = "0.00";
        let finalFiles = 0;

        if (window.horus && window.horus.events && window.horus.events.onSystemProgress) {
          this.duplicatesProgressUnsub = window.horus.events.onSystemProgress((data) => {
            if (!data) return;
            
            if (data.status === 'scanning' || data.status === 'hashing' || data.status === 'moving') {
              finalFiles = data.duplicatesCount || 0;
              let parsedMB = parseFloat(data.totalFreedMB) || 0;
              
              if (parsedMB > 1000) {
                 finalMB = (parsedMB / 1024).toFixed(2) + ' GB';
              } else {
                 finalMB = parsedMB.toFixed(2) + ' MB';
              }
              
              filesCountEl.textContent = finalFiles;
              mbFreedEl.textContent = finalMB;

              let actionStr = 'Scn: ';
              if (data.status === 'hashing') actionStr = 'Hash: ';
              if (data.status === 'moving') actionStr = 'Aisl: ';

              currentFileEl.textContent = actionStr + (data.file || data.folder || '...');
            } 
          });
        }`;

const duplicatesNew = `        let isScanning = true;
        let virtualProgress = 2;
        let visFiles = 0;
        let visMB = 0;
        let targetFiles = 0;
        let targetMB = 0;

        const progressTimer = setInterval(() => {
          if (!isScanning) return;
          virtualProgress += (95 - virtualProgress) * 0.05;
          progressBarEl.style.width = virtualProgress + '%';
          
          visFiles += (targetFiles - visFiles) * 0.1;
          visMB += (targetMB - visMB) * 0.1;

          filesCountEl.textContent = Math.round(visFiles);
          if (visMB > 1000) {
             mbFreedEl.textContent = (visMB / 1024).toFixed(2) + ' GB';
          } else {
             mbFreedEl.textContent = visMB.toFixed(2) + ' MB';
          }
        }, 30);

        if (this.duplicatesProgressUnsub) this.duplicatesProgressUnsub();
        
        let finalMB = "0.00";
        let finalFiles = 0;

        if (window.horus && window.horus.events && window.horus.events.onSystemProgress) {
          this.duplicatesProgressUnsub = window.horus.events.onSystemProgress((data) => {
            if (!data) return;
            
            if (data.status === 'scanning' || data.status === 'hashing' || data.status === 'moving') {
              finalFiles = data.duplicatesCount || 0;
              let parsedMB = parseFloat(data.totalFreedMB) || 0;
              
              targetFiles = finalFiles;
              targetMB = parsedMB;

              if (parsedMB > 1000) {
                 finalMB = (parsedMB / 1024).toFixed(2) + ' GB';
              } else {
                 finalMB = parsedMB.toFixed(2) + ' MB';
              }

              let actionStr = 'Scn: ';
              if (data.status === 'hashing') actionStr = 'Hash: ';
              if (data.status === 'moving') actionStr = 'Aisl: ';

              currentFileEl.textContent = actionStr + (data.file || data.folder || '...');
            } 
          });
        }`;

let cleanTries = Array.from(scriptList.matchAll(/let isScanning = true;\s*let virtualProgress = 2;\s*const progressTimer = setInterval\([^]+?if \(!data\) return;\s*if \(data.status === 'scanning'.+?currentFileEl.textContent =[^}]+}/g));

if (scriptList.includes(cleanJunkOld)) {
  scriptList = scriptList.replace(cleanJunkOld, cleanJunkNew);
  console.log("Successfully mutated cleanJunk code");
} else {
  // Let's do a more robust regex-based manipulation if strings miss.
  console.log("cleanJunkOld direct match failed. Attempting robust Regex.");
  const rx1 = /let isScanning = true;[\s\S]*?currentFileEl\.textContent = data\.file[\s\S]*?\}\s*\);\s*\}/;
  if(rx1.test(scriptList)){
  	scriptList = scriptList.replace(rx1, cleanJunkNew);
  	console.log("Successfully mutated cleanJunk via regex");
  } else {
  	console.log("Regex also failed for cleanJunk");
  }
}

if (scriptList.includes(duplicatesOld)) {
  scriptList = scriptList.replace(duplicatesOld, duplicatesNew);
  console.log("Successfully mutated findDuplicates code");
} else {
  console.log("duplicatesOld direct match failed. Attempting robust Regex.");
  const rx2 = /let isScanning = true;[\s\S]*?finalFiles = data\.duplicatesCount[\s\S]*?currentFileEl\.textContent = actionStr[\s\S]*?\}\s*\);\s*\}/;
  if(rx2.test(scriptList)) {
  	// wait, cleanJunkNew vs duplicatesNew
    let m = scriptList.match(rx2);
    if(m) {
       let rep = scriptList.substring(0, m.index) + duplicatesNew + scriptList.substring(m.index + m[0].length);
       scriptList = rep;
       console.log("Successfully mutated findDuplicates via regex");
    }
  } else {
     console.log("Regex also failed for duplicatesOld");
  }
}

fs.writeFileSync(targetPath, scriptList, 'utf8');
