const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Page Header
const headerRegex = /\{\/\* DC Tracker Operations & Reminders Toolbar matching Standard Secondary Header \*\/\}\s*<div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-sm">[\s\S]*?<p className="text-xs text-muted-foreground mt-0\.5 hidden sm:block">\s*Automated cutoff alerts, collection follow-ups &amp; cash invoices\s*<\/p>\s*<\/div>\s*<\/div>/m;

const newHeader = `<div className="flex items-center justify-between space-y-2 mb-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">DC Tracker</h2>
              <p className="text-muted-foreground">
                Manage your delivery challans, track collections, and cash invoices.
              </p>
            </div>
          </div>`;

content = content.replace(headerRegex, newHeader);

// 2. Stats Cards
const statsCardsRegex = /<div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">[\s\S]*?<\/div>\s*\)\}/m;

// Check if we can find dashboardMetrics
if (content.match(statsCardsRegex)) {
  const newStats = `<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending DCs</CardTitle>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading && savedDcs.length === 0 ? <span className="inline-block w-8 h-8 bg-slate-200 animate-pulse rounded" /> : dashboardMetrics.pendingDcs}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Awaiting Invoice</CardTitle>
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading && savedDcs.length === 0 ? <span className="inline-block w-8 h-8 bg-slate-200 animate-pulse rounded" /> : dashboardMetrics.returnedAwaiting}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unpaid Cash</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading && savedDcs.length === 0 ? <span className="inline-block w-8 h-8 bg-slate-200 animate-pulse rounded" /> : dashboardMetrics.unpaidCash}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Turnaround</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading && savedDcs.length === 0 ? <span className="inline-block w-8 h-8 bg-slate-200 animate-pulse rounded" /> : \`\${dashboardMetrics.avgTurnaround}d\`}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}`;
  content = content.replace(statsCardsRegex, newStats);
}

// 3. Search Bar and Filters inside the main card
const filterBarRegex = /<div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900\/60 p-3 sm:p-4 rounded-xl border border-slate-200\/80">/g;
content = content.replace(filterBarRegex, '<div className="flex items-center justify-between py-4">');

const searchInputOld = /className="pl-9 h-10 bg-white\/80 dark:bg-slate-900\/80 border-slate-200 dark:border-slate-800 focus-visible:ring-teal-600 rounded-lg shadow-sm font-medium text-slate-800 dark:text-slate-200"/g;
content = content.replace(searchInputOld, 'className="pl-9 h-8 w-[150px] lg:w-[250px] bg-background border-input text-sm"');

// 4. Data Table Container
const tableContainerOld = /<div className="border-t-2 border-border\/60">/g;
content = content.replace(tableContainerOld, '<div className="rounded-md border">');

// 5. Table Header row
const theadOld = /className="h-10 sm:h-12 border-b-2 border-border\/60 bg-muted\/30 hover:bg-muted\/30"/g;
content = content.replace(theadOld, 'className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"');

// 6. Sticky banner (Top Action Banner when a DC is selected)
const bannerOld = /className="sticky top-\[80px\] z-20 mb-4 mt-2 p-2 px-4 bg-white\/95 backdrop-blur-md border border-slate-200\/60 text-slate-800 rounded-xl shadow-\[0_4px_20px_-4px_rgba\(0,0,0,0\.1\)\] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 dark:bg-slate-900\/95 dark:border-slate-800 dark:text-slate-100"/g;
content = content.replace(bannerOld, 'className="sticky top-[80px] z-20 mb-4 mt-2 p-3 bg-card border rounded-md shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"');


fs.writeFileSync(path, content);
console.log("Successfully transformed SavedDcs.tsx to Shadcn Admin layout!");
