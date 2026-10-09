const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/SavedDcs.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /(selectedDc\.returnedBy\}\r?\n\s*<\/strong>\r?\n\s*<\/div>\r?\n\s*\)\})/g;

if (regex.test(content)) {
  console.log("Found match via regex!");
  const insertion = `\n                                           {((h.meta?.verifiedBy as string) ||
                                             selectedDc.verifiedBy) && (
                                             <div>
                                               Verified by:{" "}
                                               <strong className="text-emerald-700 dark:text-emerald-400">
                                                 {(h.meta
                                                   ?.verifiedBy as string) ||
                                                   selectedDc.verifiedBy}
                                               </strong>
                                             </div>
                                           )}`;
  content = content.replace(regex, `$1${insertion}`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully inserted block!");
} else {
  console.log("Regex did not match.");
}
