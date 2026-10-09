const fs = require('fs');
const filePath = 'c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import
if (!content.includes('DcWorkflowMap')) {
  content = content.replace(
    'import { CollectPaymentsScroller } from "@/components/ortho/CollectPaymentsScroller";',
    'import { CollectPaymentsScroller } from "@/components/ortho/CollectPaymentsScroller";\nimport { DcWorkflowMap } from "@/components/ortho/DcWorkflowMap";'
  );
}

// 2. Render DcWorkflowMap inside CardHeader
const regex = /(<CardHeader className="p-3 sm:p-4 space-y-3 sm:space-y-4">)/;

if (regex.test(content)) {
  content = content.replace(
    regex,
    `$1\n                {/* DC Workflow Map (Default Collapsed/Hidden) */}\n                <DcWorkflowMap\n                  activeQueue={activeQueue}\n                  onSelectQueue={(queue) => {\n                    setActiveQueue(queue);\n                    setSearchParams({ queue });\n                    setSelectedDcId(null);\n                  }}\n                  statusCounts={statusCounts}\n                />\n`
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully inserted DcWorkflowMap into SavedDcs.tsx!");
} else {
  console.error("CardHeader regex match failed!");
}
