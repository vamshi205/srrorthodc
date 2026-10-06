const fs = require('fs');
const glob = require('glob');

const files = glob.sync('c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\**\\*.tsx');

let updatedCount = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('font-display')) {
        content = content.replace(/font-display/g, 'font-sans');
        fs.writeFileSync(file, content);
        updatedCount++;
    }
});

console.log(`Updated ${updatedCount} files, replaced font-display with font-sans.`);
