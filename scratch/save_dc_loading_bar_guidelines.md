# Save DC Loading Bar & Design System Guidelines

## 1. Save DC Transition Modal Design Standards

To ensure consistent user experience when saving a Delivery Challan across the portal, the transition loading overlay must **strictly match** the modal design used in **DC Tracker** (`SavedDcs.tsx`):

### Modal Specifications:
- **Container**:
  - `w-[90vw] max-w-[90vw] sm:max-w-[420px] max-h-[90vh] p-0 overflow-hidden`
  - `border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0 [&>button]:hidden`
- **Icon Tile**:
  - `mx-auto h-16 w-16 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-inner`
  - Spinning `<Loader2 className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin" />` during loading.
  - Bouncing `<CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-bounce" />` when progress reaches 100%.
- **Badge Pill**:
  - `<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">`
  - Displays `DC #<dcNo> → DC Tracker`.
- **Progress Bar**:
  - Outer: `<div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">`
  - Inner: `bg-gradient-to-r from-teal-500 via-indigo-500 to-amber-500` (changes to `bg-emerald-500` at 100% completion).
  - Smooth animation: `transition-all duration-700 ease-out`.
- **Duration**: Exactly **2 seconds** before navigating to `/saved`.

## 2. Step 1 (Hospital & Delivery Details) Design Principles

- Uses standard **shadcn** UI components (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`).
- Clean slate borders (`border-slate-200 dark:border-slate-800`).
- Crisp compact labels (`text-xs font-semibold text-slate-700 dark:text-slate-300`).
- No extraneous phone pills or contact info in the Hospital dropdown list (hospital name only).
