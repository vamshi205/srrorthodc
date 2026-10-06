const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\index.css';
let content = fs.readFileSync(path, 'utf8');

// 1. Change Background
content = content.replace('--background: 0 0% 100%;', '--background: 210 40% 98.5%;');

// 2. Change Primary color to Eyris Blue
content = content.replace('--primary: 173 58% 39%;', '--primary: 221 83% 53%;');
content = content.replace('--ring: 173 58% 39%;', '--ring: 221 83% 53%;');

// 3. Remove Glassmorphism from Cards
const oldCard = `  /* Shadcn Card override */
  .card, [class*="bg-card"] {
    background: rgba(255, 255, 255, 0.72) !important;
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    box-shadow: 0 2px 12px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9) !important;
  }`;

const newCard = `  /* Shadcn Card override (Eyris Flat) */
  .card, [class*="bg-card"] {
    background: #ffffff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: 1px solid hsl(214.3 31.8% 91.4%) !important;
    box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.05) !important;
    border-radius: 12px !important;
  }`;

if (content.includes(oldCard)) {
    content = content.replace(oldCard, newCard);
    console.log("Updated Card styling");
}

// 4. Update Header / Sidebar to solid flat
const oldAside = `  /* Header / Sidebar frosted glass */
  aside {
    background: rgba(255, 255, 255, 0.75) !important;
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-color: rgba(0, 0, 0, 0.07) !important;
  }`;
const newAside = `  /* Header / Sidebar solid flat (Eyris) */
  aside {
    background: #ffffff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border-color: hsl(214.3 31.8% 91.4%) !important;
  }`;

if (content.includes(oldAside)) {
    content = content.replace(oldAside, newAside);
    console.log("Updated aside styling");
}

const oldHeader = `  header {
    background: rgba(255, 255, 255, 0.80) !important;
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-color: rgba(0, 0, 0, 0.07) !important;
  }`;
const newHeader = `  header {
    background: #ffffff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border-bottom: 1px solid hsl(214.3 31.8% 91.4%) !important;
    box-shadow: 0 1px 2px 0 rgba(0,0,0,0.03) !important;
  }`;

if (content.includes(oldHeader)) {
    content = content.replace(oldHeader, newHeader);
    console.log("Updated header styling");
}

fs.writeFileSync(path, content);
console.log("index.css updated successfully.");
