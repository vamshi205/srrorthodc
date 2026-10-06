const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let content = fs.readFileSync(path, 'utf8');

const brokenBlock = `<div className="flex items-center justify-between space-y-2 mb-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">DC Tracker</h2>
              <p className="text-muted-foreground">
                Manage your delivery challans, track collections, and cash invoices.
              </p>
            </div>
          </div>

            {/* Live Collect Payments Scroller */}
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

            <div className="flex items-center gap-2 shrink-0">
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
          </div>`;

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
          </div>`;

content = content.replace(brokenBlock, fixedBlock);
fs.writeFileSync(path, content);
console.log("Fixed mismatched div tags in SavedDcs.tsx.");
