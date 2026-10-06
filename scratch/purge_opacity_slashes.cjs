const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Customers.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace opacity slashes like /60, /50, /40, /30, /20, /10, /70, /80 in Tailwind color class names inside Customers.tsx
// e.g. dark:bg-purple-950/20 => dark:bg-purple-950
// e.g. bg-amber-50/60 => bg-amber-50
// e.g. dark:bg-purple-900/60 => dark:bg-purple-900

const cleaned = content.replace(/(bg-[a-z]+-[0-9]+)\/([0-9]+)/g, '$1')
                       .replace(/(text-[a-z]+-[0-9]+)\/([0-9]+)/g, '$1')
                       .replace(/(border-[a-z]+-[0-9]+)\/([0-9]+)/g, '$1')
                       .replace(/(ring-[a-z]+-[0-9]+)\/([0-9]+)/g, '$1');

fs.writeFileSync(filePath, cleaned, 'utf8');
console.log('Successfully purged opacity slashes from Customers.tsx');
