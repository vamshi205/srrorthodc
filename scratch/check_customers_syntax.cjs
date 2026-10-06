const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Customers.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log('Total lines:', lines.length);

// Check backtick parity
let totalBackticks = 0;
lines.forEach((line, idx) => {
  const count = (line.match(/`/g) || []).length;
  totalBackticks += count;
  if (count % 2 !== 0) {
    console.log(`Line ${idx + 1} has odd backticks (${count}):`, line.trim());
  }
});

console.log('Total backticks:', totalBackticks);

// Check for unclosed regex or template strings
lines.forEach((line, idx) => {
  if (line.includes('/')) {
    // Check if line has single slash that might look like regex start to SWC
    if (line.match(/\/[^\/\*\>\=]/) && !line.includes('//') && !line.includes('</') && !line.includes('/>') && !line.includes('http')) {
      console.log(`Line ${idx + 1} suspicious slash:`, line.trim());
    }
  }
});
