import { forwardRef, Fragment, useMemo } from 'react';
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

interface ProcedureGroup {
  procedureName: string;
  items: Array<{
    name: string;
    description: string;
    qty: number;
  }>;
}

export const PrintPreview = forwardRef<HTMLDivElement, PrintPreviewProps>(
  ({ activeProcedures, hospitalName, dcNo, deliveredBy, receivedBy, manualItems = [], manualInstruments = [], manualBoxNumbers = [], manualMaterialType = 'SS' }, ref) => {
    const procedureGroups = useMemo(() => {
      const groups: ProcedureGroup[] = [];

      activeProcedures.forEach((procedure) => {
        const procedureMaterial = procedure.materialType || 'SS';
        const groupItems: Array<{ name: string; description: string; qty: number }> = [];

        // Fixed items first
        procedure.fixedItems.forEach((fixedItem) => {
          const isSelected = procedure.selectedFixedItems.get(fixedItem.name) ?? true;
          if (isSelected) {
            const editedQty = procedure.fixedQtyEdits.get(fixedItem.name) ?? fixedItem.qty;
            const displayName =
              procedureMaterial !== 'None' ? `${procedureMaterial} ${fixedItem.name}` : fixedItem.name;
            groupItems.push({
              name: displayName,
              description: '',
              qty: parseInt(editedQty) || 1,
            });
          }
        });

        // Selectable items
        procedure.selectedItems.forEach((item, itemName) => {
          const displayName =
            procedureMaterial !== 'None' ? `${procedureMaterial} ${itemName}` : itemName;

          const sizeDetails = item.sizeQty
            .filter(sq => sq.size)
            .map(sq => `${sq.size} (Qty: ${sq.qty})`)
            .join(', ');

          const totalQty = item.sizeQty.length > 0
            ? item.sizeQty.reduce((sum, sq) => sum + (parseInt(sq.qty) || 1), 0)
            : 1;

          groupItems.push({
            name: displayName,
            description: sizeDetails,
            qty: totalQty,
          });
        });

        if (groupItems.length > 0) {
          groups.push({
            procedureName: procedure.name,
            items: groupItems,
          });
        }
      });

      // Manual DC items if any
      if (manualItems.length > 0) {
        const manualGroupItems = manualItems.map((mi) => {
          const displayName = manualMaterialType !== 'None' ? `${manualMaterialType} ${mi.name}` : mi.name;
          const desc = mi.size ? `${mi.size} (Qty: ${mi.qty})` : '';
          return {
            name: displayName,
            description: desc,
            qty: mi.qty,
          };
        });
        groups.push({
          procedureName: 'Manual Items',
          items: manualGroupItems,
        });
      }

      return groups;
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
        <div className="text-center mb-2 border-b-2 border-black pb-1.5" style={{ pageBreakInside: 'avoid', marginTop: 0, paddingTop: 0 }}>
          <h1 className="text-xl font-bold mb-0.5 tracking-tight">SRI RAJA RAJESHWARI ORTHO PLUS</h1>
          <p className="text-[11px] font-semibold">Orthopedic Implant Delivery Challan</p>
          <p className="text-[9.5px] text-gray-700">Hyderabad, India • Mobile: +91 9396857455, +91 8686559393 • srrorthoplus.com</p>
        </div>

        {/* Info Section */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]" style={{ pageBreakInside: 'avoid' }}>
          <div>
            <p>
              <strong>Hospital:</strong> {hospitalName || '___________________'}
            </p>
            <p className="mt-1">
              <strong>DC No:</strong> {dcNo || '___________________'}
            </p>
            <p className="mt-1">
              <strong>Date:</strong> {today}
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

        {/* Items Table - Clean, procedure header bold, no procedure column */}
        <table className="w-full border-collapse text-[10.5px] mb-3" style={{ pageBreakInside: 'avoid' }}>
          <thead style={{ display: 'table-header-group' }}>
            <tr className="bg-gray-100 font-bold">
              <th className="border border-black p-1.5 text-center w-8" style={{ pageBreakInside: 'avoid' }}>S.No</th>
              <th className="border border-black p-1.5 text-left" style={{ pageBreakInside: 'avoid' }}>Item Description</th>
              <th className="border border-black p-1.5 text-center w-12" style={{ pageBreakInside: 'avoid' }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {procedureGroups.map((group) => (
              <Fragment key={group.procedureName}>
                {/* Procedure Name Header Row - Bold in first cell */}
                <tr className="bg-gray-100" style={{ pageBreakInside: 'avoid' }}>
                  <td colSpan={3} className="border border-black p-1.5 text-left font-bold text-[11px]">
                    {group.procedureName}
                  </td>
                </tr>

                {/* Procedure Items */}
                {group.items.map((item, itemIdx) => (
                  <tr key={itemIdx} style={{ pageBreakInside: 'avoid' }}>
                    <td className="border border-black p-1.5 text-center">{itemIdx + 1}</td>
                    <td className="border border-black p-1.5">
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        {item.description && (
                          <div className="text-[9.5px] text-gray-600 mt-0.5">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="border border-black p-1.5 text-center font-bold">
                      {item.qty}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}

            {procedureGroups.length === 0 && (
              <tr>
                <td colSpan={3} className="border border-black p-2 text-center text-gray-500">
                  No items selected
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Instruments Details */}
        {allInstruments.length > 0 && (
          <div className="mb-2 border border-black p-2" style={{ pageBreakInside: 'avoid' }}>
            <h3 className="font-bold text-[11px] mb-0.5">Instruments Details:</h3>
            <p className="text-[10.5px]">{allInstruments.join(', ')}</p>
          </div>
        )}

        {/* Box Numbers */}
        {allBoxNumbers.length > 0 && (
          <div className="mb-2 border border-black p-2" style={{ pageBreakInside: 'avoid' }}>
            <h3 className="font-bold text-[11px] mb-0.5">Box Numbers:</h3>
            <p className="text-[10.5px]">{allBoxNumbers.join(', ')}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-3 mt-12 pt-6" style={{ pageBreakInside: 'avoid', display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '50px' }}>
          <div className="text-center">
            <div className="border-t border-black pt-1 mt-6">
              <p className="text-[10.5px] font-bold">{receivedBy || "Receiver's Signature"}</p>
              <p className="text-[9px] text-gray-600">Name & Date</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-1 mt-6">
              <p className="text-[10.5px] font-bold">{deliveredBy || "Authorized Signature"}</p>
              <p className="text-[9px] text-gray-600">For Sri Raja Rajeshwari Ortho Plus</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 pt-1 text-center text-[9px] text-gray-500" style={{ pageBreakInside: 'avoid' }}>
          <p>This is a system-generated delivery challan.</p>
        </div>
      </div>
    );
  }
);

PrintPreview.displayName = 'PrintPreview';
