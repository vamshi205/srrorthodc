const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 2086; i <= 2092; i++) {
    let line = lines[i];
    let hex = Buffer.from(line).toString('hex');
    console.log(`Line ${i+1}: ${line}`);
    console.log(`Hex: ${hex}`);
}
