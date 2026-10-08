const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx');
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');

// 1. Wrap start of overview tab
const oldStart = `<TabsContent value="overview" className="mt-3 space-y-3">

                  {/* Tracking + actions (courier-tracking style) */}`;

const newStart = `<TabsContent value="overview" className="mt-3 space-y-3">
                  <div className="space-y-3">
                    {/* Tracking + actions (courier-tracking style) */}`;

if (content.includes(oldStart)) {
  content = content.replace(oldStart, newStart);
  console.log("Updated overview tab start wrapper.");
}

// 2. Wrap end of overview tab before TabsContent close
const oldEnd = `                      </div>
                    </div>
                  )}
                </TabsContent>`;

const newEnd = `                      </div>
                    </div>
                  )}
                  </div>
                </TabsContent>`;

if (content.includes(oldEnd)) {
  content = content.replace(oldEnd, newEnd);
  console.log("Updated overview tab end wrapper.");
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log("SavedDcs.tsx saved successfully.");
