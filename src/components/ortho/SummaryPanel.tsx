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
    const procedureSections = useMemo(() => {
      const sections: Array<{
        name: string;
        materialType: string;
        items: SummaryItem[];
        instruments: string[];
        boxNumbers: string[];
      }> = [];

      activeProcedures.forEach((procedure) => {
        const procedureMaterial = procedure.materialType || 'SS';
        const items: SummaryItem[] = [];
        const instruments: string[] = [...procedure.instruments];

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

        sections.push({
          name: procedure.name,
          materialType: procedureMaterial,
          items,
          instruments,
          boxNumbers: procedure.boxNumbers || [],
        });
      });

      // Manual section if manual items exist
      if (manualItems.length > 0 || manualInstruments.length > 0 || manualBoxNumbers.length > 0) {
        const items: SummaryItem[] = manualItems.map((mi) => ({
          name: manualMaterialType !== 'None' ? `${manualMaterialType} ${mi.name}` : mi.name,
          sizes: [{ size: mi.size || '', qty: mi.qty }],
          procedure: 'Manual DC',
          isSelectable: true,
        }));

        sections.push({
          name: 'Manual DC',
          materialType: manualMaterialType,
          items,
          instruments: manualInstruments,
          boxNumbers: manualBoxNumbers,
        });
      }

      return sections;
    }, [activeProcedures, manualBoxNumbers, manualInstruments, manualItems, manualMaterialType]);

    const totalItems = useMemo(() => {
      return procedureSections.reduce(
        (acc, sec) => acc + sec.items.reduce((a, item) => a + item.sizes.reduce((s, sq) => s + sq.qty, 0), 0),
        0
      );
    }, [procedureSections]);

    const totalInstrumentQty = useMemo(() => {
      return procedureSections.reduce((acc, sec) => {
        return acc + sec.instruments.reduce((sum, inst) => {
          const match = inst.match(/-\s*(\d+)$/);
          return sum + (match ? parseInt(match[1], 10) : 1);
        }, 0);
      }, 0);
    }, [procedureSections]);

    const hasAnything = procedureSections.length > 0;

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
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/50 border-2 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Hospital</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{hospitalName || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FileCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">DC No.</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{dcNo || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Delivered By</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{deliveredBy || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Received By</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{receivedBy || '-'}</p>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 sm:p-4 rounded-xl bg-teal-500/15 border-2 border-teal-500/40 text-center shadow-sm">
            <p className="text-2xl sm:text-3xl font-extrabold text-teal-600 dark:text-teal-400">{procedureSections.length}</p>
            <p className="text-xs font-bold text-teal-700 dark:text-teal-300 mt-1 uppercase tracking-wider">Procedures</p>
          </div>
          <div className="p-3.5 sm:p-4 rounded-xl bg-cyan-500/15 border-2 border-cyan-500/40 text-center shadow-sm">
            <p className="text-2xl sm:text-3xl font-extrabold text-cyan-600 dark:text-cyan-400">{totalItems}</p>
            <p className="text-xs font-bold text-cyan-700 dark:text-cyan-300 mt-1 uppercase tracking-wider">Total Implants</p>
          </div>
          <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/40 text-center shadow-sm">
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{totalInstrumentQty}</p>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-1 uppercase tracking-wider">Instruments</p>
          </div>
        </div>

        {/* Section Per Procedure */}
        <div className="space-y-6">
          {procedureSections.map((section, secIdx) => (
            <div
              key={section.name}
              className="rounded-2xl border-2 border-teal-500/40 dark:border-teal-400/30 bg-card p-4 space-y-4 shadow-md"
            >
              {/* Procedure Title Badge */}
              <div className="flex items-center justify-between border-b-2 border-teal-500/30 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-teal-600 text-white shadow-sm">
                    Procedure #{secIdx + 1}
                  </span>
                  <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100">
                    {section.name}
                  </h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                  {section.materialType}
                </span>
              </div>

              {/* Implants Section */}
              {section.items.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">
                      Implants ({section.items.reduce((sum, item) => sum + item.sizes.reduce((a, s) => a + s.qty, 0), 0)})
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                          <th className="text-left p-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Implant Name</th>
                          <th className="text-center p-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((item, idx) => {
                          const totalQty = item.sizes.reduce((a, s) => a + s.qty, 0);
                          const hasSizes = item.isSelectable && item.sizes.length > 0 && item.sizes.some((s) => s.size);
                          const sizeDetails = hasSizes
                            ? item.sizes
                                .filter((s) => s.size)
                                .map((s) => `${s.size} (Qty: ${s.qty})`)
                                .join(', ')
                            : '';

                          return (
                            <tr
                              key={`${item.name}-${idx}`}
                              className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="p-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                <div>{item.name}</div>
                                {hasSizes && (
                                  <div className="text-xs text-teal-700 dark:text-teal-300 font-medium mt-0.5">
                                    {sizeDetails}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-sm font-bold text-center text-teal-700 dark:text-teal-300">
                                {totalQty}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Instruments Section */}
              {section.instruments.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">
                      Instruments ({section.instruments.length})
                    </h4>
                  </div>
                  <div className="p-3 flex flex-wrap gap-2">
                    {section.instruments.map((inst) => (
                      <span
                        key={inst}
                        className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30"
                      >
                        {inst}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Box Numbers Section */}
              {section.boxNumbers.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">
                      Box Numbers ({section.boxNumbers.length})
                    </h4>
                  </div>
                  <div className="p-3 flex flex-wrap gap-2">
                    {section.boxNumbers.map((boxNum, bIdx) => (
                      <span
                        key={bIdx}
                        className="px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 border border-cyan-500/30"
                      >
                        Box #{boxNum}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

SummaryPanel.displayName = 'SummaryPanel';
