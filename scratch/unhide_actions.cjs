const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace table header wrapper
const headerTarget = `                                  {!selectedDc && (
                                    <th className="text-center p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[60px]">
                                      Actions
                                    </th>
                                  )}`;
const headerReplacement = `                                  <th className="text-center p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[60px]">
                                    Actions
                                  </th>`;
if (content.includes(headerTarget)) {
    content = content.replace(headerTarget, headerReplacement);
    console.log("Replaced header wrapper");
} else {
    console.log("Could not find header wrapper");
    // Try regex
    content = content.replace(/\{!selectedDc && \(\s*<th className="[^"]*w-\[60px\]"[^>]*>\s*Actions\s*<\/th>\s*\)\}/g, '<th className="text-center p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-[60px]">\n                                      Actions\n                                    </th>');
}

// Replace body wrapper start
const bodyTargetStart = `                                      {!selectedDc && (
                                        <td className="p-3 text-center">`;
const bodyReplacementStart = `                                      <td className="p-3 text-center">`;
if (content.includes(bodyTargetStart)) {
    content = content.replace(bodyTargetStart, bodyReplacementStart);
    console.log("Replaced body wrapper start");
} else {
    console.log("Could not find body wrapper start");
}

// Replace body wrapper end - we need to find the specific closing tag.
// It's a `</td>` followed by `)}`
const bodyTargetEnd = `                                        </td>
                                      )}`;
const bodyReplacementEnd = `                                        </td>`;
if (content.includes(bodyTargetEnd)) {
    content = content.replace(bodyTargetEnd, bodyReplacementEnd);
    console.log("Replaced body wrapper end");
} else {
    console.log("Could not find body wrapper end");
}

fs.writeFileSync(path, content);
console.log("Done");
