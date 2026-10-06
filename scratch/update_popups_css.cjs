const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\index.css';
let content = fs.readFileSync(path, 'utf8');

// Replace Dropdown, popover, dialog glass with Eyris style
const oldPopovers = `  /* Dropdown, popover, dialog glass */
  [data-radix-popper-content-wrapper] [role="menu"],
  [class*="bg-popover"],
  [data-radix-dialog-content],
  [data-radix-select-content] {
    background: rgba(255, 255, 255, 0.90) !important;
    backdrop-filter: blur(28px) saturate(200%) !important;
    -webkit-backdrop-filter: blur(28px) saturate(200%) !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    box-shadow: 0 12px 40px -8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95) !important;
  }

  .dark [data-radix-popper-content-wrapper] [role="menu"],
  .dark [class*="bg-popover"],
  .dark [data-radix-dialog-content],
  .dark [data-radix-select-content] {
    background: rgba(14, 22, 38, 0.88) !important;
    backdrop-filter: blur(28px) saturate(200%) !important;
    -webkit-backdrop-filter: blur(28px) saturate(200%) !important;
    border: 1px solid rgba(255, 255, 255, 0.09) !important;
    box-shadow: 0 12px 40px -8px rgba(0,0,0,0.55) !important;
  }`;

const newPopovers = `  /* Dropdown, popover, dialog Eyris */
  [data-radix-popper-content-wrapper] [role="menu"],
  [class*="bg-popover"],
  [data-radix-dialog-content],
  [data-radix-select-content] {
    background: #ffffff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: 1px solid hsl(214.3 31.8% 91.4%) !important;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06) !important;
    border-radius: 8px !important;
  }

  .dark [data-radix-popper-content-wrapper] [role="menu"],
  .dark [class*="bg-popover"],
  .dark [data-radix-dialog-content],
  .dark [data-radix-select-content] {
    background: #0f172a !important;
    border: 1px solid #1e293b !important;
  }`;

if (content.includes('backdrop-filter: blur(28px) saturate(200%) !important;')) {
    content = content.replace(oldPopovers, newPopovers);
    console.log("Updated Dialog/Popover styling in index.css");
}

fs.writeFileSync(path, content);
