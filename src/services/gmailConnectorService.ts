import { BankAccount, BankTransaction } from './bankAccountFirebaseService';

export interface ParsedHdfcEmailResult {
  amount: number;
  type: 'credit' | 'debit';
  accountSuffix: string;
  matchedAccount?: BankAccount;
  availableBalance?: number;
  date: string;
  time: string;
  narration: string;
  referenceNumber: string;
  rawConfidence: 'high' | 'medium' | 'low';
}

/**
 * Extracts clean counterparty / sender narration from HDFC alert text
 */
export function extractHdfcNarration(text: string, isCredit: boolean, fallback?: string): string {
  if (!text || !text.trim()) return fallback || (isCredit ? 'HDFC Bank Credit Alert' : 'HDFC Bank Debit Alert');

  // 1. Check for Sender: Line (e.g. Sender: JELLA KIRAN KUMAR GOUD (VPA: 9959393339@ybl))
  const senderMatch = text.match(/Sender\s*:\s*([^\n\r]+)/i);
  if (senderMatch) {
    const rawLine = senderMatch[1].trim();
    const vpaMatch = rawLine.match(/\((?:VPA:\s*)?([^)]+)\)/i);
    const nameOnly = rawLine.replace(/\([^)]*\)/g, '').replace(/\b(?:c\.|d\.|UPI Reference)[\s\S]*/i, '').trim();
    if (nameOnly && !/inform\s+you|writing\s+to|dear\s+customer/i.test(nameOnly)) {
      const vpa = vpaMatch ? vpaMatch[1].trim() : '';
      return vpa ? `UPI: ${nameOnly} (${vpa})` : `UPI Deposit: ${nameOnly}`;
    }
  }

  // 2. Check for Beneficiary: Line
  const beneMatch = text.match(/Beneficiary\s*:\s*([^\n\r]+)/i);
  if (beneMatch) {
    const rawLine = beneMatch[1].trim();
    const vpaMatch = rawLine.match(/\((?:VPA:\s*)?([^)]+)\)/i);
    const nameOnly = rawLine.replace(/\([^)]*\)/g, '').replace(/\b(?:c\.|d\.|UPI Reference)[\s\S]*/i, '').trim();
    if (nameOnly && !/inform\s+you|writing\s+to|dear\s+customer/i.test(nameOnly)) {
      const vpa = vpaMatch ? vpaMatch[1].trim() : '';
      return vpa ? `UPI Payout: ${nameOnly} (${vpa})` : `Payout: ${nameOnly}`;
    }
  }

  // 3. Check for towards/from VPA
  const vpaMatch = text.match(/(?:towards|from)\s+VPA\s+([^\s\(]+)(?:\s*\(([^)]+)\))?/i);
  if (vpaMatch) {
    const vpaId = vpaMatch[1].trim();
    const merchantName = vpaMatch[2] ? vpaMatch[2].trim() : '';
    return merchantName ? `UPI: ${merchantName} (${vpaId})` : `UPI: ${vpaId}`;
  }

  // 4. Reference Details Line (e.g. Reference Details: SRI RAJA RAJESHWARI ORTHO PLUS Cr - XXXXXXXXXX2022 - HORIZON MEDICAL SUPPLIES)
  const refDetailsMatch = text.match(/Reference\s*Details\s*:\s*([^\n\r]+(?:\r?\n\s*[^\n\r]+)?)/i);
  if (refDetailsMatch) {
    const rawRefText = refDetailsMatch[1].replace(/\r?\n\s*/g, ' ').trim();
    const parts = rawRefText.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);

    if (parts.length >= 2) {
      // If the first part is our firm name, the counterparty is the last part
      const firstPart = parts[0];
      const lastPart = parts[parts.length - 1];

      if (/sri\s*raja\s*rajeshwari|srr\s*ortho|ortho\s*plus/i.test(firstPart)) {
        if (lastPart && !/available\s+balance|thank\s+you|warm\s+regards/i.test(lastPart)) {
          return isCredit ? `NEFT Deposit: ${lastPart}` : `NEFT Payout: ${lastPart}`;
        }
      } else if (!/available\s+balance|thank\s+you|warm\s+regards/i.test(firstPart)) {
        return isCredit ? `NEFT Deposit: ${firstPart}` : `NEFT Payout: ${firstPart}`;
      }
    } else if (rawRefText && !/available\s+balance|thank\s+you|warm\s+regards/i.test(rawRefText)) {
      return (isCredit ? 'NEFT Deposit: ' : 'NEFT Payout: ') + rawRefText.slice(0, 50);
    }
  }

  // 5. NEFT Cr / Dr
  const neftRefMatch = text.match(/(?:NEFT|IMPS|RTGS)\s*(?:Cr|Dr)-([A-Za-z0-9]+)-(.+)/i);
  if (neftRefMatch) {
    const parts = neftRefMatch[2].split('-');
    const partyName = parts[0] ? parts[0].trim() : '';
    const secondParty = parts[1] && parts.length > 2 ? parts[1].trim() : '';
    if (isCredit) {
      return `NEFT Deposit: ${partyName}`;
    } else {
      return `NEFT Payout: ${partyName}${secondParty && secondParty.length < 25 ? ` (${secondParty})` : ''}`;
    }
  }

  // 6. Transfer to SELF / CHEQUE
  const addedToMatch = text.match(/added\s+to\s+([^\.\n]+?)(?:\s+account|\s+on|\.|\n|$)/i);
  if (addedToMatch) {
    return `Transfer: ${addedToMatch[1].trim().replace(/\s+/g, ' ')}`;
  }

  // 7. Generic sender but strictly filter out boilerplate
  const genericMatch =
    text.match(/(?:transfer\s+from|received\s+from)\s+([A-Za-z0-9\s\.\/\-\@]+?)(?:\.|\n|$)/i) ||
    text.match(/(?:by|from)\s+([A-Za-z0-9\s\.\/\-\@]+?)(?:\s+on|\s+via|\s+through|\s+dated|\.|\n|$)/i);

  if (genericMatch && genericMatch[1].trim().length > 2) {
    const candidate = genericMatch[1].trim().replace(/\s+/g, ' ');
    if (!/inform\s+you|writing\s+to|account\s+ending|greetings|dear\s+customer|hdfc\s+bank/i.test(candidate)) {
      return (isCredit ? 'Deposit: ' : 'Payout: ') + candidate.slice(0, 50);
    }
  }

  return fallback || (isCredit ? 'HDFC Bank Credit Alert' : 'HDFC Bank Debit Alert');
}

/**
 * Parses raw HDFC email alert text and automatically maps to the correct HDFC bank account
 */
export function parseHdfcEmailAlert(
  emailText: string,
  accounts: BankAccount[]
): ParsedHdfcEmailResult | null {
  if (!emailText || !emailText.trim()) return null;

  const text = emailText.trim();

  // 1. Credit vs Debit
  let isCredit = false;
  let isDebit = false;

  if (/is\s+deducted\s+from|deducted\s+from|is\s+debited\s+from|debited\s+from|withdrawn\s+from|spent|sent|paid\s+to|NEFT\s+Dr|IMPS\s+Dr|RTGS\s+Dr|debited\s+by|debited\s+with/i.test(text)) {
    isDebit = true;
  } else if (/received\s+a\s+credit|amount\s+received|credited\s+to|is\s+credited|fund\s+transfer\s+received|deposited|NEFT\s+Cr|IMPS\s+Cr|RTGS\s+Cr|credited\s+by|credited\s+with/i.test(text)) {
    isCredit = true;
  } else if (/\bcredit\b|\breceived\b|\binward\b|\bcr\b|\bdeposited\b/i.test(text)) {
    isCredit = true;
  } else if (/\bdebit\b|\bdeducted\b|\boutward\b|\bdr\b|\bdebited\b/i.test(text)) {
    isDebit = true;
  }

  if (!isCredit && !isDebit) return null;

  // 2. Amount Extraction (supports "Rs. 52,500.00", "Rs 52500", "INR 52,500.00", "₹500.00", "Amount: 1,000.00")
  const amountMatch =
    text.match(/(?:Amount\s*(?:received|debited|credited)?\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*|Rs\.?\s*INR\s*|Rs\.?\s*|INR\s*|₹\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    text.match(/(?:amount|amt)\s*(?:of)?\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    text.match(/(?:for|with|by)\s*(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    text.match(/\b(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\b/i);

  if (!amountMatch) return null;

  const rawAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (isNaN(rawAmount) || rawAmount <= 0) return null;

  // 3. Multi-Account Matching by Account Suffix (Strict 1538 vs 6569 with any X/XX/* prefix)
  let accountSuffix = '';
  if (/[*xX]*6569\b/i.test(text) || /6569\b/.test(text)) {
    accountSuffix = '6569';
  } else if (/[*xX]*1538\b/i.test(text) || /1538\b/.test(text)) {
    accountSuffix = '1538';
  } else {
    const accMatch =
      text.match(/(?:account\s*ending\s*(?:with|in)?|account:\s*|account\s*no\.?|a\/c\s*no\.?)\s*[*xX\-]*([0-9]{4})\b/i) ||
      text.match(/[*xX]{1,}([0-9]{4})\b/i);

    if (accMatch) {
      accountSuffix = accMatch[1].trim();
    }
  }

  // Find exact matching bank account by comparing suffix with configured account numbers
  let matchedAccount: BankAccount | undefined;
  if (accountSuffix === '1538') {
    matchedAccount = accounts.find((a) =>
      a.accountNumber.includes('1538') ||
      a.accountName.includes('1538') ||
      a.accountType === 'savings' ||
      a.accountName.toLowerCase().includes('savings') ||
      a.accountName.toLowerCase().includes('upi')
    );
  } else if (accountSuffix === '6569') {
    matchedAccount = accounts.find((a) =>
      a.accountNumber.includes('6569') ||
      a.accountName.includes('6569') ||
      a.accountType === 'current' ||
      a.accountName.toLowerCase().includes('main')
    );
  } else if (accountSuffix && accounts.length > 0) {
    matchedAccount = accounts.find((acc) => {
      const cleanAccNum = acc.accountNumber.replace(/[^0-9]/g, '');
      return cleanAccNum.endsWith(accountSuffix) || cleanAccNum.includes(accountSuffix) || acc.accountName.includes(accountSuffix);
    });
  }

  // Fallback if not matched
  if (!matchedAccount && accounts.length > 0) {
    matchedAccount = accounts.find((a) => a.isDefault) || accounts[0];
  }

  // 4. Extract Real-Time Available Balance (if present in email)
  let availableBal: number | undefined;
  const balMatch = text.match(/(?:Available\s+Balance|available\s+balance\s+in\s+your\s+account\s+is|updated\s+balance|net\s+balance)[:\s]*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (balMatch) {
    const parsedBal = parseFloat(balMatch[1].replace(/,/g, ''));
    if (!isNaN(parsedBal)) {
      availableBal = parsedBal;
    }
  }

  // 5. Extract Reference / UTR Number
  let refNo = '';
  const upiRefMatch = text.match(/(?:UPI\s*(?:transaction\s*)?reference\s*no\.?|UPI\s*ref(?:erence)?\s*(?:no\.?)?)[:\s\-]*([0-9]{8,22})/i);
  const neftRefMatch = text.match(/(?:NEFT|IMPS|RTGS)\s*(?:Cr|Dr)-([A-Za-z0-9]+)-(.+)/i);
  const genericRefMatch =
    text.match(/(?:UTR|Ref\s*No|UPI\s*Ref|Txn\s*ID|Reference\s*No|Ref\s*#)[:\s\-]*([A-Za-z0-9]{6,25})/i) ||
    text.match(/UPI[:\/\-\s]*([0-9]{10,18})/i) ||
    text.match(/IMPS[:\/\-\s]*([0-9]{10,18})/i) ||
    text.match(/NEFT[:\/\-\s]*([A-Za-z0-9]{8,22})/i);

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
    const parts = rawRefText.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
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
    refNo = `HDFC-${accountSuffix ? `${accountSuffix}-` : ''}${Date.now().toString().slice(-6)}`;
  }

  // 6. Extract Sender / Beneficiary / Narration
  const narration = extractHdfcNarration(text, isCredit);

  // 7. Extract Date & Time from Email text if available
  const now = new Date();
  let dateStr = now.toISOString().split('T')[0];
  let timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const dateMatch = text.match(/\b([0-9]{1,2})[-/]([A-Za-z]{3}|[0-9]{1,2})[-/]([0-9]{2,4})\b/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const rawMonth = dateMatch[2];
    let year = dateMatch[3];
    if (year.length === 2) year = `20${year}`;

    const monthNames: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };

    let monthStr = '01';
    if (monthNames[rawMonth.toLowerCase()]) {
      monthStr = monthNames[rawMonth.toLowerCase()];
    } else if (!isNaN(parseInt(rawMonth, 10))) {
      monthStr = String(parseInt(rawMonth, 10)).padStart(2, '0');
    }

    dateStr = `${year}-${monthStr}-${day}`;
  }

  // Time regex: e.g. 14:35 or 02:35 PM
  const timeMatch = text.match(/\b([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?\s*(am|pm|AM|PM)?\b/);
  if (timeMatch) {
    let hrs = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2];
    const ampm = timeMatch[4];
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hrs < 12) hrs += 12;
      if (ampm.toLowerCase() === 'am' && hrs === 12) hrs = 0;
    }
    timeStr = `${String(hrs).padStart(2, '0')}:${mins}`;
  }

  return {
    amount: rawAmount,
    type: isCredit ? 'credit' : 'debit',
    accountSuffix,
    matchedAccount,
    availableBalance: availableBal,
    date: dateStr,
    time: timeStr,
    narration,
    referenceNumber: refNo,
    rawConfidence: accountSuffix && matchedAccount ? 'high' : 'medium',
  };
}

/**
 * Parses multiple email alerts pasted in one batch
 */
export function parseMultipleHdfcEmailAlerts(
  rawText: string,
  accounts: BankAccount[]
): ParsedHdfcEmailResult[] {
  if (!rawText || !rawText.trim()) return [];

  // Split by common email boundaries or double line breaks
  const chunks = rawText
    .split(/(?=(?:Dear Customer|HDFC Bank:|Alert:|Your A\/c|Your account|INR\s*[0-9]|Rs\.?\s*[0-9]))/gi)
    .map((c) => c.trim())
    .filter((c) => c.length > 15);

  const results: ParsedHdfcEmailResult[] = [];

  for (const chunk of chunks) {
    const parsed = parseHdfcEmailAlert(chunk, accounts);
    if (parsed) {
      // Avoid duplicate references in same batch
      if (!results.some((r) => r.referenceNumber === parsed.referenceNumber && r.amount === parsed.amount)) {
        results.push(parsed);
      }
    }
  }

  // If chunking didn't produce multiple items, try single parse
  if (results.length === 0) {
    const single = parseHdfcEmailAlert(rawText, accounts);
    if (single) results.push(single);
  }

  return results;
}

