import fs from 'fs';

const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace mousemove block in desktop table rows
const targetRegex = /<tr\s+key=\{dc\.id\}\s+onMouseMove=\{[\s\S]*?onClick=\{/g;
const replacement = `<tr
  key={dc.id}
  className={\`group border-b border-border/50 transition-colors duration-150 cursor-pointer \${
    selectedDcId === dc.id
      ? "bg-teal-500/10 hover:bg-teal-500/15 border-l-4 border-l-teal-600 font-semibold"
      : "hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
  }\`}
  onClick={`

if (targetRegex.test(content)) {
  content = content.replace(targetRegex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully replaced desktop table row hover animation');
} else {
  console.log('Regex target not found');
}
