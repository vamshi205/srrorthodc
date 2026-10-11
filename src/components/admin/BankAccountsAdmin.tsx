import React, { useState, useEffect, useMemo } from 'react';
import {
  BankAccount,
  BankTransaction,
  fetchBankAccountsFromFirestore,
  saveBankAccountToFirestore,
  deleteBankAccountFromFirestore,
  fetchBankTransactionsFromFirestore,
  LedgerDisplayConfig,
  getLedgerDisplayConfig,
  saveLedgerDisplayConfig,
  fetchLedgerDisplayConfigFromFirestore,
} from '@/services/bankAccountFirebaseService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Landmark,
  Wallet,
  Plus,
  Building2,
  RefreshCw,
  MoreVertical,
  Edit,
  Trash2,
  Sparkles,
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  PieChart,
  SlidersHorizontal,
  Calendar,
  Check,
} from 'lucide-react';
import { DailyExpenseTab } from '@/components/bank-accounts/DailyExpenseTab';

export const BankAccountsAdmin: React.FC = () => {
  const [activeAdminTab, setActiveAdminTab] = useState<'accounts' | 'analytics'>('accounts');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Account modal states
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<BankAccount | null>(null);

  // Form states
  const [accName, setAccName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branch, setBranch] = useState('');
  const [accType, setAccType] = useState<'current' | 'savings' | 'cash_in_hand'>('current');
  const [upiId, setUpiId] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [colorTheme, setColorTheme] = useState('teal');
  const [isDefault, setIsDefault] = useState(false);
  const [notes, setNotes] = useState('');

  // Auto assign state
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  // Ledger Display & 6569 Rules State
  const [ledgerConfig, setLedgerConfig] = useState<LedgerDisplayConfig>(getLedgerDisplayConfig);
  const [customDaysInput, setCustomDaysInput] = useState<string>(() => {
    const cfg = getLedgerDisplayConfig();
    return cfg.customDays ? String(cfg.customDays) : '10';
  });
  const [customLimitInput, setCustomLimitInput] = useState<string>(() => {
    const cfg = getLedgerDisplayConfig();
    return cfg.customLimit ? String(cfg.customLimit) : (typeof cfg.defaultLimit === 'number' ? String(cfg.defaultLimit) : '10');
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const handleSaveLedgerConfig = async (override?: Partial<LedgerDisplayConfig>) => {
    setIsSavingConfig(true);
    try {
      const activeDefaultLimit = override?.defaultLimit !== undefined ? override.defaultLimit : ledgerConfig.defaultLimit;
      const targetDays = override?.customDays !== undefined
        ? override.customDays
        : (customDaysInput.trim() ? Number(customDaysInput) : 10);
      const targetLimit = override?.customLimit !== undefined
        ? override.customLimit
        : (typeof activeDefaultLimit === 'number'
            ? activeDefaultLimit
            : (customLimitInput.trim() ? Number(customLimitInput) : 10));

      const updated: LedgerDisplayConfig = {
        ...ledgerConfig,
        customDays: targetDays,
        customLimit: targetLimit,
        ...(override || {}),
      };

      // Clear session unlock so new settings take effect immediately
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('srrortho:unlocked_acc_6569');
      }

      await saveLedgerDisplayConfig(updated);
      setLedgerConfig(updated);
      toast.success('Saved Ledger & Account 6569 display rules!');
    } catch (e) {
      toast.error('Failed to save display rules');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [accs, txs, cfg] = await Promise.all([
        fetchBankAccountsFromFirestore(),
        fetchBankTransactionsFromFirestore(),
        fetchLedgerDisplayConfigFromFirestore(),
      ]);
      setAccounts(accs);
      setTransactions(txs);
      if (cfg) {
        setLedgerConfig(cfg);
        if (cfg.customDays) setCustomDaysInput(String(cfg.customDays));
        if (cfg.customLimit) setCustomLimitInput(String(cfg.customLimit));
      }
    } catch (err) {
      console.error('Error loading bank accounts:', err);
      toast.error('Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute live balances
  const accountBalances = useMemo(() => {
    const balances: Record<string, { balance: number; totalCredits: number; totalDebits: number; count: number }> = {};
    accounts.forEach((acc) => {
      balances[acc.id] = {
        balance: acc.openingBalance || 0,
        totalCredits: 0,
        totalDebits: 0,
        count: 0,
      };
    });

    transactions.forEach((tx) => {
      let targetAccId = tx.accountId;
      if (!targetAccId && tx.accountSuffix) {
        const matched = accounts.find((a) => (a.accountNumber || '').endsWith(tx.accountSuffix!));
        if (matched) targetAccId = matched.id;
      }

      if (targetAccId && balances[targetAccId]) {
        if (tx.type === 'credit') {
          balances[targetAccId].balance += tx.amount;
          balances[targetAccId].totalCredits += tx.amount;
        } else {
          balances[targetAccId].balance -= tx.amount;
          balances[targetAccId].totalDebits += tx.amount;
        }
        balances[targetAccId].count++;
      }
    });

    return balances;
  }, [accounts, transactions]);

  // Handle open add modal
  const handleOpenAdd = () => {
    setAccName('');
    setBankName('HDFC Bank');
    setAccNumber('');
    setIfscCode('HDFC0001234');
    setBranch('Hyderabad');
    setAccType('current');
    setUpiId('');
    setOpeningBalance(0);
    setColorTheme('teal');
    setIsDefault(false);
    setNotes('');
    setIsAddAccountOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (acc: BankAccount) => {
    setAccountToEdit(acc);
    setAccName(acc.accountName);
    setBankName(acc.bankName);
    setAccNumber(acc.accountNumber);
    setIfscCode(acc.ifscCode || '');
    setBranch(acc.branch || '');
    setAccType(acc.accountType);
    setUpiId(acc.upiId || '');
    setOpeningBalance(acc.openingBalance || 0);
    setColorTheme(acc.colorTheme || 'teal');
    setIsDefault(acc.isDefault || false);
    setNotes(acc.notes || '');
    setIsEditAccountOpen(true);
  };

  // Save new account
  const handleSaveNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      toast.error('Please enter an account name');
      return;
    }

    const newAcc: BankAccount = {
      id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      accountName: accName.trim(),
      bankName: bankName.trim() || 'Bank',
      accountNumber: accNumber.trim() || '0000000000',
      ifscCode: ifscCode.trim(),
      branch: branch.trim(),
      accountType: accType,
      upiId: upiId.trim(),
      openingBalance: Number(openingBalance) || 0,
      colorTheme,
      isDefault,
      notes: notes.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await saveBankAccountToFirestore(newAcc);
      toast.success(`Bank account "${newAcc.accountName}" added!`);
      setIsAddAccountOpen(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save bank account');
    }
  };

  // Update existing account
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountToEdit || !accName.trim()) return;

    const updated: BankAccount = {
      ...accountToEdit,
      accountName: accName.trim(),
      bankName: bankName.trim(),
      accountNumber: accNumber.trim(),
      ifscCode: ifscCode.trim(),
      branch: branch.trim(),
      accountType: accType,
      upiId: upiId.trim(),
      openingBalance: Number(openingBalance) || 0,
      colorTheme,
      isDefault,
      notes: notes.trim(),
      updatedAt: Date.now(),
    };

    try {
      await saveBankAccountToFirestore(updated);
      toast.success(`Updated "${updated.accountName}"`);
      setIsEditAccountOpen(false);
      loadData();
    } catch (err) {
      toast.error('Failed to update bank account');
    }
  };

  // Delete account
  const handleDeleteAccount = async (acc: BankAccount) => {
    if (!confirm(`Are you sure you want to delete "${acc.accountName}"?`)) return;
    try {
      await deleteBankAccountFromFirestore(acc.id);
      toast.success(`Deleted "${acc.accountName}"`);
      loadData();
    } catch (err) {
      toast.error('Failed to delete bank account');
    }
  };

  // Auto assign existing transactions
  const handleAutoAssign = async () => {
    setIsAutoAssigning(true);
    toast.info('Auto-assigning transactions to accounts by account suffix...');
    try {
      let updatedCount = 0;
      for (const tx of transactions) {
        if (!tx.accountId) {
          const suffix = tx.accountSuffix || (tx.description && tx.description.includes('6569') ? '6569' : tx.description && tx.description.includes('1538') ? '1538' : null);
          if (suffix) {
            const matched = accounts.find((a) => (a.accountNumber || '').endsWith(suffix) || a.accountName.includes(suffix));
            if (matched) {
              tx.accountId = matched.id;
              updatedCount++;
            }
          }
        }
      }
      toast.success(`Auto-assigned ${updatedCount} transactions!`);
      loadData();
    } catch (err) {
      toast.error('Error auto-assigning transactions');
    } finally {
      setIsAutoAssigning(false);
    }
  };

  return (
    <div className="w-full py-2 space-y-5 font-sans text-foreground bg-transparent">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/95 p-4 sm:p-5 rounded-2xl border border-border shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shadow-2xs">
              <Building2 className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold font-sans tracking-tight text-foreground">
                Bank Accounts &amp; Treasury Management
              </h1>
              <p className="text-xs text-muted-foreground">
                Configure HDFC business accounts, savings UPI handles, petty cash counters, and opening balances.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Sub-Tabs: Bank Accounts vs Expense Analytics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex h-11 items-center gap-1 rounded-xl border border-border bg-muted p-1 shadow-2xs w-fit">
          <button
            onClick={() => setActiveAdminTab('accounts')}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeAdminTab === 'accounts'
                ? 'bg-card text-teal-800 shadow-2xs font-bold border border-teal-200'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
          >
            <Building2 className="w-4 h-4 text-teal-600" />
            <span>Bank Accounts &amp; Balances</span>
            {accounts.length > 0 && (
              <Badge className="ml-1 h-5 px-1.5 text-[10px] font-bold rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                {accounts.length}
              </Badge>
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('analytics')}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeAdminTab === 'analytics'
                ? 'bg-card text-teal-800 shadow-2xs font-bold border border-teal-200'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
          >
            <PieChart className="w-4 h-4 text-teal-600" />
            <span>Daily Expense Analytics</span>
          </button>
        </div>

        {activeAdminTab === 'accounts' && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={isAutoAssigning || transactions.length === 0}
              onClick={handleAutoAssign}
              className="h-9 text-xs font-semibold text-teal-800 bg-teal-50 border-teal-200 hover:bg-teal-100 shadow-2xs gap-1.5"
              title="Auto-detect account suffixes and assign transactions"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>{isAutoAssigning ? 'Assigning...' : 'Auto-Assign'}</span>
            </Button>

            <Button
              size="sm"
              onClick={handleOpenAdd}
              className="h-9 px-3.5 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-xs gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Bank Account
            </Button>
          </div>
        )}
      </div>

      {/* Account Cards Grid */}
      {activeAdminTab === 'accounts' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground bg-card rounded-xl border border-border">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
          <p className="text-xs font-semibold">Loading configured bank accounts...</p>
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-300 p-8 text-center rounded-2xl bg-card shadow-xs">
          <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-foreground font-sans">No Bank Accounts Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            Add your primary accounts (e.g. <strong>SRR Ortho Main (6569)</strong>, <strong>Savings / UPI (1538)</strong>, or <strong>Petty Cash</strong>) to start tracking transactions.
          </p>
          <Button onClick={handleOpenAdd} className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> + Add Your First Bank Account
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const stats = accountBalances[acc.id] || { balance: acc.openingBalance || 0, totalCredits: 0, totalDebits: 0, count: 0 };

            return (
              <Card key={acc.id} className="border border-border shadow-xs rounded-xl overflow-hidden bg-card hover:border-slate-300 transition-all">
                <CardHeader className="p-4 pb-3 bg-muted/80 border-b border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold">
                        {acc.accountType === 'cash_in_hand' ? <Wallet className="w-4 h-4 text-emerald-600" /> : <Landmark className="w-4 h-4 text-teal-700" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <CardTitle className="text-sm font-bold text-foreground">{acc.accountName}</CardTitle>
                          {acc.isDefault && (
                            <Badge variant="outline" className="text-[10px] font-semibold bg-teal-50 text-teal-800 border-teal-200 py-0 px-1.5">
                              Default
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs text-muted-foreground">{acc.bankName}</CardDescription>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem onClick={() => handleOpenEdit(acc)} className="text-xs">
                          <Edit className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteAccount(acc)} className="text-xs text-rose-600 focus:text-rose-700">
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3 bg-card">
                  <div className="text-xs space-y-1.5 text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Account Number:</span>
                      <span className="font-mono font-bold text-foreground">
                        {acc.accountNumber.length > 8
                          ? `•••${acc.accountNumber.slice(-4)}`
                          : acc.accountNumber || '—'}
                      </span>
                    </div>

                    {acc.ifscCode && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">IFSC Code:</span>
                        <span className="font-mono text-foreground">{acc.ifscCode}</span>
                      </div>
                    )}

                    {acc.upiId && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">UPI Handle:</span>
                        <span className="font-mono text-teal-700 font-semibold">{acc.upiId}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Opening Balance:</span>
                      <span className="font-mono text-foreground">₹{(acc.openingBalance || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Calculated Balance Highlight */}
                  <div className="p-3 bg-muted rounded-xl border border-border flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Current Ledger Balance
                      </div>
                      <div className="text-base font-extrabold font-mono text-teal-800 mt-0.5">
                        ₹{stats.balance.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground">
                      <div>Credits: <strong className="text-emerald-700">₹{stats.totalCredits.toLocaleString('en-IN')}</strong></div>
                      <div>Debits: <strong className="text-rose-600">₹{stats.totalDebits.toLocaleString('en-IN')}</strong></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ledger & Account 6569 Display Configuration Card */}
          <Card className="border border-border bg-card rounded-xl shadow-xs overflow-hidden mt-2">
            <CardHeader className="p-4 pb-3 bg-muted border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
                    <SlidersHorizontal className="w-4 h-4 text-teal-700" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">
                      Account 6569 &amp; Ledger Transaction Display Rules
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Configure default transaction count caps (credits &amp; debits combined cannot exceed this number) and date period presets.
                    </CardDescription>
                  </div>
                </div>
                <Badge className="bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-bold w-fit">
                  Security &amp; Performance
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Transaction Unlock Rule for Account 6569 */}
                <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      Account 6569 Unlocked Transaction Rule
                    </Label>
                    <Badge variant="outline" className="text-[10px] bg-card border-teal-300 text-teal-800 font-bold">
                      {ledgerConfig.unlockRule === 'count'
                        ? (ledgerConfig.defaultLimit === 'custom' ? `Last ${customLimitInput} Txns` : `Last ${ledgerConfig.defaultLimit} Txns`)
                        : ledgerConfig.unlockRule === 'this_month'
                        ? 'This Month'
                        : ledgerConfig.unlockRule === 'last_month'
                        ? 'Last Month'
                        : ledgerConfig.unlockRule === 'this_week'
                        ? 'This Week'
                        : ledgerConfig.unlockRule === 'last_week'
                        ? 'Last Week'
                        : `Past ${customDaysInput || 10} Days`}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    For Account 6569, transactions inside this rule stay unlocked. All older transactions are blurred with an admin unlock button.
                  </p>

                  {/* Quick Preset Buttons (Transaction Count) */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">By Transaction Count (Instant Save):</span>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLedgerConfig((prev) => ({ ...prev, unlockRule: 'count', defaultLimit: 10, customLimit: 10 }));
                          setCustomLimitInput('10');
                          handleSaveLedgerConfig({ unlockRule: 'count', defaultLimit: 10, customLimit: 10 });
                        }}
                        className={`h-7 px-2 text-[11px] font-bold rounded cursor-pointer ${
                          ledgerConfig.unlockRule === 'count' && (ledgerConfig.defaultLimit === 10 || (ledgerConfig.defaultLimit === 'custom' && customLimitInput === '10'))
                            ? 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800 hover:text-white'
                            : 'bg-card text-teal-800 hover:bg-teal-50 border-teal-300'
                        }`}
                      >
                        ⭐ Last 10 Txns
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLedgerConfig((prev) => ({ ...prev, unlockRule: 'count', defaultLimit: 15, customLimit: 15 }));
                          setCustomLimitInput('15');
                          handleSaveLedgerConfig({ unlockRule: 'count', defaultLimit: 15, customLimit: 15 });
                        }}
                        className={`h-7 px-2 text-[11px] font-bold rounded cursor-pointer ${
                          ledgerConfig.unlockRule === 'count' && ledgerConfig.defaultLimit === 15
                            ? 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800 hover:text-white'
                            : 'bg-card text-foreground hover:bg-muted border-slate-300'
                        }`}
                      >
                        15 Txns
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLedgerConfig((prev) => ({ ...prev, unlockRule: 'count', defaultLimit: 20, customLimit: 20 }));
                          setCustomLimitInput('20');
                          handleSaveLedgerConfig({ unlockRule: 'count', defaultLimit: 20, customLimit: 20 });
                        }}
                        className={`h-7 px-2 text-[11px] font-bold rounded cursor-pointer ${
                          ledgerConfig.unlockRule === 'count' && ledgerConfig.defaultLimit === 20
                            ? 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800 hover:text-white'
                            : 'bg-card text-foreground hover:bg-muted border-slate-300'
                        }`}
                      >
                        20 Txns
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLedgerConfig((prev) => ({ ...prev, unlockRule: 'count', defaultLimit: 30, customLimit: 30 }));
                          setCustomLimitInput('30');
                          handleSaveLedgerConfig({ unlockRule: 'count', defaultLimit: 30, customLimit: 30 });
                        }}
                        className={`h-7 px-2 text-[11px] font-bold rounded cursor-pointer ${
                          ledgerConfig.unlockRule === 'count' && ledgerConfig.defaultLimit === 30
                            ? 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800 hover:text-white'
                            : 'bg-card text-foreground hover:bg-muted border-slate-300'
                        }`}
                      >
                        30 Txns
                      </Button>
                    </div>
                  </div>

                  {/* Quick Preset Buttons (Days Window) */}
                  <div className="space-y-1 pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">By Days Window:</span>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLedgerConfig((prev) => ({ ...prev, unlockRule: 'custom_days', customDays: 10 }));
                          setCustomDaysInput('10');
                          handleSaveLedgerConfig({ unlockRule: 'custom_days', customDays: 10 });
                        }}
                        className={`h-7 px-2 text-[11px] font-bold rounded cursor-pointer ${
                          ledgerConfig.unlockRule === 'custom_days' && (customDaysInput === '10' || ledgerConfig.customDays === 10)
                            ? 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800 hover:text-white'
                            : 'bg-card text-foreground hover:bg-muted border-slate-300'
                        }`}
                      >
                        10 Days
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLedgerConfig((prev) => ({ ...prev, unlockRule: 'custom_days', customDays: 7 }));
                          setCustomDaysInput('7');
                          handleSaveLedgerConfig({ unlockRule: 'custom_days', customDays: 7 });
                        }}
                        className={`h-7 px-2 text-[11px] font-bold rounded cursor-pointer ${
                          ledgerConfig.unlockRule === 'custom_days' && (customDaysInput === '7' || ledgerConfig.customDays === 7)
                            ? 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800 hover:text-white'
                            : 'bg-card text-foreground hover:bg-muted border-slate-300'
                        }`}
                      >
                        7 Days
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLedgerConfig((prev) => ({ ...prev, unlockRule: 'custom_days', customDays: 15 }));
                          setCustomDaysInput('15');
                          handleSaveLedgerConfig({ unlockRule: 'custom_days', customDays: 15 });
                        }}
                        className={`h-7 px-2 text-[11px] font-bold rounded cursor-pointer ${
                          ledgerConfig.unlockRule === 'custom_days' && (customDaysInput === '15' || ledgerConfig.customDays === 15)
                            ? 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800 hover:text-white'
                            : 'bg-card text-foreground hover:bg-muted border-slate-300'
                        }`}
                      >
                        15 Days
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLedgerConfig((prev) => ({ ...prev, unlockRule: 'custom_days', customDays: 30 }));
                          setCustomDaysInput('30');
                          handleSaveLedgerConfig({ unlockRule: 'custom_days', customDays: 30 });
                        }}
                        className={`h-7 px-2 text-[11px] font-bold rounded cursor-pointer ${
                          ledgerConfig.unlockRule === 'custom_days' && (customDaysInput === '30' || ledgerConfig.customDays === 30)
                            ? 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800 hover:text-white'
                            : 'bg-card text-foreground hover:bg-muted border-slate-300'
                        }`}
                      >
                        30 Days
                      </Button>
                    </div>
                  </div>

                  <div className="pt-1.5">
                    <Label className="text-[11px] font-semibold text-foreground">Select Rule Type:</Label>
                    <Select
                      value={ledgerConfig.unlockRule || 'count'}
                      onValueChange={(val: any) => {
                        const targetLimit = customLimitInput.trim() ? Number(customLimitInput) : 10;
                        const targetDays = customDaysInput.trim() ? Number(customDaysInput) : 10;
                        setLedgerConfig((prev) => ({ ...prev, unlockRule: val, customLimit: targetLimit, customDays: targetDays }));
                        handleSaveLedgerConfig({ unlockRule: val, customLimit: targetLimit, customDays: targetDays });
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs bg-card border-border font-semibold mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="count">By Transaction Count (e.g. Last 10, 20, 30...)</SelectItem>
                        <SelectItem value="custom_days">By Days Window (e.g. 10 Days / Custom)</SelectItem>
                        <SelectItem value="this_month">This Month (Current Month Transactions)</SelectItem>
                        <SelectItem value="last_month">Last Month (Previous Month Transactions)</SelectItem>
                        <SelectItem value="this_week">This Week (Last 7 Days)</SelectItem>
                        <SelectItem value="last_week">Last Week (Past 7-14 Days)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* If Count selected, configure transaction count */}
                  {ledgerConfig.unlockRule === 'count' && (
                    <div className="pt-2 space-y-1.5 border-t border-border mt-2">
                      <Label className="text-[11px] font-semibold text-foreground">Unlocked Transaction Count:</Label>
                      <Select
                        value={String(ledgerConfig.defaultLimit)}
                        onValueChange={(val) => {
                          const parsed = val === 'all' || val === 'custom' ? (val as any) : Number(val);
                          const targetLimit = typeof parsed === 'number' ? parsed : (customLimitInput.trim() ? Number(customLimitInput) : 10);
                          setLedgerConfig((prev) => ({ ...prev, defaultLimit: parsed, customLimit: targetLimit }));
                          handleSaveLedgerConfig({ unlockRule: 'count', defaultLimit: parsed, customLimit: targetLimit });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-card border-border font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="10">⭐ Last 10 Transactions (Recommended)</SelectItem>
                          <SelectItem value="15">Last 15 Transactions</SelectItem>
                          <SelectItem value="20">Last 20 Transactions</SelectItem>
                          <SelectItem value="30">Last 30 Transactions</SelectItem>
                          <SelectItem value="50">Last 50 Transactions</SelectItem>
                          <SelectItem value="100">Last 100 Transactions</SelectItem>
                          <SelectItem value="custom">Custom Count...</SelectItem>
                          <SelectItem value="all">Unlock All Transactions</SelectItem>
                        </SelectContent>
                      </Select>

                      {ledgerConfig.defaultLimit === 'custom' && (
                        <div className="pt-1.5 flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-[10px] text-muted-foreground font-semibold">Custom Transaction Count:</Label>
                            <Input
                              type="number"
                              min="1"
                              max="500"
                              value={customLimitInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomLimitInput(val);
                                if (val && Number(val) > 0) {
                                  setLedgerConfig((prev) => ({ ...prev, customLimit: Number(val) }));
                                }
                              }}
                              placeholder="e.g. 10"
                              className="h-8 text-xs bg-card border-border mt-0.5"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const num = customLimitInput.trim() ? Number(customLimitInput) : 10;
                              setLedgerConfig((prev) => ({ ...prev, unlockRule: 'count', defaultLimit: 'custom', customLimit: num }));
                              handleSaveLedgerConfig({ unlockRule: 'count', defaultLimit: 'custom', customLimit: num });
                            }}
                            className="h-8 px-3 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded cursor-pointer"
                          >
                            Apply & Save
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* If Custom Days selected */}
                  {ledgerConfig.unlockRule === 'custom_days' && (
                    <div className="pt-2 border-t border-border mt-2 space-y-1.5">
                      <Label className="text-[11px] font-semibold text-foreground">Days to Look Back (Unlocked Window):</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          value={customDaysInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomDaysInput(val);
                            if (val && Number(val) > 0) {
                              setLedgerConfig((prev) => ({ ...prev, customDays: Number(val) }));
                            }
                          }}
                          placeholder="e.g. 10"
                          className="h-8 text-xs bg-card border-border w-28"
                        />
                        <span className="text-xs text-muted-foreground font-medium">days</span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const num = customDaysInput.trim() ? Number(customDaysInput) : 10;
                            setLedgerConfig((prev) => ({ ...prev, unlockRule: 'custom_days', customDays: num }));
                            handleSaveLedgerConfig({ unlockRule: 'custom_days', customDays: num });
                          }}
                          className="h-8 px-3 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded cursor-pointer"
                        >
                          Apply & Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Ledger Default Date Range Filter Preset */}
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      Ledger Statement Date Range Preset
                    </Label>
                    <Badge variant="outline" className="text-[10px] bg-card border-slate-300 text-foreground font-semibold">
                      <Calendar className="w-3 h-3 mr-1 text-muted-foreground" />
                      {ledgerConfig.defaultDateRange.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Preset date range filter applied to general ledger view on startup.
                  </p>
                  <div className="pt-1">
                    <Select
                      value={ledgerConfig.defaultDateRange}
                      onValueChange={(val: any) => setLedgerConfig((prev) => ({ ...prev, defaultDateRange: val }))}
                    >
                      <SelectTrigger className="h-9 text-xs bg-card border-border font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="all">All Dates / All Time</SelectItem>
                        <SelectItem value="this_week">This Week</SelectItem>
                        <SelectItem value="last_week">Last Week</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="last_month">Last Month</SelectItem>
                        <SelectItem value="year">This Year ({new Date().getFullYear()})</SelectItem>
                        <SelectItem value="custom_days">Custom Days Window...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-2.5 rounded-md bg-card border border-border text-[11px] text-muted-foreground space-y-1 mt-2">
                    <div className="font-semibold text-foreground">Account 1538 Policy:</div>
                    <div>Account 1538 statements remain completely accessible and normal. Only the ledger balance is locked by default.</div>
                  </div>
                </div>
              </div>

              {/* Scope Toggle & Save Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-teal-50/60 border border-teal-200/80">
                <div className="flex items-center gap-2.5">
                  <Switch
                    id="apply-6569-only"
                    checked={ledgerConfig.applyOnlyTo6569}
                    onCheckedChange={(checked) => setLedgerConfig((prev) => ({ ...prev, applyOnlyTo6569: checked }))}
                  />
                  <div>
                    <Label htmlFor="apply-6569-only" className="text-xs font-bold text-foreground cursor-pointer">
                      Target HDFC Main (6569) Exclusively
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Row blur and lock only applies to 6569 transactions. Account 1538 &amp; Cash transactions are always visible.
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  disabled={isSavingConfig}
                  onClick={handleSaveLedgerConfig}
                  className="h-8 px-4 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-xs shrink-0 gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingConfig ? 'Saving...' : 'Save Display Rules'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daily Expense Analytics Tab */}
      {activeAdminTab === 'analytics' && (
        <div className="w-full">
          <DailyExpenseTab
            transactions={transactions}
            accounts={accounts}
            onRefresh={loadData}
            isUnlocked={true}
          />
        </div>
      )}

      {/* Add Account Modal */}
      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border p-6 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Plus className="w-5 h-5 text-teal-700" /> Add Bank Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create an account or cash counter to categorize incoming payments and debit payouts.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveNewAccount} className="space-y-3.5 pt-2">
            <div>
              <Label className="text-xs font-semibold text-foreground">Account Display Name *</Label>
              <Input
                placeholder="e.g. SRR Ortho Main (6569)"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                className="h-9 text-xs mt-1 bg-card border-border"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">Bank Name</Label>
                <Input
                  placeholder="e.g. HDFC Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="h-9 text-xs mt-1 bg-card border-border"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">Account Type</Label>
                <Select value={accType} onValueChange={(v: any) => setAccType(v)}>
                  <SelectTrigger className="h-9 text-xs mt-1 bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="current">Current A/c</SelectItem>
                    <SelectItem value="savings">Savings A/c</SelectItem>
                    <SelectItem value="cash_in_hand">Cash in Hand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">Account Number</Label>
                <Input
                  placeholder="e.g. 50200000006569"
                  value={accNumber}
                  onChange={(e) => setAccNumber(e.target.value)}
                  className="h-9 text-xs mt-1 font-mono bg-card border-border"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">IFSC Code</Label>
                <Input
                  placeholder="HDFC0001234"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className="h-9 text-xs mt-1 font-mono uppercase bg-card border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">UPI Handle</Label>
                <Input
                  placeholder="e.g. srrmain@hdfcbank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="h-9 text-xs mt-1 bg-card border-border"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">Opening Balance (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  className="h-9 text-xs mt-1 font-mono bg-card border-border"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddAccountOpen(false)} className="h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-9 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white">
                Save Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Account Modal */}
      <Dialog open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border p-6 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Edit className="w-5 h-5 text-teal-700" /> Edit Bank Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update account details, UPI ID, or initial opening balance.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateAccount} className="space-y-3.5 pt-2">
            <div>
              <Label className="text-xs font-semibold text-foreground">Account Display Name *</Label>
              <Input
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                className="h-9 text-xs mt-1 bg-card border-border"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">Bank Name</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="h-9 text-xs mt-1 bg-card border-border"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">Account Type</Label>
                <Select value={accType} onValueChange={(v: any) => setAccType(v)}>
                  <SelectTrigger className="h-9 text-xs mt-1 bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="current">Current A/c</SelectItem>
                    <SelectItem value="savings">Savings A/c</SelectItem>
                    <SelectItem value="cash_in_hand">Cash in Hand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">Account Number</Label>
                <Input
                  value={accNumber}
                  onChange={(e) => setAccNumber(e.target.value)}
                  className="h-9 text-xs mt-1 font-mono bg-card border-border"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">IFSC Code</Label>
                <Input
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className="h-9 text-xs mt-1 font-mono uppercase bg-card border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">UPI Handle</Label>
                <Input
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="h-9 text-xs mt-1 bg-card border-border"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">Opening Balance (₹)</Label>
                <Input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  className="h-9 text-xs mt-1 font-mono bg-card border-border"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditAccountOpen(false)} className="h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-9 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white">
                Update Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
