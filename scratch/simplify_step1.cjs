const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\components\\ortho\\OrthoApp.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Simplify Welcome Screen
const welcomeRegex = /<div className="glass-card rounded-2xl p-6 sm:p-10 border-2 border-teal-500\/30 text-center space-y-6 shadow-xl max-w-5xl mx-auto my-4">/g;
content = content.replace(welcomeRegex, '<div className="bg-card rounded-xl p-6 sm:p-10 border shadow-sm text-center space-y-6 max-w-5xl mx-auto my-4">');

// 2. Simplify Step 1 Form Header
const step1Regex = /<div className="glass-card rounded-2xl p-5 sm:p-8 border-2 border-teal-500\/40 bg-teal-50\/60 dark:bg-slate-900\/90 shadow-xl max-w-4xl mx-auto my-2 space-y-6">[\s\S]*?<div className="flex items-center justify-between pb-4 border-b border-teal-200 dark:border-slate-800">[\s\S]*?<div className="flex items-center gap-3">[\s\S]*?<div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">[\s\S]*?1[\s\S]*?<\/div>[\s\S]*?<div>[\s\S]*?<h2 className="font-sans font-extrabold text-lg sm:text-xl text-slate-900 dark:text-slate-100">[\s\S]*?Step 1: Enter Hospital &amp; DC Details[\s\S]*?<\/h2>[\s\S]*?<p className="text-xs text-muted-foreground mt-0\.5">[\s\S]*?Please fill hospital and delivery details first\. After submission, you will be taken to procedure selection\.[\s\S]*?<\/p>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<Badge className="bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold text-xs">[\s\S]*?Auto DC[\s\S]*?<\/Badge>[\s\S]*?<\/div>/m;

const newStep1 = `<div className="bg-card rounded-xl p-6 border shadow-sm max-w-4xl mx-auto my-4 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                            1
                          </div>
                          <div>
                            <h2 className="font-semibold text-lg tracking-tight">
                              Step 1: Enter Hospital &amp; DC Details
                            </h2>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              Please fill hospital and delivery details first.
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="w-fit">
                          Auto DC
                        </Badge>
                      </div>`;

content = content.replace(step1Regex, newStep1);

// 3. Simplify Step 2 Header
const step2Regex = /<div className="glass-card rounded-xl p-2\.5 sm:p-4 min-w-0 flex-1 flex flex-col min-h-\[400px\]">/g;
content = content.replace(step2Regex, '<div className="bg-card border rounded-xl p-4 min-w-0 flex-1 flex flex-col min-h-[400px] shadow-sm">');

fs.writeFileSync(path, content);
console.log("Replaced OrthoApp UI elements with simple Shadcn styles.");
