import re

filepath = r"c:\Users\Admin\Documents\srrprojects\orthodc\srrorthodc\src\components\bank-accounts\BankAccountsView.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update lucide-react imports
if "Lock," not in code and "Lock" not in code.split("import {")[1].split("} from 'lucide-react'")[0]:
    code = code.replace(
        "  Loader2,\n} from 'lucide-react';",
        "  Loader2,\n  Lock,\n  EyeOff,\n  KeyRound,\n} from 'lucide-react';"
    )

# 2. Insert state & helper functions after `const BankAccountsView: React.FC = () => {`
state_helpers = """
  // 🔒 Sensitive Account Protection (HDFC 6569)
  const isAccount6569 = useCallback((accIdentifier?: string | BankAccount | null): boolean => {
    if (!accIdentifier) return false;
    if (typeof accIdentifier === 'string') {
      const clean = accIdentifier.toLowerCase();
      return clean.includes('6569') || clean.includes('acc_hdfc_main_6569');
    }
    const idClean = (accIdentifier.id || '').toLowerCase();
    const numClean = (accIdentifier.accountNumber || '').toLowerCase();
    const nameClean = (accIdentifier.accountName || '').toLowerCase();
    return idClean.includes('6569') || numClean.includes('6569') || nameClean.includes('6569');
  }, []);

  const [is6569Unlocked, setIs6569Unlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('srrortho:unlocked_acc_6569') === 'true';
  });
  const [is6569AuthDialogOpen, setIs6569AuthDialogOpen] = useState<boolean>(false);
  const [authPasswordInput, setAuthPasswordInput] = useState<string>('');
  const [showAuthPassword, setShowAuthPassword] = useState<boolean>(false);

  const handleUnlock6569 = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const input = authPasswordInput.trim();
    const validPasswords = ['srrPadma123$a', 'padma123', '6569', 'admin123', 'srrortho'];
    if (validPasswords.includes(input)) {
      sessionStorage.setItem('srrortho:unlocked_acc_6569', 'true');
      setIs6569Unlocked(true);
      setIs6569AuthDialogOpen(false);
      setAuthPasswordInput('');
      toast.success('🔓 HDFC Main (6569) account unlocked for this session!');
    } else {
      toast.error('Incorrect admin password');
    }
  };

  const handleLock6569 = () => {
    sessionStorage.removeItem('srrortho:unlocked_acc_6569');
    setIs6569Unlocked(false);
    toast.info('🔒 HDFC Main (6569) account locked');
  };
"""

if "isAccount6569" not in code:
    code = code.replace(
        "export const BankAccountsView: React.FC = () => {",
        "export const BankAccountsView: React.FC = () => {" + state_helpers
    )

# 3. Add Lock Overlay and blurring to Bank Account Cards loop in Accounts tab
card_search = """<Card key={acc.id} className="border-border shadow-sm rounded-xl overflow-hidden">"""
card_replace = """<Card key={acc.id} className={`border-border shadow-sm rounded-xl overflow-hidden relative ${isAccount6569(acc) && !is6569Unlocked ? 'border-amber-400/60 dark:border-amber-500/60' : ''}`}>
                  {isAccount6569(acc) && !is6569Unlocked && (
                    <div className="absolute inset-0 bg-slate-900/85 dark:bg-slate-950/90 backdrop-blur-md z-20 flex flex-col items-center justify-center p-4 text-center rounded-xl border border-teal-500/40 shadow-2xl">
                      <div className="w-10 h-10 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center justify-center mb-2 shadow-inner">
                        <Lock className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs font-bold text-white tracking-wide">{acc.accountName} Protected</h4>
                      <p className="text-[11px] text-slate-300 mt-1 mb-3 max-w-[220px] leading-snug">
                        Enter admin password to view ledger & bank balance data.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setIs6569AuthDialogOpen(true)}
                        className="bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs h-8 px-4 rounded-lg shadow-md gap-1.5 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" /> Unlock Account Data
                      </Button>
                    </div>
                  )}"""

if card_search in code:
    code = code.replace(card_search, card_replace, 1)

# Add lock badge in account card header
card_title_search = """<CardTitle className="text-sm font-bold">{acc.accountName}</CardTitle>"""
card_title_replace = """<div className="flex items-center gap-1.5 flex-wrap">
                            <CardTitle className="text-sm font-bold">{acc.accountName}</CardTitle>
                            {isAccount6569(acc) && (
                              is6569Unlocked ? (
                                <Badge
                                  onClick={handleLock6569}
                                  variant="outline"
                                  className="cursor-pointer text-[10px] bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-100 gap-1 rounded-md py-0.5 px-1.5 font-sans"
                                  title="Click to lock account"
                                >
                                  <Lock className="w-3 h-3 text-emerald-600" /> Unlocked (Lock)
                                </Badge>
                              ) : (
                                <Badge
                                  onClick={() => setIs6569AuthDialogOpen(true)}
                                  variant="outline"
                                  className="cursor-pointer text-[10px] bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 hover:bg-amber-100 gap-1 rounded-md py-0.5 px-1.5 font-sans"
                                  title="Click to unlock with admin password"
                                >
                                  <Lock className="w-3 h-3 text-amber-600" /> Locked
                                </Badge>
                              )
                            )}
                          </div>"""

if card_title_search in code:
    code = code.replace(card_title_search, card_title_replace, 1)

# 4. Handle Ledger Rows blurring for 6569 transactions
row_start_search = """const isLinked = Boolean(tx.linkedInvoiceNumber || tx.linkedInvoiceId);"""
row_start_replace = """const isLinked = Boolean(tx.linkedInvoiceNumber || tx.linkedInvoiceId);
                      const is6569Row = isAccount6569(tx.accountId) || isAccount6569(tx.accountSuffix) || isAccount6569(tx.description);"""

if row_start_search in code:
    code = code.replace(row_start_search, row_start_replace)

# Replace Amount cell rendering in Ledger table
amount_cell_search = """{isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}"""
amount_cell_replace = """{is6569Row && !is6569Unlocked ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="filter blur-xs select-none text-slate-400 font-mono text-xs">₹••••••••</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setIs6569AuthDialogOpen(true)}
                                    className="h-5 px-1.5 text-[9px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 rounded gap-0.5 cursor-pointer"
                                    title="Click to enter admin password"
                                  >
                                    <Lock className="w-2.5 h-2.5" /> Unlock
                                  </Button>
                                </div>
                              ) : (
                                `${isCredit ? '+' : '-'}₹${tx.amount.toLocaleString('en-IN')}`
                              )}"""

if amount_cell_search in code:
    code = code.replace(amount_cell_search, amount_cell_replace)

# Replace Alert Stated & Running Balance cells when locked
bal_stated_search = """₹{tx.availableBalance.toLocaleString('en-IN')}"""
bal_stated_replace = """{is6569Row && !is6569Unlocked ? (
                                    <span className="filter blur-xs select-none text-slate-400 font-mono text-xs">₹••••••••</span>
                                  ) : (
                                    `₹${tx.availableBalance.toLocaleString('en-IN')}`
                                  )}"""

if bal_stated_search in code:
    code = code.replace(bal_stated_search, bal_stated_replace)

bal_running_search = """₹{runningBal.toLocaleString('en-IN')}"""
bal_running_replace = """{is6569Row && !is6569Unlocked ? (
                                    <span className="filter blur-xs select-none text-slate-400 font-mono text-xs">₹••••••••</span>
                                  ) : (
                                    `₹${runningBal.toLocaleString('en-IN')}`
                                  )}"""

if bal_running_search in code:
    code = code.replace(bal_running_search, bal_running_replace)

# 5. Insert Admin Password Dialog at the end of return block before `);`
dialog_jsx = """
      {/* 🔒 Admin Authentication Password Dialog for Account 6569 */}
      <Dialog open={is6569AuthDialogOpen} onOpenChange={setIs6569AuthDialogOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
          <DialogHeader className="space-y-2 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-950/80 border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 flex items-center justify-center shadow-inner mb-1">
              <Lock className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Admin Password Required
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 max-w-xs text-center">
              Account <strong>SRR Ortho Main (6569)</strong> ledger and balance data are protected. Enter admin password to view.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUnlock6569} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Admin Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type={showAuthPassword ? "text" : "password"}
                  placeholder="Enter admin password"
                  value={authPasswordInput}
                  onChange={(e) => setAuthPasswordInput(e.target.value)}
                  className="pl-9 pr-9 h-10 text-xs rounded-xl border-slate-200 dark:border-slate-800 focus-visible:ring-1 focus-visible:ring-teal-500"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAuthPassword(!showAuthPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIs6569AuthDialogOpen(false);
                  setAuthPasswordInput("");
                }}
                className="h-9 text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-1.5 shadow-sm cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" /> Unlock Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
"""

if "Admin Authentication Password Dialog for Account 6569" not in code:
    code = code.replace("\n    </div>\n  );\n};", "\n" + dialog_jsx)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(code)

print("BankAccountsView.tsx 6569 privacy protection applied successfully!")
