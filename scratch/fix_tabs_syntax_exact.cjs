const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx');
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');

const searchStr = `                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          Payment settlements, cash receipts, and bank transaction reconciliations for DC #{selectedDc.dcNo} will appear here once recorded.
                        </p>
                      </div>
                    )}
                </TabsContent>`;

const replaceStr = `                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          Payment settlements, cash receipts, and bank transaction reconciliations for DC #{selectedDc.dcNo} will appear here once recorded.
                        </p>
                      </div>
                    )
                  )}
                </TabsContent>`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replaceStr);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log("Replaced end of TabsContent payment successfully!");
} else {
  console.log("searchStr not found!");
}
