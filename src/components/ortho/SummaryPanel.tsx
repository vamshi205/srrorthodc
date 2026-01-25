import { useMemo, forwardRef } from 'react';
import { FileText, Package, Wrench, Building2, FileCheck, User } from 'lucide-react';
import { ActiveProcedure } from '@/types/procedure';

interface SummaryPanelProps {
  activeProcedures: ActiveProcedure[];
  hospitalName: string;
  dcNo: string;
  deliveredBy?: string;
  receivedBy?: string;
  manualItems?: Array<{ name: string; size: string; qty: number }>;
  manualInstruments?: string[];
  manualBoxNumbers?: string[];
  manualMaterialType?: string;
}

interface SummaryItem {
  name: string;
  sizes: { size: string; qty: number }[];
  procedure: string;
  isSelectable: boolean;
}

export const SummaryPanel = forwardRef<HTMLDivElement, SummaryPanelProps>(
  ({ activeProcedures, hospitalName, dcNo, deliveredBy, receivedBy, manualItems = [], manualInstruments = [], manualBoxNumbers = [], manualMaterialType = 'SS' }, ref) => {
    const summaryData = useMemo(() => {
      const items: SummaryItem[] = [];
      const instruments = new Set<string>();
      const allBoxNumbers: string[] = [];

      activeProcedures.forEach((procedure) => {
        const procedureMaterial = procedure.materialType || 'SS';
        // Process selected items (selectable items)
        procedure.selectedItems.forEach((item, itemName) => {
          const displayName =
            procedureMaterial !== 'None' ? `${procedureMaterial} ${itemName}` : itemName;
          items.push({
            name: displayName,
            sizes: item.sizeQty.map((sq) => ({
              size: sq.size,
              qty: parseInt(sq.qty) || 1,
            })),
            procedure: procedure.name,
            isSelectable: true,
          });
        });

        // Process fixed items
        procedure.fixedItems.forEach((fixedItem) => {
          const isSelected = procedure.selectedFixedItems.get(fixedItem.name) ?? true;
          if (isSelected) {
            const editedQty = procedure.fixedQtyEdits.get(fixedItem.name) ?? fixedItem.qty;
            const displayName =
              procedureMaterial !== 'None' ? `${procedureMaterial} ${fixedItem.name}` : fixedItem.name;
            items.push({
              name: displayName,
              sizes: [{ size: '', qty: parseInt(editedQty) || 1 }],
              procedure: procedure.name,
              isSelectable: false,
            });
          }
        });

        // Collect instruments
        procedure.instruments.forEach((inst) => instruments.add(inst));

        // Collect box numbers
        if (procedure.boxNumbers && procedure.boxNumbers.length > 0) {
          allBoxNumbers.push(...procedure.boxNumbers);
        }
      });

      // Manual DC
      manualItems.forEach((mi) => {
        const displayName = manualMaterialType !== 'None' ? `${manualMaterialType} ${mi.name}` : mi.name;
        items.push({
          name: displayName,
          sizes: [{ size: mi.size || '', qty: mi.qty }],
          procedure: 'Manual',
          isSelectable: true,
        });
      });
      manualInstruments.forEach((inst) => instruments.add(inst));
      if (manualBoxNumbers.length > 0) {
        allBoxNumbers.push(...manualBoxNumbers);
      }

      return { items, instruments: Array.from(instruments), boxNumbers: allBoxNumbers };
    }, [activeProcedures, manualBoxNumbers, manualInstruments, manualItems, manualMaterialType]);

    const totalItems = summaryData.items.reduce(
      (acc, item) => acc + item.sizes.reduce((a, s) => a + s.qty, 0),
      0
    );

    // Calculate total instrument quantity by parsing numbers after "-"
    const totalInstrumentQty = summaryData.instruments.reduce((total, instrument) => {
      const match = instrument.match(/-\s*(\d+)$/);
      if (match) {
        return total + parseInt(match[1], 10);
      }
      // If no "-" found, count as 1
      return total + 1;
    }, 0);

    const hasAnything =
      activeProcedures.length > 0 ||
      manualItems.length > 0 ||
      manualInstruments.length > 0 ||
      manualBoxNumbers.length > 0;

    if (!hasAnything) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
          <FileText className="w-16 h-16 mb-4 opacity-40" />
          <p className="text-lg font-medium">Nothing selected</p>
          <p className="text-sm mt-1">Select procedures or use Manual DC to see the summary</p>
        </div>
      );
    }

    return (
      <div ref={ref} className="space-y-6">
        {/* Header Info */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/50 border-[3px] border-border/80">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Hospital</p>
              <p className="font-medium truncate">{hospitalName || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FileCheck className="w-5 h-5 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">DC No.</p>
              <p className="font-medium truncate">{dcNo || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Delivered By</p>
              <p className="font-medium truncate">{deliveredBy || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Received By</p>
              <p className="font-medium truncate">{receivedBy || '-'}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-primary/10 border-[3px] border-primary/40 text-center">
            <p className="text-2xl font-bold text-primary">{activeProcedures.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Procedures</p>
          </div>
          <div className="p-4 rounded-xl bg-accent/10 border-[3px] border-accent/40 text-center">
            <p className="text-2xl font-bold text-accent">{totalItems}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Items</p>
          </div>
          <div className="p-4 rounded-xl bg-success/10 border-[3px] border-success/40 text-center">
            <p className="text-2xl font-bold text-success">{totalInstrumentQty}</p>
            <p className="text-xs text-muted-foreground mt-1">Instruments</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="rounded-xl border-[3px] border-border/80 overflow-hidden">
          <div className="p-3 bg-muted/50 border-b-[3px] border-border/80 flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="font-medium">Items Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-[2px] border-border/80 bg-muted/30">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Item Name</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Procedure</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Qty</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.items.map((item, index) => {
                  const totalQty = item.sizes.reduce((a, s) => a + s.qty, 0);
                  const hasSizes = item.isSelectable && item.sizes.length > 0 && item.sizes.some(s => s.size);

                  // Build size details text for selectable items
                  const sizeDetails = hasSizes
                    ? item.sizes
                      .filter(s => s.size)
                      .map(s => `${s.size} (Qty: ${s.qty})`)
                      .join(', ')
                    : '';

                  return (
                    <tr
                      key={`${item.name}-${index}`}
                      className="border-b-[1px] border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-3 text-sm font-medium">
                        <div>
                          <div>{item.name}</div>
                          {hasSizes && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {sizeDetails}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{item.procedure}</td>
                      <td className="p-3 text-sm font-semibold text-center">{totalQty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Instruments */}
        {summaryData.instruments.length > 0 && (
          <div className="rounded-xl border-[3px] border-border/80 overflow-hidden">
            <div className="p-3 bg-muted/50 border-b-[3px] border-border/80 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              <h3 className="font-medium">Instruments</h3>
            </div>
            <div className="p-3 flex flex-wrap gap-2">
              {summaryData.instruments.map((instrument) => (
                <span
                  key={instrument}
                  className="px-3 py-1.5 rounded-full text-sm bg-secondary text-secondary-foreground"
                >
                  {instrument}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Box Numbers */}
        {summaryData.boxNumbers && summaryData.boxNumbers.length > 0 && (
          <div className="rounded-xl border-[3px] border-border/80 overflow-hidden">
            <div className="p-3 bg-muted/50 border-b-[3px] border-border/80 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <h3 className="font-medium">Box Numbers</h3>
            </div>
            <div className="p-3">
              <ul className="list-disc list-inside space-y-1">
                {summaryData.boxNumbers.map((boxNumber, index) => (
                  <li key={index} className="text-sm">
                    {boxNumber}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }
);

SummaryPanel.displayName = 'SummaryPanel';
