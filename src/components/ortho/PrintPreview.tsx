import { forwardRef, useMemo } from 'react';
import { ActiveProcedure } from '@/types/procedure';

interface PrintPreviewProps {
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

interface PrintItem {
  name: string;
  description: string;
  qty: number;
  procedure: string;
  location?: { room: string; rack: string; box: string } | null;
  isSelectable: boolean;
}

export const PrintPreview = forwardRef<HTMLDivElement, PrintPreviewProps>(
  ({ activeProcedures, hospitalName, dcNo, deliveredBy, receivedBy, manualItems = [], manualInstruments = [], manualBoxNumbers = [], manualMaterialType = 'SS' }, ref) => {
    const printItems = useMemo(() => {
      const items: PrintItem[] = [];

      activeProcedures.forEach((procedure) => {
        const procedureMaterial = procedure.materialType || 'SS';
        // Fixed items first
        procedure.fixedItems.forEach((fixedItem) => {
          const isSelected = procedure.selectedFixedItems.get(fixedItem.name) ?? true;
          if (isSelected) {
            const editedQty = procedure.fixedQtyEdits.get(fixedItem.name) ?? fixedItem.qty;
            const displayName =
              procedureMaterial !== 'None' ? `${procedureMaterial} ${fixedItem.name}` : fixedItem.name;
            items.push({
              name: displayName,
              description: '',
              qty: parseInt(editedQty) || 1,
              procedure: procedure.name,
              location: procedure.fixedItemLocationMapping?.[fixedItem.name] || null,
              isSelectable: false,
            });
          }
        });

        // Selected items (selectable items) - combine all sizes into one item
        procedure.selectedItems.forEach((item, itemName) => {
          const displayName =
            procedureMaterial !== 'None' ? `${procedureMaterial} ${itemName}` : itemName;

          // Build size details string
          const sizeDetails = item.sizeQty
            .filter(sq => sq.size)
            .map(sq => `${sq.size} (Qty: ${sq.qty})`)
            .join(', ');

          const totalQty = item.sizeQty.length > 0
            ? item.sizeQty.reduce((sum, sq) => sum + (parseInt(sq.qty) || 1), 0)
            : 1;

          items.push({
            name: displayName,
            description: sizeDetails,
            qty: totalQty,
            procedure: procedure.name,
            location: procedure.itemLocationMapping?.[itemName] || null,
            isSelectable: true,
          });
        });
      });

      // Manual DC items
      manualItems.forEach((mi) => {
        const displayName = manualMaterialType !== 'None' ? `${manualMaterialType} ${mi.name}` : mi.name;
        const desc = mi.size ? `${mi.size} (Qty: ${mi.qty})` : '';
        items.push({
          name: displayName,
          description: desc,
          qty: mi.qty,
          procedure: 'Manual',
          location: null,
          isSelectable: true,
        });
      });

      return items;
    }, [activeProcedures, manualItems, manualMaterialType]);

    const allInstruments = useMemo(() => {
      const instruments = new Set<string>();
      activeProcedures.forEach((p) => p.instruments.forEach((i) => instruments.add(i)));
      manualInstruments.forEach((i) => instruments.add(i));
      return Array.from(instruments);
    }, [activeProcedures, manualInstruments]);

    const allBoxNumbers = useMemo(() => {
      const boxNumbers: string[] = [];
      activeProcedures.forEach((p) => {
        if (p.boxNumbers && p.boxNumbers.length > 0) {
          boxNumbers.push(...p.boxNumbers);
        }
      });
      if (manualBoxNumbers.length > 0) boxNumbers.push(...manualBoxNumbers);
      return boxNumbers;
    }, [activeProcedures, manualBoxNumbers]);

    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return (
      <div
        ref={ref}
        className="bg-white text-black w-full max-w-[210mm]"
        style={{
          fontFamily: 'Arial, sans-serif',
          pageBreakInside: 'avoid',
          pageBreakAfter: 'avoid',
          pageBreakBefore: 'avoid',
          margin: '0 auto',
          padding: '0.5cm 1cm 0.5cm 1cm'
        }}
      >
        {/* Header */}
        <div className="text-center mb-1.5 border-b-2 border-black pb-1" style={{ pageBreakInside: 'avoid', marginTop: 0, paddingTop: 0 }}>
          <h1 className="text-lg font-bold mb-0.5">SRR ORTHO IMPLANTS</h1>
          <p className="text-[10px]">Orthopedic Implant Delivery Challan</p>
        </div>

        {/* Info Section */}
        <div className="grid grid-cols-2 gap-2 mb-2 text-[10px]" style={{ pageBreakInside: 'avoid' }}>
          <div>
            <p>
              <strong>Hospital:</strong> {hospitalName || '___________________'}
            </p>
            <p className="mt-1">
              <strong>DC No:</strong> {dcNo || '___________________'}
            </p>
          </div>
          <div className="text-right">
            <p>
              <strong>Delivered By:</strong> {deliveredBy || '___________________'}
            </p>
            <p className="mt-1">
              <strong>Received By:</strong> {receivedBy || '___________________'}
            </p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse text-[10px] mb-2" style={{ pageBreakInside: 'avoid' }}>
          <thead style={{ display: 'table-header-group' }}>
            <tr className="bg-gray-100">
              <th className="border border-black p-1 text-left w-8" style={{ pageBreakInside: 'avoid' }}>S.No</th>
              <th className="border border-black p-1 text-left" style={{ pageBreakInside: 'avoid' }}>Item Description</th>
              <th className="border border-black p-1 text-center w-10" style={{ pageBreakInside: 'avoid' }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {printItems.map((item, index) => (
              <tr key={index} style={{ pageBreakInside: 'avoid' }}>
                <td className="border border-black p-1 text-center">{index + 1}</td>
                <td className="border border-black p-1">
                  <div>
                    <div>{item.name}</div>
                    {item.isSelectable && item.description && (
                      <div className="text-[9px] text-gray-600 mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="border border-black p-1 text-center font-semibold">
                  {item.qty}
                </td>
              </tr>
            ))}
            {printItems.length === 0 && (
              <tr>
                <td colSpan={4} className="border border-black p-2 text-center text-gray-500">
                  No items selected
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Instruments */}
        {allInstruments.length > 0 && (
          <div className="mb-1.5" style={{ pageBreakInside: 'avoid' }}>
            <h3 className="font-bold mb-0.5 text-[10px]">Instruments Required:</h3>
            <p className="text-[10px]">{allInstruments.join(', ')}</p>
          </div>
        )}

        {/* Box Numbers */}
        {allBoxNumbers.length > 0 && (
          <div className="mb-1.5" style={{ pageBreakInside: 'avoid' }}>
            <h3 className="font-bold mb-0.5 text-[10px]">Box Numbers:</h3>
            <p className="text-[10px]">{allBoxNumbers.join(', ')}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-3 mt-2 pt-1" style={{ pageBreakInside: 'avoid', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div className="text-center">
            <div className="border-t border-black pt-1 mt-4">
              <p className="text-[10px] font-semibold">{receivedBy || "Receiver's Signature"}</p>
              <p className="text-[9px] text-gray-600">Name & Date</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-1 mt-4">
              <p className="text-[10px] font-semibold">{deliveredBy || "Authorized Signature"}</p>
              <p className="text-[9px] text-gray-600">SRR Ortho Implants</p>
            </div>
          </div>
        </div>

        {/* Footer - System Generated Notice */}
        <div className="mt-1 pt-0.5 text-center text-[9px] text-gray-500" style={{ pageBreakInside: 'avoid' }}>
          <p>This is a system-generated delivery challan.</p>
        </div>
      </div>
    );
  }
);

PrintPreview.displayName = 'PrintPreview';
