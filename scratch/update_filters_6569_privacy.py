import re

filepath = r"c:\Users\Admin\Documents\srrprojects\orthodc\srrorthodc\src\components\bank-accounts\BankAccountsView.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Replace all account select item renders with lock indicator when locked
code = re.sub(
    r'(<SelectItem\s+key=\{acc\.id\}\s+value=\{acc\.id\}>\s*)\{acc\.accountName\}(\s*</SelectItem>)',
    r'\1{isAccount6569(acc) && !is6569Unlocked ? "🔒 " + acc.accountName + " [Locked]" : acc.accountName}\2',
    code
)

code = re.sub(
    r'(<SelectItem\s+key=\{a\.id\}\s+value=\{a\.id\}>\s*)\{a\.accountName\}(\s*</SelectItem>)',
    r'\1{isAccount6569(a) && !is6569Unlocked ? "🔒 " + a.accountName + " [Locked]" : a.accountName}\2',
    code
)

# 2. Add Top Filter Lock Notification Banner when filtering 6569
banner_code = """
          {/* 🔒 6569 Filter Lock Alert Banner */}
          {isAccount6569(selectedAccountId) && !is6569Unlocked && (
            <div className="bg-amber-50/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
              <div className="flex items-center gap-2 font-semibold">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>HDFC Main (6569) account data is currently locked & blurred. Enter admin password to view amounts.</span>
              </div>
              <Button
                size="sm"
                onClick={() => setIs6569AuthDialogOpen(true)}
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg px-3 gap-1 shadow-xs cursor-pointer shrink-0"
              >
                <Lock className="w-3 h-3" /> Unlock Data
              </Button>
            </div>
          )}
"""

if "{/* Filter Pills Bar */}" in code and "6569 Filter Lock Alert Banner" not in code:
    code = code.replace("{/* Filter Pills Bar */}", banner_code + "\n          {/* Filter Pills Bar */}")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(code)

print("Updated filter dropdowns and filter lock banner in BankAccountsView.tsx!")
