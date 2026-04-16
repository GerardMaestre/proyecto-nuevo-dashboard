const s = 'val1 val2'; const re = /[^\\\\s"']+|"([^"]*)"|'([^']*)'/g; let arr = []; let m; while(m = re.exec(s)) arr.push(m[1]||m[2]||m[0]); console.log(arr);
