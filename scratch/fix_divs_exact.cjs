const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const fixedBlock = `          {/* DC Tracker Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 mb-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">DC Tracker</h2>
              <p className="text-muted-foreground">
                Manage your delivery challans, track collections, and cash invoices.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <CollectPaymentsScroller
                savedDcs={savedDcs}
                cashInvoices={cashInvoices}
                onCollectPayment={openPaymentDialog}
                onViewDc={(dc, queue) => {
                  setActiveQueue(queue);
                  setSearchParams({ queue });
                  setSelectedDcId(dc.id);
                  setDetailsDialogOpen(true);
                }}
              />
              <DcTrackerNotifications
                savedDcs={savedDcs}
                cashInvoices={cashInvoices}
                onCollectPayment={openPaymentDialog}
                onRecordReturn={(dc) => openActionDialog("return", dc)}
                onViewDc={(dc, queue) => {
                  setActiveQueue(queue);
                  setSearchParams({ queue });
                  setSelectedDcId(dc.id);
                  setDetailsDialogOpen(true);
                }}
              />
            </div>
          </div>`.split('\n');

// Lines are 0-indexed.
// 2053 is index 2052.
// 2089 is index 2088.
lines.splice(2052, 2088 - 2052 + 1, ...fixedBlock);

fs.writeFileSync(path, lines.join('\n'));
console.log("Fixed mismatched div tags exactly by line number.");
