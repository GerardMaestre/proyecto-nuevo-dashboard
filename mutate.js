const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'renderer', 'components', 'ScriptList.js');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. cleanJunk replacement
const cleanJunkRegex = /let isScanning = true;\s*let virtualProgress = 2;\s*const progressTimer = setInterval\(\(\) => \{\s*if \(\!isScanning\) return;\s*virtualProgress \+= \(95 - virtualProgress\) \* 0\.05;[^}]+\},\s*100\);[\s\S]*?(this\.cleanupProgressUnsub = window\.horus\.events\.onSystemProgress\(\(data\) => \{[\s\S]*?finalFiles = data\.filesDeleted \|\| 0;\s*finalMB =[^;]+;[\s\S]*?if \(data\.totalFreedMB > 1000\) \{[\s\S]*?\} else \{[\s\S]*?\}[\s\S]*?filesCountEl\.textContent = finalFiles;\s*mbFreedEl\.textContent = finalMB;)/g;

// Instead of tricky full regex, let's replace by chunks to be 100% safe.
// Wait, I can just replace the definition of progressTimer and the onSystemProgress part.

// Let's do it with replace string.
