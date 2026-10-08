const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx');
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');

const searchStr = `      setSelectedDcId(null);
      setActiveQueue(nextStatus);
      setSearchParams({ queue: nextStatus });`;

const replaceStr = `      setSelectedDcId(dc.id);
      setDetailsDialogOpen(true);
      setActiveQueue(nextStatus);
      setSearchParams({ queue: nextStatus });`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replaceStr);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log("Successfully updated handleQuickRecordPayment to keep DC details tracker open!");
} else {
  console.log("searchStr not found!");
}
