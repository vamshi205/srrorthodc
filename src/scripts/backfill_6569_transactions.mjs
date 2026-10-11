// Safe Backfill Script: Updates existing 6569 transactions in Firestore
// Re-parses the preserved rawEmailBody using extract6569Details

function extract6569Details(rawText, isCredit, fallback) {
  if (!rawText) return { narration: fallback || (isCredit ? "HDFC Bank Credit Alert" : "HDFC Bank Debit Alert"), refNo: "" };

  const text = rawText.replace(/\r?\n\s*/g, " ").trim();

  // 1. UPI format (Sender: ... or VPA)
  const senderMatch = rawText.match(/Sender\s*:\s*([^\n\r]+)/i);
  if (senderMatch) {
    const rawLine = senderMatch[1].trim();
    const vpaMatch = rawLine.match(/\((?:VPA:\s*)?([^)]+)\)/i);
    const nameOnly = rawLine.replace(/\([^)]*\)/g, '').replace(/\b(?:c\.|d\.|UPI Reference)[\s\S]*/i, '').trim();
    const vpa = vpaMatch ? vpaMatch[1].trim() : '';
    const upiRefMatch = rawText.match(/UPI\s*Reference\s*No\.?:\s*([0-9]+)/i);
    const upiRef = upiRefMatch ? upiRefMatch[1] : '';
    return {
      narration: vpa ? (`UPI: ${nameOnly} (${vpa})`) : (`UPI: ${nameOnly}`),
      refNo: upiRef,
      remitter: nameOnly
    };
  }

  // 2. Transfer to payee <Name> (NetBanking Transfer)
  const payeeMatch = rawText.match(/Transfer\s+to\s+payee\s+([A-Za-z0-9\s]+?)(?:\s+via|\.|\n|$)/i);
  if (payeeMatch) {
    const payeeName = payeeMatch[1].trim();
    return {
      narration: `Payout: ${payeeName} (NetBanking Transfer)`,
      refNo: `NetBanking-${payeeName}`,
      remitter: payeeName
    };
  }

  // 3. NEFT Dr (Vendor Payout): NEFT Dr-<IFSC>-<VENDOR>-<BRANCH>-<UTR> account on
  const neftDrMatch = text.match(/NEFT\s+Dr-([A-Za-z0-9]+)-([^\-]+)-([^\-]+)-([A-Za-z0-9]+)(?:\s+account\s+on|\b)/i);
  if (neftDrMatch) {
    const vendor = neftDrMatch[2].trim();
    const branch = neftDrMatch[3].trim();
    const utr = neftDrMatch[4].trim().replace(/accounton$/i, '').replace(/account$/i, '');
    return {
      narration: `NEFT Payout: ${vendor}${branch ? ` (${branch})` : ''}`,
      refNo: utr,
      remitter: vendor
    };
  }

  // 4. "Reference Details: ..." section (Credits & Transfers)
  const refDetailsMatch = rawText.match(/Reference\s*Details\s*:\s*([\s\S]*?)(?=\n\s*(?:Available Balance|For real-time|Thank you|\n\n|$))/i);
  if (refDetailsMatch) {
    const refContent = refDetailsMatch[1].replace(/\r?\n\s*/g, " ").trim();

    // 4A. NEFT Cr / RTGS Cr / IMPS Cr: NEFT Cr-<IFSC>-<REMITTER>-<OUR_NAME>-<UTR>
    if (/^(?:NEFT|RTGS|IMPS)\s*Cr-/i.test(refContent)) {
      const parts = refContent.split('-').map(p => p.trim()).filter(Boolean);
      const remitter = parts[2] || '';
      const utr = parts.length >= 5 ? parts[4] : (parts.length === 4 ? parts[3] : parts[parts.length - 1]);
      return {
        narration: `NEFT: ${remitter}`,
        refNo: utr.replace(/[^A-Za-z0-9]/g, ''),
        remitter: remitter
      };
    }

    // 4B. Cheque Clearing: CHQ DEP - CTS CLG1 - WBO HYDERABAD
    if (/^CHQ\s*DEP/i.test(refContent)) {
      const parts = refContent.split('-').map(p => p.trim()).filter(Boolean);
      const clg = parts[1] || 'CTS CLG';
      const loc = parts[2] || '';
      return {
        narration: `Cheque Deposit (${clg}${loc ? ` - ${loc}` : ''})`,
        refNo: clg,
        remitter: `Cheque Clearing ${clg}`
      };
    }

    // 4C. Fund Transfer: FT - Cr - XXXXXXXXXX9944 - MALCON LIFE SCIENCES
    if (/^FT\s*-\s*Cr/i.test(refContent)) {
      const parts = refContent.split('-').map(p => p.trim()).filter(Boolean);
      const accOrRef = parts[2] || '';
      const remitter = parts[3] || parts[parts.length - 1] || '';
      return {
        narration: `FT: ${remitter}`,
        refNo: accOrRef.replace(/[^A-Za-z0-9]/g, ''),
        remitter: remitter
      };
    }

    // 4D. TPT format: XXXXXXXXXX2575-TPT-392-DOCTAZ HEALTH CARE PRIVATE LIMITED
    if (/TPT/i.test(refContent)) {
      const parts = refContent.split('-').map(p => p.trim()).filter(Boolean);
      const remitter = parts[parts.length - 1];
      const refPart = parts[0];
      return {
        narration: `TPT: ${remitter}`,
        refNo: refPart,
        remitter: remitter
      };
    }

    // 4E. Reverse format: SRI RAJA RAJESHWARI ORTHO PLUS Cr - XXXXXXXXXX2022 - HORIZON MEDICAL SUPPLIES
    if (/sri\s*raja\s*rajeshwari|srr\s*ortho/i.test(refContent)) {
      const parts = refContent.split('-').map(p => p.trim()).filter(Boolean);
      const lastPart = parts[parts.length - 1];
      const midPart = parts.length > 2 ? parts[1] : '';
      return {
        narration: `NEFT: ${lastPart}`,
        refNo: midPart.replace(/[^A-Za-z0-9]/g, ''),
        remitter: lastPart
      };
    }
  }

  // 5. Fallback generic
  return {
    narration: fallback || (isCredit ? "HDFC Bank Credit Alert" : "HDFC Bank Debit Alert"),
    refNo: ""
  };
}

async function backfill6569() {
  console.log("Starting safe 6569 transaction backfill in Firestore...");

  // 1. Authenticate with Firebase REST API
  const authRes = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDuK5kOP_WsiFTgMQE7B2qyYaAPDwdi_hY", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "hivamshikrishna@gmail.com",
      password: "Cnx@$02081994",
      returnSecureToken: true,
    }),
  });
  const authData = await authRes.json();
  if (!authData.idToken) {
    console.error("Auth failed:", authData);
    process.exit(1);
  }
  const idToken = authData.idToken;

  // 2. Fetch all bank_transactions
  const url = "https://firestore.googleapis.com/v1/projects/srrorthodc-antigravity/databases/(default)/documents/bank_transactions?pageSize=300";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json();
  if (!data.documents) {
    console.error("No documents found:", data);
    process.exit(1);
  }

  // 3. Filter for Account 6569 transactions
  const txDocs = data.documents.filter((doc) => {
    const f = doc.fields || {};
    const suffix = f.accountSuffix ? f.accountSuffix.stringValue : "";
    const accId = f.accountId ? f.accountId.stringValue : "";
    const desc = f.description ? f.description.stringValue : "";
    return suffix === "6569" || accId.includes("6569") || accId.includes("eja1") || desc.includes("6569");
  });

  console.log(`Found ${txDocs.length} Account 6569 transactions to check & update.\n`);

  let updatedCount = 0;

  for (const doc of txDocs) {
    const f = doc.fields || {};
    const docId = doc.name.split("/").pop();
    const rawBody = f.rawEmailBody ? f.rawEmailBody.stringValue : "";
    const currentDesc = f.description ? f.description.stringValue : "";
    const currentRef = f.referenceNumber ? f.referenceNumber.stringValue : "";
    const isCredit = f.type ? f.type.stringValue === "credit" : false;

    if (!rawBody) {
      console.log(`Skipping ${docId} (no rawEmailBody stored)`);
      continue;
    }

    const parsed = extract6569Details(rawBody, isCredit, currentDesc);

    const newDesc = parsed.narration && parsed.narration !== "HDFC Bank Credit Alert" && parsed.narration !== "HDFC Bank Debit Alert" ? parsed.narration : currentDesc;
    const newRef = parsed.refNo || currentRef;
    const newRemitter = parsed.remitter || (f.linkedCustomerName ? f.linkedCustomerName.stringValue : undefined);

    const hasChanged = newDesc !== currentDesc || (parsed.refNo && parsed.refNo !== currentRef);

    if (hasChanged) {
      console.log(`Updating ${docId}:`);
      console.log(`  Desc: "${currentDesc}" -> "${newDesc}"`);
      console.log(`  Ref:  "${currentRef}" -> "${newRef}"`);
      if (newRemitter) console.log(`  Remitter / Hospital: "${newRemitter}"`);

      // Prepare patch fields
      const patchFields = {
        description: { stringValue: newDesc },
        referenceNumber: { stringValue: newRef },
        updatedAt: { integerValue: String(Date.now()) },
      };
      if (newRemitter && isCredit) {
        patchFields.linkedCustomerName = { stringValue: newRemitter };
        patchFields.linkedHospital = { stringValue: newRemitter };
      }

      const updateMaskParams = Object.keys(patchFields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
      const patchUrl = `https://firestore.googleapis.com/v1/projects/srrorthodc-antigravity/databases/(default)/documents/bank_transactions/${docId}?${updateMaskParams}`;

      const patchRes = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: patchFields }),
      });

      if (patchRes.ok) {
        updatedCount++;
        console.log(`  ✅ Successfully updated in Firestore.\n`);
      } else {
        const errText = await patchRes.text();
        console.error(`  ❌ Failed to update ${docId}:`, errText);
      }
    } else {
      console.log(`No change needed for ${docId}: "${currentDesc}"`);
    }
  }

  console.log(`\n🎉 Backfill complete! Successfully updated ${updatedCount} transactions.`);
}

backfill6569().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
