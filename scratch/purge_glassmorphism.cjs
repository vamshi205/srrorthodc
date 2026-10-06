const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\index.css';
let content = fs.readFileSync(path, 'utf8');

// Strip out everything from /* ─── Glassmorphism Utility Classes ─────────────────────────────────────────── */
// Down to the print styles
const startToken = '/* ─── Glassmorphism Utility Classes ─────────────────────────────────────────── */';
const endToken = '/* ─── Print Styles ───────────────────────────────────────────────────────────── */';

const startIndex = content.indexOf(startToken);
const endIndex = content.indexOf(endToken);

if (startIndex !== -1 && endIndex !== -1) {
    // Keep animations but drop all the glass utilities
    const beforeGlass = content.substring(0, startIndex);
    
    // We want to keep the animations and mobile browser reset
    const animationsMatch = content.match(/\/\* Prevent mobile browsers from zooming the page[^]*/);
    const toAppend = animationsMatch ? animationsMatch[0] : content.substring(endIndex);

    content = beforeGlass + toAppend;
    fs.writeFileSync(path, content);
    console.log("Purged glassmorphism from index.css for clean Shadcn Admin style.");
} else {
    console.log("Could not find tokens in index.css");
}
