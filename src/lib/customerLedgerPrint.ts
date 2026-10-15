import { Customer } from "@/lib/customerStorage";
import { CashInvoiceData } from "@/services/cashInvoiceFirebaseService";

export interface CustomerLedgerSummary {
  totalBilled: number;
  totalReceived: number;
  balanceDue: number;
  invoiceCount: number;
}

export function generateCustomerCashLedgerPrintHtml(
  customer: Customer,
  invoices: CashInvoiceData[],
  summary: CustomerLedgerSummary
): string {
  const compName = "SRR ORTHO PLUS";
  const compSub = "Orthopedic Implants, Trauma, Spine & Joint Replacement Solutions";
  const compAddr = "D.No 7-1-619/A/32, Gayatri Nagar, Beside HDFC Bank, Ameerpet / Kalyan Nagar, Hyderabad - 500038";
  const compPhone = "+91 9396857455 / +91 9989857455";
  const compEmail = "srrorthoplus999@gmail.com";
  const upiId = "9396857455@ybl";

  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const currentTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(compName)}&am=${summary.balanceDue > 0 ? summary.balanceDue.toFixed(2) : "0.00"}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=95x95&margin=0&data=${encodeURIComponent(upiUrl)}`;

  const sortedInvoices = [...invoices].sort((a, b) => {
    const dateA = a.invDate ? new Date(a.invDate).getTime() : a.savedAt || 0;
    const dateB = b.invDate ? new Date(b.invDate).getTime() : b.savedAt || 0;
    return dateA - dateB;
  });

  let runningBalance = 0;
  const rowsHtml = sortedInvoices
    .map((inv, idx) => {
      const grandTotal = Number(inv.grandTotal) || 0;
      const received = Number(inv.paymentReceived) || 0;
      const balance = grandTotal - received;
      runningBalance += balance;

      const dateStr = inv.invDate
        ? new Date(inv.invDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "-";

      let statusBadge = `<span style="display:inline-block; padding: 2px 6px; font-size: 9px; font-weight: 700; border-radius: 4px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">PAID</span>`;
      if (balance > 0 && received > 0) {
        statusBadge = `<span style="display:inline-block; padding: 2px 6px; font-size: 9px; font-weight: 700; border-radius: 4px; background: #fffbeb; color: #b45309; border: 1px solid #fde68a;">PARTIAL</span>`;
      } else if (balance > 0) {
        statusBadge = `<span style="display:inline-block; padding: 2px 6px; font-size: 9px; font-weight: 700; border-radius: 4px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;">UNPAID</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10.5px;">
          <td style="padding: 7.5px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 7.5px 8px; color: #1e293b; white-space: nowrap;">${dateStr}</td>
          <td style="padding: 7.5px 8px; font-weight: 700; color: #0f172a; white-space: nowrap;">${inv.invNumber || "-"}</td>
          <td style="padding: 7.5px 8px; color: #0d9488; font-weight: 600; white-space: nowrap;">${inv.dcNumber || "-"}</td>
          <td style="padding: 7.5px 8px; text-align: right; font-weight: 600; color: #0f172a;">₹${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 7.5px 8px; text-align: right; font-weight: 600; color: #047857;">₹${received.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 7.5px 8px; text-align: right; font-weight: 700; color: ${balance > 0 ? "#b91c1c" : "#047857"};">₹${balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 7.5px 8px; text-align: center;">${statusBadge}</td>
        </tr>
      `;
    })
    .join("");
("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cash Invoice Ledger - ${customer.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
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
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 70px;
      font-weight: 900;
      color: rgba(13, 148, 136, 0.04);
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
      text-transform: uppercase;
      font-family: 'Outfit', sans-serif;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #0d9488;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .title-banner {
      background: #f0fdfa;
      border: 1px solid #ccfbf1;
      border-left: 4px solid #0d9488;
      padding: 8px 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 4px;
    }
    .customer-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }
    .summary-grid {
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
    }
    .summary-cell {
      flex: 1;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .summary-cell.due {
      background: #fef2f2;
      border-color: #fecaca;
    }
    .summary-cell.received {
      background: #ecfdf5;
      border-color: #a7f3d0;
    }
    .summary-cell.billed {
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .ledger-table th {
      background: #f1f5f9;
      border-top: 1px solid #cbd5e1;
      border-bottom: 2px solid #94a3b8;
      padding: 8px 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #334155;
    }
    .scope-notice {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      padding: 8px 10px;
      font-size: 10px;
      color: #64748b;
      border-radius: 4px;
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .settlement-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-top: 14px;
      background: #fafafa;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-actions {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 100;
    }
    .print-btn {
      background: #0d9488;
      color: #fff;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: inherit;
    }
    .close-btn {
      background: #64748b;
      color: #fff;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-family: inherit;
    }
    @media print {
      .print-actions { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="watermark">SRR ORTHO PLUS</div>

  <div class="print-actions">
    <button class="print-btn" onclick="window.print()">🖨️ Print Statement</button>
    <button class="close-btn" onclick="window.close()">✕ Close</button>
  </div>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: middle;">
        <div style="font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; color: #0d9488; letter-spacing: -0.5px; line-height: 1.1;">
          ${compName}
        </div>
        <div style="font-size: 10.5px; font-weight: 600; color: #475569; margin-top: 2px;">
          ${compSub}
        </div>
        <div style="font-size: 9.5px; color: #64748b; margin-top: 3px; line-height: 1.3;">
          ${compAddr}<br>
          Phone: <strong>${compPhone}</strong> | Email: <strong>${compEmail}</strong>
        </div>
      </td>
      <td style="vertical-align: middle; text-align: right; width: 220px;">
        <div style="display: inline-block; padding: 4px 10px; background: #0f172a; color: #fff; font-size: 9.5px; font-weight: 800; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">
          CASH INVOICE LEDGER
        </div>
        <div style="font-size: 9.5px; color: #64748b; margin-top: 6px;">
          Date: <strong>${currentDate}</strong><br>
          Time: <strong>${currentTime}</strong>
        </div>
      </td>
    </tr>
  </table>

  <!-- Title Banner with Clear Scope Notice -->
  <div class="title-banner">
    <div>
      <span style="font-size: 13px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">
        Party Ledger Statement
      </span>
      <span style="font-size: 10px; background: #0d9488; color: #fff; padding: 2px 6px; border-radius: 10px; font-weight: 700; margin-left: 6px;">
        CASH INVOICES ONLY
      </span>
    </div>
    <div style="font-size: 10px; color: #0f766e; font-weight: 600;">
      Statement Period: All Recorded Cash Memos
    </div>
  </div>

  <!-- Customer Details Card -->
  <div class="customer-card">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 60%; vertical-align: top;">
          <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Customer / Hospital Details</div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">${customer.name}</div>
          ${customer.address ? `<div style="font-size: 10.5px; color: #475569; margin-top: 2px;">📍 ${customer.address}</div>` : ""}
          ${customer.contactPerson ? `<div style="font-size: 10px; color: #64748b; margin-top: 3px;">Contact Person: <strong style="color:#0f172a;">${customer.contactPerson}</strong></div>` : ""}
        </td>
        <td style="width: 40%; vertical-align: top; text-align: right;">
          ${customer.phone || customer.mobile ? `<div style="font-size: 10px; color: #475569;">Primary Phone: <strong style="color:#0f172a;">${customer.phone || customer.mobile}</strong></div>` : ""}
          ${customer.otNumber ? `<div style="font-size: 10px; color: #475569; margin-top: 2px;">OT Line: <strong style="color:#0d9488;">${customer.otNumber}</strong></div>` : ""}
          ${customer.gstNumber ? `<div style="font-size: 10px; color: #475569; margin-top: 2px;">GSTIN: <strong style="color:#0f172a;">${customer.gstNumber}</strong></div>` : ""}
          <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Total Invoices: <strong style="color:#0f172a;">${summary.invoiceCount}</strong></div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Summary KPI Cards -->
  <div class="summary-grid">
    <div class="summary-cell billed">
      <div style="font-size: 9px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Total Billed (Debits)</div>
      <div style="font-size: 16px; font-weight: 800; color: #1e3a8a; margin-top: 2px;">₹${summary.totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div style="font-size: 9px; color: #60a5fa; margin-top: 1px;">Gross cash invoice billings</div>
    </div>
    <div class="summary-cell received">
      <div style="font-size: 9px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">Payments Received (Credits)</div>
      <div style="font-size: 16px; font-weight: 800; color: #047857; margin-top: 2px;">₹${summary.totalReceived.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div style="font-size: 9px; color: #34d399; margin-top: 1px;">Settlements & receipts recorded</div>
    </div>
    <div class="summary-cell due">
      <div style="font-size: 9px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Net Outstanding Due</div>
      <div style="font-size: 16px; font-weight: 800; color: #b91c1c; margin-top: 2px;">₹${summary.balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div style="font-size: 9px; color: #f87171; margin-top: 1px;">${summary.balanceDue > 0 ? "Pending collection balance" : "All dues cleared"}</div>
    </div>
  </div>

  <!-- Invoices Table -->
  <table class="ledger-table">
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th style="text-align: left; width: 95px;">Date</th>
        <th style="text-align: left; width: 120px;">Invoice #</th>
        <th style="text-align: left; width: 100px;">DC Ref</th>
        <th style="text-align: right; width: 110px;">Billed (₹)</th>
        <th style="text-align: right; width: 110px;">Received (₹)</th>
        <th style="text-align: right; width: 110px;">Balance Due (₹)</th>
        <th style="text-align: center; width: 75px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${
        rowsHtml.length > 0
          ? rowsHtml
          : `<tr><td colspan="8" style="text-align:center; padding: 25px; color:#94a3b8; font-style:italic;">No cash invoices recorded for this customer.</td></tr>`
      }
    </tbody>
    <tfoot>
      <tr style="background: #f8fafc; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-weight: 800; font-size: 11px;">
        <td colspan="4" style="padding: 9px 8px; text-align: right; text-transform: uppercase; color: #0f172a;">Total / Closing Balance:</td>
        <td style="padding: 9px 8px; text-align: right; color: #1e3a8a;">₹${summary.totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 9px 8px; text-align: right; color: #047857;">₹${summary.totalReceived.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 9px 8px; text-align: right; color: ${summary.balanceDue > 0 ? "#b91c1c" : "#047857"};">₹${summary.balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 9px 8px; text-align: center; font-size: 10px;">${summary.balanceDue > 0 ? "DUE" : "CLEAR"}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Scope Clarification Notice -->
  <div class="scope-notice">
    <strong>ℹ️ Ledger Scope Note:</strong> This ledger statement specifically tracks Cash Invoices and recorded settlements. Standard Delivery Challans (DCs) without cash invoices are tracked in the DC workflow.
  </div>

  <!-- Settlement / Payment Info & QR Code -->
  <div class="settlement-card">
    <div style="flex: 1;">
      <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #0f766e; letter-spacing: 0.5px;">
        Bank Settlement &amp; UPI Payment Details
      </div>
      <div style="font-size: 10.5px; color: #334155; margin-top: 4px; line-height: 1.5;">
        Account Name: <strong>${compName}</strong><br>
        Bank: <strong>HDFC Bank</strong> | Branch: <strong>Kalyan Nagar, Hyderabad</strong><br>
        UPI VPA: <strong style="color: #0d9488;">${upiId}</strong><br>
        <span style="font-size: 9.5px; color: #64748b;">Please mention Customer Name or Invoice # when making NEFT/IMPS/UPI transfers.</span>
      </div>
    </div>
    <div style="text-align: center; margin-left: 16px;">
      <img src="${qrUrl}" alt="UPI QR" style="width: 80px; height: 80px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; background: #fff;" />
      <div style="font-size: 8.5px; font-weight: 700; color: #64748b; margin-top: 2px;">SCAN TO PAY UPI</div>
    </div>
  </div>

  <!-- Signatory -->
  <table style="width: 100%; margin-top: 35px; border-collapse: collapse;">
    <tr>
      <td style="width: 60%; vertical-align: bottom; font-size: 9.5px; color: #64748b;">
        Computer-generated Cash Invoice Ledger Statement.<br>
        For account clarifications, please call ${compPhone}.
      </td>
      <td style="width: 40%; vertical-align: bottom; text-align: right;">
        <div style="border-top: 1px dashed #94a3b8; display: inline-block; padding-top: 6px; min-width: 170px; text-align: center;">
          <div style="font-size: 10.5px; font-weight: 800; color: #0f172a;">SRR ORTHO PLUS</div>
          <div style="font-size: 9.5px; color: #64748b;">Authorized Signatory</div>
        </div>
      </td>
  </table>
</body>
</html>`;
}

export function printCustomerCashLedger(
  customer: Customer,
  invoices: CashInvoiceData[],
  summary: CustomerLedgerSummary
): boolean {
  try {
    const html = generateCustomerCashLedgerPrintHtml(customer, invoices, summary);

    // Remove any previously created print iframe
    const existingFrame = document.getElementById("customer-ledger-print-frame");
    if (existingFrame) {
      existingFrame.remove();
    }

    // Create a hidden iframe attached to current document
    const iframe = document.createElement("iframe");
    iframe.id = "customer-ledger-print-frame";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.zIndex = "-9999";
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDoc = frameWindow?.document;
    if (!frameDoc || !frameWindow) {
      // Fallback in case iframe is inaccessible
      window.print();
      return true;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    // Trigger print preview directly in the same tab once content and styles have loaded
    setTimeout(() => {
      try {
        frameWindow.focus();
        frameWindow.print();
      } catch (e) {
        console.error("Print statement error:", e);
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 3000);
      }
    }, 350);

    return true;
  } catch (err) {
    console.error("Failed to print Customer Ledger:", err);
    return false;
  }
}
