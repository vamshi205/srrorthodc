import React from "react";
import { CashInvoiceData } from "@/services/cashInvoiceFirebaseService";
import { numberToIndianWords } from "@/lib/numberToWords";
import { printCashMemo } from "@/lib/cashInvoicePrint";
import { Button } from "@/components/ui/button";
import { AlertCircle, Printer, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface CashInvoicePreviewProps {
  invoice: CashInvoiceData;
  onPrint?: () => void;
  showPrintButton?: boolean;
}

export const CashInvoicePreview: React.FC<CashInvoicePreviewProps> = ({
  invoice,
  onPrint,
  showPrintButton = true,
}) => {
  const grandTotal = Number(invoice.grandTotal) || 0;
  const discount = Number(invoice.discount) || 0;
  const subtotal = Number(invoice.subtotal) || grandTotal + discount;
  const rawItems = Array.isArray(invoice.items) && invoice.items.length > 0
    ? invoice.items
    : Array.isArray((invoice as any).invoiceItems)
      ? (invoice as any).invoiceItems
      : [];
  const items = rawItems;
  const validItems = items.filter((i) => (i.description || "").trim().length > 0);
  const words = numberToIndianWords(grandTotal);

  const formattedDate = invoice.invDate
    ? new Date(invoice.invDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

  const upiId = invoice.companyUpi || "9396857455@ybl";
  const compName = invoice.companyName || "SRR ORTHO PLUS";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(compName)}&am=${grandTotal.toFixed(2)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=0&data=${encodeURIComponent(upiUrl)}`;

  const handlePrint = () => {
    if (validItems.length === 0) {
      toast.error("At least one item must be added to save or print the cash invoice.");
      return;
    }
    if (onPrint) {
      onPrint();
    } else {
      printCashMemo(invoice);
    }
  };

  return (
    <div className="w-full flex flex-col items-center cash-invoice-scope">
      {/* Action Bar (hidden during print) */}
      {showPrintButton && (
        <div className="w-full max-w-3xl flex justify-between items-center mb-4 px-2 no-print">
          <div className="text-xs text-muted-foreground font-medium">
            Standard A4 Cash Memo Preview
          </div>
          <Button
            onClick={handlePrint}
            className="bg-teal-700 hover:bg-teal-800 text-white font-semibold gap-1.5 shadow-sm rounded-none"
            size="sm"
          >
            <Printer className="w-4 h-4" /> Print Cash Memo
          </Button>
        </div>
      )}

      {/* No Items Warning Notice (hidden in print) */}
      {validItems.length === 0 && (
        <div className="w-full max-w-3xl mb-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-none flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 no-print">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Item Required:</strong> At least one line item must be added to save or print this cash invoice.
          </span>
        </div>
      )}

      {/* Internal Hiked Bill Notice (hidden in print) */}
      {invoice.isHikedBill && (
        <div className="w-full max-w-3xl mb-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-none flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 no-print">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Hospital Hiked Bill:</span> Billed to hospital at{" "}
              <span className="font-bold">₹{grandTotal.toLocaleString("en-IN")}</span>, but our Actual Cash to collect is{" "}
              <span className="font-bold text-teal-800 dark:text-teal-300">
                ₹{(Number(invoice.actualReceivable) || 0).toLocaleString("en-IN")}
              </span>
              .
            </div>
          </div>
          {Number(invoice.hospitalMargin) > 0 && (
            <span className="font-mono px-2 py-0.5 rounded-none bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-bold shrink-0">
              Cut: ₹{(Number(invoice.hospitalMargin) || 0).toLocaleString("en-IN")}
            </span>
          )}
        </div>
      )}

      {/* Printable Sheet (Standard A4 letterhead format) */}
      <div
        id="printable-cash-invoice"
        className="w-full max-w-3xl bg-white text-slate-900 rounded-none shadow-lg border border-slate-300 p-6 sm:p-8 select-text"
      >
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b-2 border-teal-700 mb-3">
          <div>
            <h1 className="font-outfit text-xl sm:text-2xl font-black text-teal-800 tracking-tight leading-none mb-1">
              SRR ORTHO PLUS
            </h1>
            <p className="text-[11px] text-slate-600 font-medium leading-tight">
              217, SIDDARTH NAGAR, HYDERABAD - 500038
            </p>
            <p className="text-[11px] text-slate-600 font-medium leading-tight">
              Phone: 9396857455 | Email: srrorthoplus999@gmail.com
            </p>
            <p className="text-[11px] text-slate-600 font-medium leading-tight">
              Website: srrorthoplus.com
            </p>
          </div>
          <div className="text-right">
            <div className="font-outfit text-lg sm:text-xl font-black text-teal-800 tracking-wider uppercase mb-1">
              CASH MEMO
            </div>
            <table className="border-collapse text-[11px] ml-auto bg-slate-50 border border-slate-300 rounded-none overflow-hidden">
              <tbody>
                <tr>
                  <td className="font-semibold text-slate-600 px-2 py-0.5 text-right border-b border-slate-200">
                    Bill No:
                  </td>
                  <td className="font-bold text-slate-900 px-2 py-0.5 text-left border-b border-slate-200">
                    {invoice.invNumber || "-"}
                  </td>
                </tr>
                {invoice.dcNumber && (
                  <tr>
                    <td className="font-semibold text-slate-600 px-2 py-0.5 text-right border-b border-slate-200">
                      DC No:
                    </td>
                    <td className="font-bold text-slate-900 px-2 py-0.5 text-left border-b border-slate-200">
                      {invoice.dcNumber}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="font-semibold text-slate-600 px-2 py-0.5 text-right">Date:</td>
                  <td className="font-bold text-slate-900 px-2 py-0.5 text-left">
                    {formattedDate}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-none p-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-teal-800 mb-1">
            BILL TO:
          </div>
          <div className="text-sm font-bold text-slate-900">
            {invoice.clientName || "Walk-in Customer"}
          </div>
          {invoice.clientAddress && (
            <div className="text-xs text-slate-600 mt-0.5">
              <span className="font-semibold">Address:</span> {invoice.clientAddress}
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-slate-600 mt-1">
            {invoice.clientMobile && (
              <div>
                <span className="font-semibold">Phone:</span> {invoice.clientMobile}
              </div>
            )}
            {invoice.clientEmail && (
              <div>
                <span className="font-semibold">Email:</span> {invoice.clientEmail}
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse text-xs mb-4 border border-slate-300 rounded-none overflow-hidden">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              <th className="p-2 text-center text-slate-700 font-bold w-[4%]">#</th>
              <th className="p-2 text-left text-slate-700 font-bold w-[45%]">ITEM DESCRIPTION</th>
              <th className="p-2 text-center text-slate-700 font-bold w-[25%]">SIZE</th>
              <th className="p-2 text-center text-slate-700 font-bold w-[6%]">QTY</th>
              <th className="p-2 text-right text-slate-700 font-bold w-[10%]">RATE (₹)</th>
              <th className="p-2 text-right text-slate-700 font-bold w-[10%]">AMOUNT (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-400">
                  No items listed
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const qty = Number(item.qty) || 0;
                const rate = Number(item.rate) || 0;
                const amt = item.amount != null ? Number(item.amount) : qty * rate;
                return (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 text-center text-slate-500 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="p-2 font-semibold text-slate-900">
                      <div>
                        {item.description}
                        {item.sku && (
                          <span className="text-[10px] text-slate-500 font-normal ml-1">
                            [{item.sku}]
                          </span>
                        )}
                      </div>
                      {(item.note || (item as any).subDescription) && (
                        <div className="text-[11px] text-slate-500 font-normal italic mt-0.5 whitespace-pre-wrap">
                          {item.note || (item as any).subDescription}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-center text-slate-600">{item.size || "-"}</td>
                    <td className="p-2 text-center font-bold text-slate-900">{qty}</td>
                    <td className="p-2 text-right text-slate-700 font-mono">
                      ₹{rate.toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-bold text-slate-900 font-mono">
                      ₹{amt.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Summary: Left QR + Right Totals */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
          {/* Left: Bank & UPI QR */}
          <div className="w-full sm:w-[56%]">
            <div className="bg-slate-50 border border-slate-300 p-2.5 rounded-none mb-2 text-xs">
              <div className="text-[10px] font-bold text-teal-800 uppercase mb-0.5">
                Bank Account Details:
              </div>
              <div className="text-slate-700 leading-snug font-medium">
                HDFC BANK, A/C: 5010023456789, IFSC: HDFC0001234, Hyderabad Branch
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 border border-slate-300 p-2.5 rounded-none">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-teal-800 uppercase mb-0.5">
                  Scan to Pay (UPI):
                </div>
                <div className="text-xs font-bold text-slate-900 font-mono truncate">{upiId}</div>
                <div className="flex gap-1.5 items-center mt-1">
                  <span className="bg-white px-1.5 py-0.5 rounded-none border border-slate-200 text-[9px] font-bold text-[#5f259f]">
                    PhonePe
                  </span>
                  <span className="bg-white px-1.5 py-0.5 rounded-none border border-slate-200 text-[9px] font-bold text-[#ea4335]">
                    GPay
                  </span>
                  <span className="bg-white px-1.5 py-0.5 rounded-none border border-slate-200 text-[9px] font-bold text-[#00baf2]">
                    Paytm
                  </span>
                  <span className="bg-white px-1.5 py-0.5 rounded-none border border-slate-200 text-[9px] font-bold text-slate-900">
                    UPI
                  </span>
                </div>
              </div>
              <img
                src={qrUrl}
                alt="UPI QR Code"
                className="w-16 h-16 rounded-none border border-slate-300 shrink-0"
              />
            </div>

            <div className="mt-2 text-[11px] text-slate-700 bg-slate-50 p-2 rounded-none border-l-4 border-teal-700">
              Amount in Words: <strong className="text-slate-900">{words}</strong>
            </div>
          </div>

          {/* Right: Totals */}
          <div className="w-full sm:w-[40%]">
            <table className="w-full text-xs border border-slate-200 rounded-none overflow-hidden">
              <tbody>
                <tr>
                  <td className="p-1.5 text-right font-medium text-slate-600">Subtotal:</td>
                  <td className="p-1.5 text-right font-bold text-slate-900 font-mono">
                    ₹{subtotal.toFixed(2)}
                  </td>
                </tr>
                {discount > 0 && (
                  <tr>
                    <td className="p-1.5 text-right font-medium text-slate-600">Flat Discount:</td>
                    <td className="p-1.5 text-right font-bold text-red-600 font-mono">
                      -₹{discount.toFixed(2)}
                    </td>
                  </tr>
                )}
                <tr className="bg-teal-50 border-t-2 border-teal-700">
                  <td className="p-2 text-right font-black text-teal-900 text-sm">Grand Total:</td>
                  <td className="p-2 text-right font-black text-teal-900 text-base font-mono">
                    ₹{grandTotal.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer: Terms & Signature */}
        <div className="border-t border-slate-300 pt-3 flex justify-between items-end text-xs">
          <div className="w-[56%] text-[10px] text-slate-600">
            <div className="font-bold text-teal-800 uppercase mb-1">Terms & Conditions:</div>
            <ol className="list-decimal pl-3.5 space-y-0.5 leading-snug">
              <li>Goods once sold will not be taken back or exchanged.</li>
              <li>Payment should be settled immediately upon surgery / procedure completion.</li>
              <li>All disputes are subject to local Hyderabad jurisdiction only.</li>
            </ol>
          </div>
          <div className="w-[40%] text-right">
            <div className="text-[11px] font-bold text-slate-900 mb-1">
              For <strong>SRR ORTHO PLUS</strong>
            </div>
            <div className="font-['Caveat'] text-2xl font-bold text-blue-700 h-7 flex items-center justify-end">
              A.SATYANARAYANA
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mt-1">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
