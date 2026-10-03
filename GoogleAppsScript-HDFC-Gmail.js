/**
 * ============================================================================
 * SRR ORTHO PLUS - 100% AUTOMATIC GMAIL TO FIRESTORE DIRECT INGESTION
 * ============================================================================
 * 
 * HOW IT WORKS:
 * 1. Email arrives in Gmail (Account A).
 * 2. Time Trigger runs every 1-5 minutes 24/7 in Google Cloud (No browser/app needed).
 * 3. Authenticates with your Firebase Project (Account B).
 * 4. Inserts the transaction DIRECTLY into Firestore DB ("bank_transactions").
 * 5. Marks email as "HDFC-Synced" so it never scans it again (0% Quota Waste).
 * 
 * ============================================================================
 * SETUP INSTRUCTIONS (2 Minutes):
 * ============================================================================
 * 1. Open https://script.google.com in your Gmail account.
 * 2. Click "+ New project".
 * 3. In "Code.gs", SELECT ALL (Ctrl+A / Cmd+A), DELETE, and paste this entire code.
 * 4. Fill in your Firebase login email and password in SETTINGS below:
 *      FIREBASE_AUTH_EMAIL: 'your-app-login-email@example.com',
 *      FIREBASE_AUTH_PASSWORD: 'your-password',
 * 5. Click Save (💾).
 * 6. Select "runAutoSyncOnce" from top dropdown and click "▶ Run".
 *    -> Review permissions -> Allow.
 *    -> Execution log will show: "✅ INSERTED TO DB: [CREDIT] ₹...".
 * 7. SET UP 24/7 AUTOMATIC TRIGGER:
 *    -> Click the ⏰ Alarm Clock icon ("Triggers") on the left sidebar.
 *    -> Click "+ Add Trigger" (bottom right blue button).
 *    -> Choose which function to run: "runAutoSyncOnce"
 *    -> Select event source: "Time-driven"
 *    -> Select type of time based trigger: "Minutes timer"
 *    -> Select minute interval: "Every 5 minutes" (or "Every minute")
 *    -> Click Save!
 * 
 * YOU ARE DONE! Every incoming bank alert will insert into your DB automatically 24/7!
 */

const SETTINGS = {
  FIREBASE_PROJECT_ID: 'srrorthodc-antigravity',
  FIREBASE_API_KEY: 'AIzaSyDuK5kOP_WsiFTgMQE7B2qyYaAPDwdi_hY',
  
  // Enter the email and password you use to log into your SRR Ortho app:
  FIREBASE_AUTH_EMAIL: 'hivamshikrishna@gmail.com',
  FIREBASE_AUTH_PASSWORD: 'Cnx@$02081994',

  GMAIL_SEARCH_QUERY: 'label:HDFC-Bank -label:HDFC-Synced newer_than:14d',
  FALLBACK_QUERY: '(from:alerts@hdfcbank.net OR subject:"HDFC Bank") -label:HDFC-Synced newer_than:14d',
  PROCESSED_LABEL: 'HDFC-Synced',
  BATCH_LIMIT: 10,
};

/**
 * 24/7 AUTOMATIC SYNC FUNCTION (Runs automatically via Cloud Timer Trigger)
 */
function runAutoSyncOnce() {
  Logger.log("Starting automatic background Gmail -> Firestore direct ingestion...");

  // 1. Get Firebase Auth Token to authenticate with Account B's Firestore
  const idToken = getFirebaseIdToken();
  if (!idToken) {
    Logger.log("❌ Authentication failed. Please check FIREBASE_AUTH_EMAIL and FIREBASE_AUTH_PASSWORD in SETTINGS.");
    return { success: false, error: "Auth failed" };
  }
  Logger.log("✅ Authenticated with Firebase successfully.");

  // 2. Create the HDFC-Synced label if it doesn't exist
  let syncedLabel;
  try {
    syncedLabel = GmailApp.getUserLabelByName(SETTINGS.PROCESSED_LABEL);
    if (!syncedLabel) {
      syncedLabel = GmailApp.createLabel(SETTINGS.PROCESSED_LABEL);
    }
  } catch (e) {
    Logger.log("Label notice: " + e);
  }

  // 3. Pre-fetch Accounts to map 1538 / 6569 to correct account IDs
  const accountsMap = fetchFirestoreAccounts(idToken);
  Logger.log("Mapped " + Object.keys(accountsMap).length + " bank account target(s).");

  // 4. Search for only NEW un-synced emails (limited to recent 14 days)
  let threads = [];
  try {
    threads = GmailApp.search(SETTINGS.GMAIL_SEARCH_QUERY, 0, SETTINGS.BATCH_LIMIT);
    if (!threads || threads.length === 0) {
      threads = GmailApp.search(SETTINGS.FALLBACK_QUERY, 0, SETTINGS.BATCH_LIMIT);
    }
  } catch (err) {
    Logger.log("❌ Gmail API Quota Error: " + err);
    Logger.log("Google daily limit reached for GmailApp. The quota will reset automatically in a few hours. Set trigger interval to 10-15 minutes.");
    return { success: false, error: err.toString() };
  }

  if (!threads || threads.length === 0) {
    Logger.log("All caught up! 0 new transaction emails to process.");
    return { success: true, count: 0 };
  }

  Logger.log("Found " + threads.length + " new email thread(s). Batch fetching...");
  const messagesByThread = GmailApp.getMessagesForThreads(threads);
  let savedCount = 0;

  for (let i = 0; i < messagesByThread.length; i++) {
    const thread = threads[i];
    const messages = messagesByThread[i];

    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];
      const subject = msg.getSubject() || "";
      const msgDate = msg.getDate();

      const plainBody = msg.getPlainBody() || "";
      let htmlText = "";
      
      // Extract from HTML table if plain text is minimal
      if (!plainBody || plainBody.length < 250 || !/INR|Rs|deposited|debited|credited/i.test(plainBody)) {
        const rawHtml = msg.getBody() || "";
        htmlText = rawHtml
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<br\s*[\/]?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<\/tr>/gi, "\n")
          .replace(/<td[^>]*>/gi, "  ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/[ \t]+/g, " ");
      }

      const combinedBody = (plainBody + "\n\n" + htmlText).trim();
      const tx = parseHdfcEmail(combinedBody, subject, msgDate);

      if (tx) {
        // Map account ID
        let targetAccId = accountsMap[tx.accountSuffix] || accountsMap['default'] || '';
        tx.accountId = targetAccId;

        // Insert DIRECTLY into Firestore DB
        const inserted = insertTransactionToFirestore(tx, idToken);
        if (inserted) {
          savedCount++;
          Logger.log(`✅ INSERTED TO DB: [${tx.type.toUpperCase()}] ₹${tx.amount} | Ref: ${tx.referenceNumber} | A/c: ..${tx.accountSuffix}`);
        }
      }
    }

    // Mark email as synced so it is NEVER processed again
    if (syncedLabel) {
      thread.addLabel(syncedLabel);
    }
  }

  Logger.log(`🎉 Ingestion Complete! Saved ${savedCount} transactions directly into Firestore DB.`);
  return { success: true, count: savedCount };
}

/**
 * Authenticates with Firebase REST API and retrieves idToken
 */
function getFirebaseIdToken() {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${SETTINGS.FIREBASE_API_KEY}`;
    const payload = {
      email: SETTINGS.FIREBASE_AUTH_EMAIL,
      password: SETTINGS.FIREBASE_AUTH_PASSWORD,
      returnSecureToken: true
    };
    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      return data.idToken;
    } else {
      Logger.log("Firebase Auth error: " + response.getContentText());
      return null;
    }
  } catch (err) {
    Logger.log("Error during Firebase Auth: " + err);
    return null;
  }
}

/**
 * Inserts a transaction object directly into Firestore via REST API
 */
function insertTransactionToFirestore(tx, idToken) {
  try {
    const docId = tx.id;
    const url = `https://firestore.googleapis.com/v1/projects/${SETTINGS.FIREBASE_PROJECT_ID}/databases/(default)/documents/bank_transactions/${docId}`;

    const firestoreDoc = {
      fields: {
        id: { stringValue: tx.id },
        accountId: { stringValue: tx.accountId || '' },
        type: { stringValue: tx.type },
        amount: { doubleValue: Number(tx.amount) },
        date: { stringValue: tx.date },
        time: { stringValue: tx.time || '12:00' },
        category: { stringValue: tx.category || 'Invoice Collection' },
        description: { stringValue: tx.description || 'HDFC Bank Alert' },
        referenceNumber: { stringValue: tx.referenceNumber || '' },
        accountSuffix: { stringValue: tx.accountSuffix || '' },
        createdSource: { stringValue: 'gmail_auto_trigger' },
        emailSubject: { stringValue: tx.emailSubject || '' },
        rawEmailBody: { stringValue: (tx.rawEmailBody || '').slice(0, 1500) },
        createdAt: { integerValue: String(tx.createdAt || Date.now()) },
        updatedAt: { integerValue: String(Date.now()) },
      }
    };

    if (tx.availableBalance !== undefined && tx.availableBalance !== null) {
      firestoreDoc.fields.availableBalance = { doubleValue: Number(tx.availableBalance) };
    }

    const options = {
      method: 'PATCH',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + idToken
      },
      payload: JSON.stringify(firestoreDoc),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200) {
      return true;
    } else {
      Logger.log(`Firestore Insert Error (HTTP ${code}): ` + response.getContentText());
      return false;
    }
  } catch (err) {
    Logger.log("Error inserting transaction to Firestore: " + err);
    return false;
  }
}

/**
 * Fetches bank accounts from Firestore
 */
function fetchFirestoreAccounts(idToken) {
  const map = {};
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${SETTINGS.FIREBASE_PROJECT_ID}/databases/(default)/documents/bank_accounts`;
    const options = {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + idToken
      },
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      if (data && data.documents) {
        data.documents.forEach(doc => {
          const f = doc.fields;
          const accId = f.id ? f.id.stringValue : doc.name.split('/').pop();
          const accNum = f.accountNumber ? f.accountNumber.stringValue : '';
          const accName = f.accountName ? f.accountName.stringValue : '';
          
          if (!map['default']) map['default'] = accId;

          if (accNum.includes('1538') || accName.includes('1538')) map['1538'] = accId;
          if (accNum.includes('6569') || accName.includes('6569')) map['6569'] = accId;
          
          const cleanDigits = accNum.replace(/[^0-9]/g, '');
          if (cleanDigits.length >= 4) {
            map[cleanDigits.slice(-4)] = accId;
          }
        });
      }
    }
  } catch (e) {
    Logger.log("Could not pre-fetch accounts map: " + e);
  }
  return map;
}

/**
 * Intelligent HDFC Multi-Account Parser (1538 & 6569)
 */
function parseHdfcEmail(body, subject, dateObj) {
  const fullText = (subject + "\n" + body).trim();

  // 1. Determine Credit vs Debit
  let isCredit = false;
  let isDebit = false;

  if (/is\s+deducted\s+from|deducted\s+from|is\s+debited\s+from|debited\s+from|withdrawn\s+from|spent|sent|paid\s+to|NEFT\s+Dr|IMPS\s+Dr|RTGS\s+Dr|debited\s+by|debited\s+with/i.test(fullText)) {
    isDebit = true;
  } else if (/received\s+a\s+credit|amount\s+received|credited\s+to|is\s+credited|fund\s+transfer\s+received|deposited|NEFT\s+Cr|IMPS\s+Cr|RTGS\s+Cr|credited\s+by|credited\s+with/i.test(fullText)) {
    isCredit = true;
  } else if (/\bcredit\b|\breceived\b|\binward\b|\bcr\b|\bdeposited\b/i.test(fullText)) {
    isCredit = true;
  } else if (/\bdebit\b|\bdeducted\b|\boutward\b|\bdr\b|\bdebited\b/i.test(fullText)) {
    isDebit = true;
  }

  if (!isCredit && !isDebit) return null;

  // 2. Extract Amount
  const amountMatch =
    fullText.match(/(?:Amount\s*(?:received|debited|credited)?\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*|Rs\.?\s*INR\s*|Rs\.?\s*|INR\s*|₹\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    fullText.match(/(?:amount|amt)\s*(?:of)?\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    fullText.match(/(?:for|with|by)\s*(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    fullText.match(/\b(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\b/i);

  if (!amountMatch) return null;
  const rawAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (isNaN(rawAmount) || rawAmount <= 0) return null;

  // 3. Extract Account Suffix (1538 or 6569)
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

  // 6. Extract Sender / Beneficiary Narration
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

  // 7. Extract Exact Transaction Date from Text
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
    createdSource: "gmail_auto_trigger",
    createdAt: dateObj.getTime(),
    updatedAt: Date.now(),
  };
}
