const esbuild = require('esbuild');
const fs = require('fs');

const code = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  const testLines = [...lines];
  testLines[i] = '{/* comment */}';
  try {
    esbuild.transformSync(testLines.join('\n'), { loader: 'tsx' });
    console.log(`BINGO! Replacing single Line ${i + 1} FIXED the esbuild error!`);
    console.log(`Line ${i + 1} content:`, lines[i]);
  } catch (e) {
    // If error message changes from 'Unterminated regular expression', log it
    if (e.errors && e.errors[0] && e.errors[0].text !== 'Unterminated regular expression') {
      // Error changed
    }
  }
}
