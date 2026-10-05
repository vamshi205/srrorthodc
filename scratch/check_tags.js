import fs from 'fs';

const content = fs.readFileSync('src/pages/SavedDcs.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
for (let i = 6499; i < 7219; i++) {
  const line = lines[i];
  const lineNo = i + 1;
  // Match XML/JSX tags (excluding comments)
  const cleanLine = line.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const regex = /<\/?([a-zA-Z0-9]+)(\s[^>]*?)?(\/+)?>/g;
  let match;
  while ((match = regex.exec(cleanLine)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>');

    if (isSelfClosing) continue;

    if (isClosing) {
      if (stack.length === 0) {
        console.log(`Line ${lineNo}: Unexpected closing tag </${tagName}>`);
      } else {
        const top = stack.pop();
        if (top.tagName !== tagName) {
          console.log(`Line ${lineNo}: Mismatch! Closing </${tagName}> but top was <${top.tagName}> from Line ${top.lineNo}`);
          stack.push(top); // push back
        }
      }
    } else {
      stack.push({ tagName, lineNo });
    }
  }
}

console.log('Remaining unclosed tags on stack starting from line 6500:');
console.log(stack);
