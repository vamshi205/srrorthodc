const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// Verify line 2089 is `          </div>`
if (lines[2088].includes('</div>')) {
    lines.splice(2088, 1); // remove line 2089 (index 2088)
    fs.writeFileSync(path, lines.join('\n'));
    console.log("Removed extra </div> at line 2089.");
} else {
    console.log("Line 2089 is not </div>: " + lines[2088]);
}
