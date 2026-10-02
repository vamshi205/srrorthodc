/**
 * ============================================================================
 * SRR ORTHO PLUS - SECURE MULTI-ACCOUNT HDFC GMAIL CONNECTOR (LAST 200 EMAILS)
 * ============================================================================
 * 
 * SECURITY GUARANTEES:
 * 1. READ-ONLY: Uses https://www.googleapis.com/auth/gmail.readonly
 * 2. STRICT LABEL ISOLATION: Scans ONLY emails with "label:HDFC-Bank"
 * 
 * 1-MINUTE DEPLOYMENT INSTRUCTIONS:
 * 1. Go to https://script.google.com and click "+ New project".
 * 2. In "Code.gs", DELETE everything and paste this entire file.
 * 3. Click "Project Settings" (⚙️ icon on the left) -> check "Show 'appsscript.json' manifest file".
 * 4. In "appsscript.json", ensure it has:
 *    "oauthScopes": ["https://www.googleapis.com/auth/gmail.readonly"]
 * 5. Click Save (💾).
 * 6. Select function "testRunAndLog" from the top dropdown and click "▶ Run".
 *    -> Click "Review permissions" -> select your Google account -> "Advanced" -> "Go to Untitled project (unsafe)" -> "Allow".
 * 7. Click "Deploy" (top right blue button) -> "New deployment" -> Select type "Web app":
 *    - Description: HDFC Bank Connector
 *    - Execute as: Me (<your-email>)
 *    - Who has access: Anyone (CRITICAL!)
 * 8. Click "Deploy", copy the Web App URL (ends in /exec), and paste it in your app!
 */

const CONFIG = {
  GMAIL_LABEL_QUERY: "label:HDFC-Bank",
  PAGE_SIZE: 50,
  MAX_TRANSACTIONS: 200, // Strictly caps at the newest 200 transactions
};

/**
 * Main Web App Handler (Supports direct GET & JSONP)
 */
function doGet(e) {
  try {
    const transactions = syncHdfcBankAlerts();
    const callback = e && e.parameter && e.parameter.callback;
    const output = JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      count: transactions.length,
      transactions: transactions,
    });

    if (callback) {
      return ContentService
        .createTextOutput(callback + "(" + output + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    const errorOutput = JSON.stringify({
      success: false,
      error: err.toString(),
      transactions: [],
    });
    return ContentService.createTextOutput(errorOutput).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Scans label:HDFC-Bank and extracts the newest 200 transactions
 */
function syncHdfcBankAlerts() {
  const parsedTransactions = [];
  const seenTxKeys = new Set();
  
  // Directly retrieve the latest 200 threads matching label:HDFC-Bank
  const threads = GmailApp.search(CONFIG.GMAIL_LABEL_QUERY, 0, CONFIG.MAX_TRANSACTIONS);
  if (!threads || threads.length === 0) {
    Logger.log("No emails found for query: " + CONFIG.GMAIL_LABEL_QUERY);
    return [];
  }

  for (let i = 0; i < threads.length; i++) {
    if (parsedTransactions.length >= CONFIG.MAX_TRANSACTIONS) break;

    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      if (parsedTransactions.length >= CONFIG.MAX_TRANSACTIONS) break;

      const msg = messages[j];
      let body = msg.getPlainBody() || "";
      
      // If plain body is minimal, extract from HTML
      if (!body || body.trim().length < 30) {
        const rawHtml = msg.getBody() || "";
        body = rawHtml
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<br\s*[\/]?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<\/tr>/gi, "\n")
          .replace(/<td[^>]*>/gi, "  ")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/[ \t]+/g, " ")
          .trim();
      }

      const subject = msg.getSubject() || "";
      const msgDate = msg.getDate();

      const parsed = parseHdfcEmail(body, subject, msgDate);
      if (parsed) {
        const uniqueKey = `${parsed.date}_${parsed.amount}_${parsed.referenceNumber}_${parsed.accountSuffix}`;
        if (!seenTxKeys.has(uniqueKey)) {
          seenTxKeys.add(uniqueKey);
          parsedTransactions.push(parsed);
        }
      }
    }
  }

  const result = parsedTransactions.slice(0, CONFIG.MAX_TRANSACTIONS);
  Logger.log(`Scanned ${threads.length} newest email threads -> Extracted ${result.length} transactions (strictly capped at 200).`);
  return result;
}

/**
 * TEST FUNCTION: Select this and click "▶ Run" to test in the script console
 */
function testRunAndLog() {
  Logger.log("Testing HDFC Bank sync for last 200 emails...");
  const txs = syncHdfcBankAlerts();
  Logger.log("Total Transactions Parsed: " + txs.length);
  
  if (txs.length > 0) {
    Logger.log("--- SAMPLE PARSED RECORD #1 ---");
    Logger.log(JSON.stringify(txs[0], null, 2));
    Logger.log("--- SAMPLE PARSED RECORD #2 ---");
    if (txs.length > 1) {
      Logger.log(JSON.stringify(txs[1], null, 2));
    }
  } else {
    Logger.log("No transactions found. Check if label 'HDFC-Bank' contains emails in your Gmail.");
  }
}

/**
 * Intelligent HDFC Multi-Account Parser (Tailored for 1538 & 6569)
 */
function parseHdfcEmail(body, subject, dateObj) {
  const fullText = (subject + "\n" + body).trim();

  // 1. Determine Credit vs Debit
  let isCredit = false;
  let isDebit = false;

  if (/is\s+deducted\s+from|deducted\s+from|is\s+debited\s+from|debited\s+from|withdrawn\s+from|spent|sent|NEFT\s+Dr|IMPS\s+Dr|RTGS\s+Dr/i.test(fullText)) {
    isDebit = true;
  } else if (/received\s+a\s+credit|amount\s+received|credited\s+to|is\s+credited|fund\s+transfer\s+received|deposited|NEFT\s+Cr|IMPS\s+Cr|RTGS\s+Cr/i.test(fullText)) {
    isCredit = true;
  } else if (/credit|received|inward|cr\b/i.test(fullText)) {
    isCredit = true;
  } else if (/debit|deducted|outward|dr\b/i.test(fullText)) {
    isDebit = true;
  }

  if (!isCredit && !isDebit) return null;

  // 2. Extract Amount
  const amountMatch =
    fullText.match(/(?:Amount\s*received:\s*(?:INR|Rs\.?|₹)?\s*|Rs\.?\s*INR\s*|Rs\.?\s*|INR\s*|₹\s*)([0-9,]+(?:\.[0-9]{2})?)/i) ||
    fullText.match(/amount\s*(?:of)?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{2})?)/i) ||
    fullText.match(/for\s*(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{2})?)/i);

  if (!amountMatch) return null;
  const rawAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (isNaN(rawAmount) || rawAmount <= 0) return null;

  // 3. Extract Specific Account Suffix (1538 or 6569 with any X/XX/* prefix)
  let matchedAccountSuffix = "";
  if (/[*xX]*6569\b/i.test(fullText) || /6569\b/.test(fullText)) {
    matchedAccountSuffix = "6569";
  } else if (/[*xX]*1538\b/i.test(fullText) || /1538\b/.test(fullText)) {
    matchedAccountSuffix = "1538";
  } else {
    const accMatch =
      fullText.match(/(?:account\s*ending\s*(?:with|in)?|account:\s*|account\s*no\.?|a\/c\s*no\.?)\s*[*xX\-]*([0-9]{4})\b/i) ||
      fullText.match(/[*xX]{1,}([0-9]{4})\b/i);

    if (accMatch) {
      matchedAccountSuffix = accMatch[1].trim();
    }
  }

  // 4. Extract Real-Time Available Balance
  let availableBal = null;
  const balMatch = fullText.match(/(?:Available\s+Balance|available\s+balance\s+in\s+your\s+account\s+is|updated\s+balance|net\s+balance)[:\s]*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (balMatch) {
    const parsedBal = parseFloat(balMatch[1].replace(/,/g, ''));
    if (!isNaN(parsedBal)) {
      availableBal = parsedBal;
    }
  }

  // 5. Extract Reference / UTR Number
  let refNo = "";
  const upiRefMatch = fullText.match(/(?:UPI\s*(?:transaction\s*)?reference\s*no\.?|UPI\s*ref(?:erence)?\s*(?:no\.?)?)[:\s\-]*([0-9]{8,22})/i);
  const neftRefMatch = fullText.match(/(?:NEFT|IMPS|RTGS)\s*(?:Cr|Dr)-([A-Za-z0-9]+)-(.+)/i);
  const refDetailsMatch = fullText.match(/Reference\s*Details\s*:\s*([^\n\r]+(?:\r?\n\s*[^\n\r]+)?)/i);
  const genericRefMatch =
    fullText.match(/(?:with\s+reference\s+number|reference\s*number|ref\s*no\.?|ref\s*#|txn\s*id|utr|rrn)[:\s\-]*([A-Za-z0-9]{6,25})/i) ||
    fullText.match(/UPI\/([0-9]{12})/i);

  if (upiRefMatch) {
    refNo = upiRefMatch[1].trim();
  } else if (neftRefMatch) {
    const parts = neftRefMatch[2].split('-');
    if (parts.length >= 2) {
      refNo = parts[parts.length - 1].trim().replace(/[^a-zA-Z0-9]/g, '');
    } else {
      refNo = neftRefMatch[1].trim();
    }
  } else if (refDetailsMatch) {
    const rawRefText = refDetailsMatch[1].replace(/\r?\n\s*/g, ' ').trim();
    const parts = rawRefText.split(/\s*-\s*/).map(function(p) { return p.trim(); }).filter(Boolean);
    if (parts.length >= 3) {
      refNo = parts[1].replace(/[^a-zA-Z0-9]/g, '');
    } else if (parts.length >= 2) {
      refNo = parts[0].replace(/[^a-zA-Z0-9]/g, '');
    } else {
      refNo = rawRefText.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    }
  } else if (genericRefMatch) {
    refNo = genericRefMatch[1].trim();
  } else {
    refNo = "HDFC-" + (matchedAccountSuffix ? matchedAccountSuffix + "-" : "") + dateObj.getTime().toString().slice(-6);
  }

  // 6. Extract Sender / Beneficiary / Counterparty Narration
  let narration = isCredit ? "HDFC Bank Credit Alert" : "HDFC Bank Debit Alert";

  const senderMatch = fullText.match(/Sender\s*:\s*([^\n\r]+)/i);
  const beneMatch = fullText.match(/Beneficiary\s*:\s*([^\n\r]+)/i);
  const vpaMatch = fullText.match(/(?:towards|from)\s+VPA\s+([^\s\(]+)(?:\s*\(([^)]+)\))?/i);
  const addedToMatch = fullText.match(/added\s+to\s+([^\.\n]+?)(?:\s+account|\s+on|\.|\n|$)/i);

  if (senderMatch) {
    const rawLine = senderMatch[1].trim();
    const vpaMatchLine = rawLine.match(/\((?:VPA:\s*)?([^)]+)\)/i);
    const nameOnly = rawLine.replace(/\([^)]*\)/g, '').replace(/\b(?:c\.|d\.|UPI Reference)[\s\S]*/i, '').trim();
    if (nameOnly && !/inform\s+you|writing\s+to|dear\s+customer/i.test(nameOnly)) {
      const vpa = vpaMatchLine ? vpaMatchLine[1].trim() : '';
      narration = vpa ? `UPI: ${nameOnly} (${vpa})` : `UPI Deposit: ${nameOnly}`;
    }
  } else if (beneMatch) {
    const rawLine = beneMatch[1].trim();
    const vpaMatchLine = rawLine.match(/\((?:VPA:\s*)?([^)]+)\)/i);
    const nameOnly = rawLine.replace(/\([^)]*\)/g, '').replace(/\b(?:c\.|d\.|UPI Reference)[\s\S]*/i, '').trim();
    if (nameOnly && !/inform\s+you|writing\s+to|dear\s+customer/i.test(nameOnly)) {
      const vpa = vpaMatchLine ? vpaMatchLine[1].trim() : '';
      narration = vpa ? `UPI Payout: ${nameOnly} (${vpa})` : `Payout: ${nameOnly}`;
    }
  } else if (vpaMatch) {
    const vpaId = vpaMatch[1].trim();
    const merchantName = vpaMatch[2] ? vpaMatch[2].trim() : "";
    narration = merchantName ? `UPI: ${merchantName} (${vpaId})` : `UPI: ${vpaId}`;
  } else if (refDetailsMatch) {
    const rawRefText = refDetailsMatch[1].replace(/\r?\n\s*/g, ' ').trim();
    const parts = rawRefText.split(/\s*-\s*/).map(function(p) { return p.trim(); }).filter(Boolean);

    if (parts.length >= 2) {
      const firstPart = parts[0];
      const lastPart = parts[parts.length - 1];

      if (/sri\s*raja\s*rajeshwari|srr\s*ortho|ortho\s*plus/i.test(firstPart)) {
        if (lastPart && !/available\s+balance|thank\s+you|warm\s+regards/i.test(lastPart)) {
          narration = isCredit ? `NEFT Deposit: ${lastPart}` : `NEFT Payout: ${lastPart}`;
        }
      } else if (!/available\s+balance|thank\s+you|warm\s+regards/i.test(firstPart)) {
        narration = isCredit ? `NEFT Deposit: ${firstPart}` : `NEFT Payout: ${firstPart}`;
      }
    } else if (rawRefText && !/available\s+balance|thank\s+you|warm\s+regards/i.test(rawRefText)) {
      narration = (isCredit ? "NEFT Deposit: " : "NEFT Payout: ") + rawRefText.slice(0, 50);
    }
  } else if (neftRefMatch) {
    const parts = neftRefMatch[2].split('-');
    const partyName = parts[0] ? parts[0].trim() : "";
    const secondParty = parts[1] && parts.length > 2 ? parts[1].trim() : "";
    if (isCredit) {
      narration = `NEFT Deposit: ${partyName}`;
    } else {
      narration = `NEFT Payout: ${partyName}${secondParty && secondParty.length < 25 ? ` (${secondParty})` : ''}`;
    }
  } else if (addedToMatch) {
    const targetName = addedToMatch[1].trim().replace(/\s+/g, ' ');
    narration = `Transfer: ${targetName}`;
  } else {
    const genericPartyMatch = fullText.match(/(?:from|by|towards|to)\s+([A-Za-z0-9\s\.\/\-\@]+?)(?:\s+on|\s+via|\s+through|\s+dated|\.|\n|$)/i);
    if (genericPartyMatch && genericPartyMatch[1].trim().length > 2) {
      const candidate = genericPartyMatch[1].trim().replace(/\s+/g, ' ');
      if (!/inform\s+you|writing\s+to|account\s+ending|greetings|dear\s+customer|hdfc\s+bank/i.test(candidate)) {
        narration = (isCredit ? "Deposit: " : "Payout: ") + candidate.slice(0, 50);
      }
    }
  }

  // 7. Extract Exact Transaction Date from Text (e.g. 02-10-26, 27-SEP-2026, 01-OCT-2026)
  let yyyy = dateObj.getFullYear();
  let mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  let dd = String(dateObj.getDate()).padStart(2, '0');

  const textDateMatch = fullText.match(/\b([0-9]{1,2})[-/]([A-Za-z]{3}|[0-9]{1,2})[-/]([0-9]{2,4})\b/);
  if (textDateMatch) {
    dd = textDateMatch[1].padStart(2, '0');
    const rawMonth = textDateMatch[2];
    let year = textDateMatch[3];
    if (year.length === 2) year = `20${year}`;
    yyyy = parseInt(year, 10);

    const monthNames = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };

    if (monthNames[rawMonth.toLowerCase()]) {
      mm = monthNames[rawMonth.toLowerCase()];
    } else if (!isNaN(parseInt(rawMonth, 10))) {
      mm = String(parseInt(rawMonth, 10)).padStart(2, '0');
    }
  }

  const hours = String(dateObj.getHours()).padStart(2, '0');
  const mins = String(dateObj.getMinutes()).padStart(2, '0');

  return {
    id: "tx_gmail_" + refNo.replace(/[^a-zA-Z0-9]/g, '_'),
    accountSuffix: matchedAccountSuffix,
    type: isCredit ? "credit" : "debit",
    amount: rawAmount,
    availableBalance: availableBal !== null ? availableBal : undefined,
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hours}:${mins}`,
    category: isCredit ? "Invoice Collection" : (narration.includes('UPI') ? "UPI Expense" : "Vendor / Supplier"),
    description: narration,
    referenceNumber: refNo,
    emailSubject: subject,
    rawEmailBody: body.trim(),
    createdSource: "gmail_connector",
    createdAt: dateObj.getTime(),
    updatedAt: Date.now(),
  };
}
