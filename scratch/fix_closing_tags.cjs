const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

let tableEndIdx = -1;
let cardContentEndIdx = -1;

for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('</CardContent>')) {
        cardContentEndIdx = i;
    }
    if (lines[i].includes('</table>') && cardContentEndIdx !== -1) {
        tableEndIdx = i;
        break;
    }
}

if (tableEndIdx !== -1 && cardContentEndIdx !== -1) {
    const replacement = [
        '                              </table>',
        '                            </div>',
        '                          </div>',
        '                        </>',
        '                      )}',
        '                    </div>',
        '                  </div>',
        '                </>',
        '              )}',
        '            </CardContent>'
    ];
    lines.splice(tableEndIdx, cardContentEndIdx - tableEndIdx + 1, ...replacement);
    fs.writeFileSync(path, lines.join('\n'));
    console.log("Successfully fixed closing tags");
} else {
    console.log("Could not find table or CardContent tags");
}
