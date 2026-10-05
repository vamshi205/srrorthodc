const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

if (lines[2406].trim() === '<>' && lines[2407].trim() === '<>') {
    lines.splice(2407, 1);
    fs.writeFileSync(path, lines.join('\n'));
    console.log("Deleted extra <>");
} else {
    // maybe different line numbers, let's search for two consecutive <>
    for (let i = 2400; i < 2420; i++) {
        if (lines[i].trim() === '<>' && lines[i+1].trim() === '<>') {
            lines.splice(i+1, 1);
            fs.writeFileSync(path, lines.join('\n'));
            console.log("Deleted extra <> at line", i+2);
            process.exit(0);
        }
    }
    console.log("Did not find extra <>");
}
