import { CashInvoiceData } from "@/services/cashInvoiceFirebaseService";
import { numberToIndianWords } from "@/lib/numberToWords";

export function generateCashMemoPrintHtml(inv: CashInvoiceData): string {
  const grandTotal = Number(inv.grandTotal) || 0;
  const discount = Number(inv.discount) || 0;
  const subtotal = Number(inv.subtotal) || (grandTotal + discount);
  const rawItems = Array.isArray(inv.items) && inv.items.length > 0
    ? inv.items
    : Array.isArray((inv as any).invoiceItems)
      ? (inv as any).invoiceItems
      : [];
  const items = rawItems;
  const words = numberToIndianWords(grandTotal);

  const formattedDate = inv.invDate
    ? new Date(inv.invDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

  const upiId = inv.companyUpi || "9396857455@ybl";
  const compName = inv.companyName || "SRR ORTHO PLUS";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(compName)}&am=${grandTotal.toFixed(2)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=0&data=${encodeURIComponent(upiUrl)}`;

  const itemRowsHtml = items
    .filter((item) => (item.description || "").trim().length > 0)
    .map((item, idx) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      const amt = item.amount != null ? Number(item.amount) : qty * rate;
      const note = (item as any).note || (item as any).subDescription;
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 8px; text-align: center; color: #64748b; font-size: 11px;">${idx + 1}</td>
          <td style="padding: 6px 8px; font-weight: 700; color: #0f172a; font-size: 11px;">
            <div>
              ${item.description}
              ${item.sku ? `<span style="color:#64748b; font-size:10px; font-weight:400;"> [${item.sku}]</span>` : ""}
            </div>
            ${note ? `<div style="font-size: 10px; color: #64748b; font-weight: normal; font-style: italic; margin-top: 2px;">${note}</div>` : ""}
          </td>
          <td style="padding: 6px 8px; text-align: center; color: #475569; font-size: 11px;">${item.size || "-"}</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: 600; color: #0f172a; font-size: 11px;">${qty}</td>
          <td style="padding: 6px 8px; text-align: right; color: #334155; font-size: 11px;">₹${rate.toFixed(2)}</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #0f172a; font-size: 11px;">₹${amt.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cash Memo - ${inv.invNumber || "SRR-2026"}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800;900&family=Caveat:wght@600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #fff;
      font-size: 11px;
    }
    .invoice-wrapper {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      padding: 10px 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2.5px solid #0f766e; margin-bottom: 12px;">
      <div>
        <h1 style="font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 900; color: #0f766e; margin: 0 0 3px 0; letter-spacing: -0.3px;">SRR ORTHO PLUS</h1>
        <p style="font-size: 10.5px; color: #475569; margin: 1px 0; font-weight: 500;">217, SIDDARTH NAGAR, HYDERABAD - 500038</p>
        <p style="font-size: 10.5px; color: #475569; margin: 1px 0; font-weight: 500;">Phone: 9396857455 | Email: srrorthoplus999@gmail.com</p>
        <p style="font-size: 10.5px; color: #475569; margin: 1px 0; font-weight: 500;">Website: srrorthoplus.com</p>
      </div>
      <div style="text-align: right;">
        <div style="font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 900; color: #0f766e; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">CASH MEMO</div>
        <table style="border-collapse: collapse; font-size: 11px; margin-left: auto; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          <tr>
            <td style="font-weight: 600; color: #475569; padding: 3px 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">Bill No:</td>
            <td style="font-weight: 800; color: #0f172a; padding: 3px 8px; text-align: left; border-bottom: 1px solid #e2e8f0;">${inv.invNumber || "-"}</td>
          </tr>
          ${inv.dcNumber ? `
          <tr>
            <td style="font-weight: 600; color: #475569; padding: 3px 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">DC No:</td>
            <td style="font-weight: 700; color: #0f172a; padding: 3px 8px; text-align: left; border-bottom: 1px solid #e2e8f0;">${inv.dcNumber}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="font-weight: 600; color: #475569; padding: 3px 8px; text-align: right;">Date:</td>
            <td style="font-weight: 700; color: #0f172a; padding: 3px 8px; text-align: left;">${formattedDate}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Bill To Section -->
    <div style="margin-bottom: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px;">
      <div style="font-size: 10px; text-transform: uppercase; color: #0f766e; font-weight: 800; letter-spacing: 0.8px; margin-bottom: 4px;">BILL TO:</div>
      <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">
        ${inv.clientName || "Walk-in Customer"}
      </div>
      ${inv.clientAddress ? `<div style="font-size: 11px; color: #475569; margin: 2px 0;"><strong>Address:</strong> ${inv.clientAddress}</div>` : ""}
      <div style="display: flex; gap: 16px; margin-top: 3px;">
        ${inv.clientMobile ? `<div style="font-size: 11px; color: #475569;"><strong>Phone:</strong> ${inv.clientMobile}</div>` : ""}
        ${inv.clientEmail ? `<div style="font-size: 11px; color: #475569;"><strong>Email:</strong> ${inv.clientEmail}</div>` : ""}
      </div>
    </div>

    <!-- Items Table -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
          <th style="padding: 8px; text-align: center; color: #334155; font-weight: 800; width: 4%;">#</th>
          <th style="padding: 8px; text-align: left; color: #334155; font-weight: 800; width: 45%;">ITEM DESCRIPTION</th>
          <th style="padding: 8px; text-align: center; color: #334155; font-weight: 800; width: 25%;">SIZE</th>
          <th style="padding: 8px; text-align: center; color: #334155; font-weight: 800; width: 6%;">QTY</th>
          <th style="padding: 8px; text-align: right; color: #334155; font-weight: 800; width: 10%;">RATE (₹)</th>
          <th style="padding: 8px; text-align: right; color: #334155; font-weight: 800; width: 10%;">AMOUNT (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml || '<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8;">No items listed</td></tr>'}
      </tbody>
    </table>

    <!-- Summary: Bank & QR (Left) + Totals (Right) -->
    <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 12px; align-items: flex-start;">
      <!-- Left: Bank Details & UPI QR -->
      <div style="width: 56%;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 7px 10px; border-radius: 6px; margin-bottom: 8px;">
          <div style="font-size: 10.5px; font-weight: 800; color: #0f766e; text-transform: uppercase; margin-bottom: 2px;">Bank Account Details:</div>
          <div style="font-size: 10.5px; color: #334155; line-height: 1.4; font-weight: 500;">
            HDFC BANK, A/C: 5010023456789, IFSC: HDFC0001234, Hyderabad Branch
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 8px 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
          <div style="flex-grow: 1;">
            <div style="font-size: 10.5px; font-weight: 800; color: #0f766e; text-transform: uppercase; margin-bottom: 2px;">Scan to Pay (UPI):</div>
            <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${upiId}</div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <span style="background: #fff; padding: 2px 5px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #5f259f;">PhonePe</span>
              <span style="background: #fff; padding: 2px 5px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #ea4335;">GPay</span>
              <span style="background: #fff; padding: 2px 5px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #00baf2;">Paytm</span>
              <span style="background: #fff; padding: 2px 5px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; color: #0f172a;">UPI</span>
            </div>
          </div>
          <img src="${qrUrl}" style="width: 70px; height: 70px; border-radius: 4px; border: 1px solid #cbd5e1; flex-shrink: 0;" alt="UPI QR" />
        </div>

        <div style="margin-top: 8px; font-size: 10.5px; color: #334155; background: #f8fafc; padding: 6px 10px; border-radius: 6px; border-left: 3.5px solid #0f766e;">
          Amount in Words: <strong style="color: #0f172a;">${words}</strong>
        </div>
      </div>

      <!-- Right: Totals Breakdown -->
      <div style="width: 40%;">
        <table style="width: 100%; font-size: 11px; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <tr>
            <td style="padding: 5px 8px; color: #475569; font-weight: 600; text-align: right;">Subtotal:</td>
            <td style="padding: 5px 8px; text-align: right; font-weight: 700; color: #0f172a;">₹${subtotal.toFixed(2)}</td>
          </tr>
          ${discount > 0 ? `
          <tr>
            <td style="padding: 5px 8px; color: #475569; font-weight: 600; text-align: right;">Flat Discount:</td>
            <td style="padding: 5px 8px; text-align: right; color: #ef4444; font-weight: 700;">-₹${discount.toFixed(2)}</td>
          </tr>
          ` : ""}
          <tr style="background: rgba(15, 118, 110, 0.08); border-top: 1.5px solid #0f766e;">
            <td style="padding: 8px 8px; font-weight: 800; font-size: 13px; text-align: right; color: #0f766e;">Grand Total:</td>
            <td style="padding: 8px 8px; text-align: right; font-weight: 900; font-size: 14px; color: #0f766e;">₹${grandTotal.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer: Terms & Signature -->
    <div style="border-top: 1.5px solid #cbd5e1; padding-top: 12px; margin-top: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div style="font-size: 10px; color: #475569; width: 55%;">
        <div style="font-weight: 800; margin-bottom: 3px; text-transform: uppercase; color: #0f766e; letter-spacing: 0.5px;">TERMS & CONDITIONS:</div>
        <ol style="margin: 0; padding-left: 14px; line-height: 1.4;">
          <li>Goods once sold will not be taken back or exchanged.</li>
          <li>Payment should be settled immediately upon surgery / procedure completion.</li>
          <li>All disputes are subject to local Hyderabad jurisdiction only.</li>
        </ol>
      </div>
      <div style="text-align: right; width: 40%;">
        <div style="font-size: 10.5px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">For <strong>SRR ORTHO PLUS</strong></div>
        <div style="font-family: 'Caveat', cursive; font-size: 22px; font-weight: 700; color: #1d4ed8; height: 26px; display: flex; align-items: center; justify-content: flex-end;">
          A.SATYANARAYANA
        </div>
        <div style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Authorized Signatory</div>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>`;
}

export function printCashMemo(inv: CashInvoiceData): boolean {
  const items = Array.isArray(inv.items) ? inv.items : [];
  const validItems = items.filter((item) => (item.description || "").trim().length > 0);
  if (validItems.length === 0) {
    alert("At least one item must be added to save or print the cash invoice.");
    return false;
  }
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to print the Cash Memo.");
    return false;
  }
  const html = generateCashMemoPrintHtml(inv);
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
