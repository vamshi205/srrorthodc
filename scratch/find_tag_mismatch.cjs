const fs = require('fs');
const path = require('path');

const code = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const lines = code.split('\n');

// Parse JSX tags line by line
const stack = [];

lines.forEach((line, idx) => {
  const lineNo = idx + 1;
  // Match tags like <Div ...>, <div>, </div>, </Dialog>, etc.
  const regex = /<\/?([A-Za-z0-9]+)(\s+[^\>]*|\s*)(\/?)>/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const full = match[0];
    const tagName = match[1];
    const isClosing = full.startsWith('</');
    const isSelfClosing = full.endsWith('/>') || ['img', 'input', 'br', 'hr'].includes(tagName.toLowerCase());

    if (isSelfClosing) {
      continue;
    }

    if (!isClosing) {
      stack.push({ tagName, lineNo, full });
    } else {
      if (stack.length === 0) {
        console.log(`ERROR: Extra closing tag </${tagName}> at Line ${lineNo}`);
      } else {
        const top = stack.pop();
        if (top.tagName !== tagName) {
          console.log(`MISMATCH at Line ${lineNo}: Closed </${tagName}> but top of stack was <${top.tagName}> from Line ${top.lineNo}`);
          // Push top back to preserve stack
          // stack.push(top);
        }
      }
    }
  }
});

console.log('Unclosed tags remaining on stack:', stack.length);
stack.forEach(item => {
  console.log(`Unclosed <${item.tagName}> opened at Line ${item.lineNo}`);
});
