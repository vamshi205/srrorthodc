const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');
// the extra </div> is around line 3478
for (let i = 3470; i < 3485; i++) {
    if (lines[i].includes('</div>') && lines[i].trim() === '</div>' && lines[i+1] && lines[i+1].includes('</>')) {
        console.log("Removing line", i + 1, ":", lines[i]);
        lines.splice(i, 1);
        break;
    }
}
fs.writeFileSync(path, lines.join('\n'));
console.log("Done");
