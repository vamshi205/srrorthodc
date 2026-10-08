const fs = require('fs');

let content = fs.readFileSync('src/pages/SavedDcs.tsx', 'utf8');

const oldHandleSavePayment = `    setIsActionLoading(true);
    try {
      setLoadingDcIds((prev) => new Set(prev).add(dc.id));

      const bankAccountId = matchedBankTx?.accountId;
      const bankName = matchedBankTx?.description || "Bank Account";
      const utrNo = matchedBankTx?.referenceNumber || matchedBankTx?.id;

      const existingPartPayments = dc.partPayments || [];
      const newInstallmentEntry = {
        at: new Date().toISOString(),
        amount: currentInstallment,
        paymentMethod,
        collectedBy:
          paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
        utrNo: matchedBankTx?.referenceNumber || matchedBankTx?.id,
        remarks: paymentRemarksInput.trim() || undefined,
      };
      const updatedPartPayments = [
        ...existingPartPayments,
        newInstallmentEntry,
      ];

      await transitionSavedDc(dc.id, {
        toStatus: nextStatus,
        action:
          nextStatus === "completed"
            ? "MOVE_CASH_TO_COMPLETED"
            : "MOVE_TO_CASH",
        updates: {
          cashAmount: originalInvoiceTotal,
          paidAmount,
          originalInvoiceTotal,
          isPartialPayment,
          hospitalMargin: margin,
          paymentMethod,
          collectedBy:
            paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
          paidAt: new Date().toISOString(),
          cashRemarks: finalRemarks,
          partPayments: updatedPartPayments,
          ...(matchedBankTx
            ? {
                bankAccountId,
                bankName,
                utrNo,
              }
            : {}),
        },
        meta: {
          paidAt: new Date().toISOString(),
          paidAmount,
          originalInvoiceTotal,
          isPartialPayment,
          paymentMethod,
          collectedBy:
            paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
          billedAmount: dc.billedAmount,
          hospitalMargin: margin,
          partPayments: updatedPartPayments,
          remarks: finalRemarks,
          ...(matchedBankTx ? { bankAccountId, utrNo } : {}),
        },
      });

      // Link to Bank Transaction if matched
      if (matchedBankTx) {
        try {
          const mockInvoice: CashInvoiceData = {
            invNumber: dc.invoiceRef || \`DC #\${dc.dcNo}\`,
            dcNumber: dc.dcNo,
            clientName: dc.hospitalName,
            grandTotal: paidAmount,
            status: "Paid",
            paymentReceived: paidAmount,
            savedAt: Date.now(),
          };
          await linkBankTransactionToCashInvoice(
            matchedBankTx.id,
            mockInvoice,
            true,
          );
        } catch (e) {
          console.error("Failed to link bank transaction on DC pay modal:", e);
        }
      } else if (paymentMethod === "cash") {
        try {
          await recordCashPaymentToCashInHand(
            dc,
            paidAmount,
            paymentCollectedBy,
            finalRemarks,
          );
        } catch (e) {
          console.error(
            "Failed to record cash transaction in Cash In Hand account:",
            e,
          );
        }
      }

      // Sync payment status to Firestore Cash Invoice
      if (dc.invoiceRef || dc.dcNo) {
        try {
          const invoices = await fetchCashInvoicesFromFirestore();
          const match = invoices.find(
            (inv) =>
              (dc.invoiceRef && inv.invNumber === dc.invoiceRef) ||
              (dc.dcNo && inv.dcNumber === dc.dcNo),
          );
          if (match) {
            match.paymentReceived = paidAmount;
            match.status = "Paid";
            await saveCashInvoiceToFirestore(match);
          }
        } catch (e) {
          console.error(
            "Failed to sync payment status to Firestore cash invoice:",
            e,
          );
        }
      }

      setSavedDcs((prev) =>
        prev.map((d) =>
          d.id === dc.id
            ? {
                ...d,
                status: nextStatus,
                cashAmount: paidAmount,
                paymentMethod,
                collectedBy:
                  paymentMethod === "cash"
                    ? paymentCollectedBy.trim()
                    : undefined,
                paidAt: new Date().toISOString(),
                cashRemarks: finalRemarks,
                ...(matchedBankTx ? { bankAccountId, bankName, utrNo } : {}),
              }
            : d,
        ),
      );

      setSelectedDcId(dc.id);
      setDetailsDialogOpen(true);
      setActiveQueue(nextStatus);
      setSearchParams({ queue: nextStatus });

      const remainingBalance = Math.max(0, originalInvoiceTotal - paidAmount);
      const successDesc =
        nextStatus === "cash"
          ? \`Part payment of ₹\${currentInstallment.toLocaleString("en-IN")} recorded for DC #\${dc.dcNo}. Balance due: ₹\${remainingBalance.toLocaleString("en-IN")}. Updated in Cash Queue.\`
          : matchedBankTx
            ? \`DC #\${dc.dcNo} linked to Bank Credit (Ref: \${utrNo}) & moved to Completed!\`
            : \`DC #\${dc.dcNo} payment settled & moved to Completed!\`;

      toast({ title: "Payment Recorded", description: successDesc });
      setPaymentDialog({ open: false, dc: null });
      setPaymentAmountInput("");
      setPaymentRemarksInput("");
      setPaymentCollectedBy("");
      setPaymentMethod("cash");
      setSelectedCreditTxId("not_found");
    } catch (err) {
      toast({
        title: "Payment Failed",
        description:
          err instanceof Error ? err.message : "Failed to record payment.",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
      setLoadingDcIds((prev) => {
        const next = new Set(prev);
        next.delete(dc.id);
        return next;
      });
    }`;

const newHandleSavePayment = `    const isCash = paymentMethod === "cash";
    const isFullPay = nextStatus === "completed";
    const currentInstAmt = currentInstallment;

    setPaymentDialog({ open: false, dc: null });

    await runActionWithProgress({
      dcNo: dc.dcNo,
      title: isFullPay ? "Settling DC Payment" : "Recording Part Payment",
      targetQueueName: isFullPay ? "Completed" : "Cash Queue",
      targetQueueKey: nextStatus,
      iconType: isCash ? "cash" : "save",
      initialMessage: isCash
        ? \`Recording physical cash collection of ₹\${currentInstAmt.toLocaleString("en-IN")} into Cash In Hand account...\`
        : \`Linking bank payment of ₹\${currentInstAmt.toLocaleString("en-IN")}...\`,
      successMessage: isFullPay
        ? \`Payment Received & DC #\${dc.dcNo} Settled Successfully! 💵\`
        : \`Part Payment of ₹\${currentInstAmt.toLocaleString("en-IN")} Recorded!\`,
      actionFn: async () => {
        setIsActionLoading(true);
        setLoadingDcIds((prev) => new Set(prev).add(dc.id));

        const bankAccountId = matchedBankTx?.accountId;
        const bankName = matchedBankTx?.description || "Bank Account";
        const utrNo = matchedBankTx?.referenceNumber || matchedBankTx?.id;

        const existingPartPayments = dc.partPayments || [];
        const newInstallmentEntry = {
          at: new Date().toISOString(),
          amount: currentInstAmt,
          paymentMethod,
          collectedBy:
            paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
          utrNo: matchedBankTx?.referenceNumber || matchedBankTx?.id,
          remarks: paymentRemarksInput.trim() || undefined,
        };
        const updatedPartPayments = [
          ...existingPartPayments,
          newInstallmentEntry,
        ];

        await transitionSavedDc(dc.id, {
          toStatus: nextStatus,
          action:
            nextStatus === "completed"
              ? "MOVE_CASH_TO_COMPLETED"
              : "MOVE_TO_CASH",
          updates: {
            cashAmount: originalInvoiceTotal,
            paidAmount,
            originalInvoiceTotal,
            isPartialPayment,
            hospitalMargin: margin,
            paymentMethod,
            collectedBy:
              paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
            paidAt: new Date().toISOString(),
            cashRemarks: finalRemarks,
            partPayments: updatedPartPayments,
            ...(matchedBankTx
              ? {
                  bankAccountId,
                  bankName,
                  utrNo,
                }
              : {}),
          },
          meta: {
            paidAt: new Date().toISOString(),
            paidAmount,
            originalInvoiceTotal,
            isPartialPayment,
            paymentMethod,
            collectedBy:
              paymentMethod === "cash" ? paymentCollectedBy.trim() : undefined,
            billedAmount: dc.billedAmount,
            hospitalMargin: margin,
            partPayments: updatedPartPayments,
            remarks: finalRemarks,
            ...(matchedBankTx ? { bankAccountId, utrNo } : {}),
          },
        });

        // Link to Bank Transaction if matched
        if (matchedBankTx) {
          try {
            const mockInvoice: CashInvoiceData = {
              invNumber: dc.invoiceRef || \`DC #\${dc.dcNo}\`,
              dcNumber: dc.dcNo,
              clientName: dc.hospitalName,
              grandTotal: paidAmount,
              status: "Paid",
              paymentReceived: paidAmount,
              savedAt: Date.now(),
            };
            await linkBankTransactionToCashInvoice(
              matchedBankTx.id,
              mockInvoice,
              true,
            );
          } catch (e) {
            console.error("Failed to link bank transaction on DC pay modal:", e);
          }
        } else if (paymentMethod === "cash") {
          try {
            await recordCashPaymentToCashInHand(
              dc,
              paidAmount,
              paymentCollectedBy,
              finalRemarks,
            );
          } catch (e) {
            console.error(
              "Failed to record cash transaction in Cash In Hand account:",
              e,
            );
          }
        }

        // Sync payment status to Firestore Cash Invoice
        if (dc.invoiceRef || dc.dcNo) {
          try {
            const invoices = await fetchCashInvoicesFromFirestore();
            const match = invoices.find(
              (inv) =>
                (dc.invoiceRef && inv.invNumber === dc.invoiceRef) ||
                (dc.dcNo && inv.dcNumber === dc.dcNo),
            );
            if (match) {
              match.paymentReceived = paidAmount;
              match.status = "Paid";
              await saveCashInvoiceToFirestore(match);
            }
          } catch (e) {
            console.error(
              "Failed to sync payment status to Firestore cash invoice:",
              e,
            );
          }
        }

        const freshDcs = await loadSavedDcs();
        setSavedDcs(freshDcs);
        setSelectedDcId(dc.id);
        setDetailsDialogOpen(true);

        setPaymentAmountInput("");
        setPaymentRemarksInput("");
        setPaymentCollectedBy("");
        setPaymentMethod("cash");
        setSelectedCreditTxId("not_found");
        setIsActionLoading(false);
        setLoadingDcIds((prev) => {
          const next = new Set(prev);
          next.delete(dc.id);
          return next;
        });
      },
    });`;

if (content.includes('setIsActionLoading(true);')) {
  content = content.replace(oldHandleSavePayment, newHandleSavePayment);
  fs.writeFileSync('src/pages/SavedDcs.tsx', content, 'utf8');
  console.log('SavedDcs.tsx handleSavePayment updated with runActionWithProgress!');
} else {
  console.log('Target string for handleSavePayment not found!');
}
