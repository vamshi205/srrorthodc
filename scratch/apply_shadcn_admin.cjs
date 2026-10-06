const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Convert Page Header to Shadcn Dashboard Header
const oldHeader = `<div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 flex items-center justify-center text-teal-800 dark:text-teal-200 shadow-sm shrink-0">
                <List className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold font-sans text-foreground tracking-tight">
                    DC Operations &amp; Inventory Tracker
                  </h1>
                  <Badge variant="outline" className="bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border-teal-300 text-[11px] font-bold rounded-full">
                    Live Status
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                  Automated cutoff alerts, collection follow-ups &amp; cash invoices
                </p>
              </div>
            </div>`;

const newHeader = `<div className="flex items-center justify-between space-y-2 mb-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">DC Tracker</h2>
              <p className="text-muted-foreground">
                Manage your delivery challans, track collections, and cash invoices.
              </p>
            </div>`;

if (content.includes('DC Operations &amp; Inventory Tracker')) {
    content = content.replace(oldHeader, newHeader);
} else {
    console.log("Header not found exactly, might need regex.");
}

// 2. Remove all glass-card classes and heavy shadows
content = content.replace(/className="glass-card[^"]*"/g, 'className="bg-card text-card-foreground shadow-sm border rounded-xl"');
content = content.replace(/glass-card/g, 'bg-card text-card-foreground shadow-sm');
content = content.replace(/shadow-\[0_4px_20px_-4px_rgba[^\]]*\]/g, 'shadow-sm');
content = content.replace(/backdrop-blur-md/g, '');
content = content.replace(/bg-white\/95/g, 'bg-background');
content = content.replace(/bg-white\/70/g, 'bg-card');
content = content.replace(/border-border\/60/g, 'border-border');

// 3. Convert Stats Cards to Shadcn Admin layout
// Currently they look like:
// <Card className="..."> <CardContent className="p-3 sm:p-5"> <div flex...> <div min-w-0> <p title> <p number> ... <div icon>
// Shadcn Admin looks like:
// <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Title</CardTitle> <Icon className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">+2350</div> <p className="text-xs text-muted-foreground">+180% from last month</p> </CardContent> </Card>

// It's too complex to regex replace the entire nested structure perfectly without AST, 
// so we will just replace the outermost card classes to ensure they use standard Shadcn style.
content = content.replace(/<Card className="bg-white border border-slate-100[^"]*">/g, '<Card>');

// 4. Update the Data Table Toolbar (Search input & filters)
const searchInputOld = `className="pl-9 h-10 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 focus-visible:ring-teal-600 rounded-lg shadow-sm font-medium text-slate-800 dark:text-slate-200"`;
const searchInputNew = `className="pl-9 h-8 w-[150px] lg:w-[250px] bg-background border-input"`;
content = content.replace(searchInputOld, searchInputNew);

const filtersWrapperOld = `className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-4 rounded-lg border border-slate-200/80 mb-2 pb-4"`;
const filtersWrapperNew = `className="flex items-center justify-between py-4"`;
content = content.replace(filtersWrapperOld, filtersWrapperNew);

// 5. Table wrapper
const tableWrapperOld = `<div className="w-full">
                        <div className="border-t-2 border-border/60">`;
const tableWrapperNew = `<div className="w-full">
                        <div className="rounded-md border">`;
content = content.replace(tableWrapperOld, tableWrapperNew);

// 6. Table Header (thead)
content = content.replace(/className="h-12 border-b border-slate-200 bg-slate-50\/80 dark:bg-slate-800\/50 hover:bg-slate-50\/80"/g, 'className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"');
content = content.replace(/className="h-10 sm:h-12 border-b-2 border-border\/60 bg-muted\/30 hover:bg-muted\/30"/g, 'className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"');

fs.writeFileSync(path, content);
console.log("Converted SavedDcs.tsx to Shadcn Admin layout.");
