import React, { useState, useEffect } from "react";
import {
  Bell,
  Wallet,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Clock,
  Check,
  RotateCcw as ResetIcon,
  ShieldCheck,
  Eye,
  AlertCircle,
  History,
  Trash2,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  getNotificationConfig,
  saveNotificationConfig,
  DEFAULT_NOTIFICATION_CONFIG,
  type NotificationConfig,
} from "@/lib/notificationConfig";
import {
  getReminderAuditLogs,
  clearReminderAuditLogs,
  type ReminderAuditEntry,
} from "@/lib/notificationAudit";

interface NotificationSettingsAdminProps {
  onPreviewLoginPopup?: () => void;
}

export const NotificationSettingsAdmin: React.FC<NotificationSettingsAdminProps> = ({
  onPreviewLoginPopup,
}) => {
  const { toast } = useToast();
  const [config, setConfig] = useState<NotificationConfig>(getNotificationConfig);
  const [isSaved, setIsSaved] = useState(false);
  const [auditLogs, setAuditLogs] = useState<ReminderAuditEntry[]>(getReminderAuditLogs);

  useEffect(() => {
    setConfig(getNotificationConfig());
    setAuditLogs(getReminderAuditLogs());

    const handleAuditUpdate = () => {
      setAuditLogs(getReminderAuditLogs());
    };
    window.addEventListener("srrortho:reminder_audit_updated", handleAuditUpdate);
    return () => {
      window.removeEventListener("srrortho:reminder_audit_updated", handleAuditUpdate);
    };
  }, []);

  const handleClearAudit = () => {
    clearReminderAuditLogs();
    setAuditLogs([]);
    toast({
      title: "Audit Log Cleared",
      description: "All reminder history logs have been removed.",
    });
  };

  const handleSave = () => {
    saveNotificationConfig(config);
    setIsSaved(true);
    toast({
      title: "Settings Saved",
      description: "DC Tracker notification & reminder settings have been updated across the portal.",
    });
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_NOTIFICATION_CONFIG });
    saveNotificationConfig({ ...DEFAULT_NOTIFICATION_CONFIG });
    toast({
      title: "Reset to Defaults",
      description: "Notification preferences reset to factory defaults (4h payments, 2d return cutoff).",
    });
  };

  const testAudioChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      toast({ title: "Sound Test", description: "Played reminder notification chime." });
    } catch {
      toast({ title: "Audio Blocked", description: "Browser prevented audio autoplay." });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            Notifications & Reminder Customization
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure automated interval frequencies, cutoffs, login alert popups, and chime rules for DC Tracker.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-8 text-xs gap-1.5 border-slate-300"
          >
            <ResetIcon className="w-3.5 h-3.5" />
            Reset Defaults
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            className={`h-8 text-xs font-bold gap-1.5 shadow-sm transition-all ${
              isSaved
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-teal-700 hover:bg-teal-800 text-white"
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            {isSaved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Visibility Master Controls */}
        <Card className="rounded-2xl border-2 border-teal-500/30 dark:border-teal-500/20 shadow-md bg-gradient-to-r from-teal-50/50 via-white to-amber-50/30 dark:from-slate-900/90 dark:via-slate-900 dark:to-teal-950/20 backdrop-blur-md md:col-span-2">
          <CardHeader className="p-4 pb-3 border-b border-teal-100/60 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black shadow-sm">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Reminder Categories &amp; Visibility Controls
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Show or hide reminder categories across the entire portal (bell badge, tabs, scroller &amp; popups).
                  </CardDescription>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-950 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800 self-start sm:self-auto">
                Toggle to Show or Hide
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Category 1: Cash / Collect Payments */}
            <div className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between gap-3 ${
              config.paymentReminderEnabled 
                ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs" 
                : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-70"
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    config.paymentReminderEnabled ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                  }`}>
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      Cash / Payments
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Cash queue &amp; invoice dues
                    </div>
                  </div>
                </div>
                <Switch
                  checked={config.paymentReminderEnabled}
                  onCheckedChange={(val) => setConfig({ ...config, paymentReminderEnabled: val })}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px]">
                <span className="text-muted-foreground">Status:</span>
                {config.paymentReminderEnabled ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-5 px-1.5 font-bold">
                    Visible &amp; Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 border-slate-300 dark:border-slate-700 text-[10px] h-5 px-1.5">
                    Hidden Everywhere
                  </Badge>
                )}
              </div>
            </div>

            {/* Category 2: Returns */}
            <div className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between gap-3 ${
              config.returnReminderEnabled 
                ? "border-cyan-500/40 bg-cyan-50/40 dark:bg-cyan-950/20 shadow-xs" 
                : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-70"
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    config.returnReminderEnabled ? "bg-cyan-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                  }`}>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      Item Returns
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Dispatched surgery sets
                    </div>
                  </div>
                </div>
                <Switch
                  checked={config.returnReminderEnabled}
                  onCheckedChange={(val) => setConfig({ ...config, returnReminderEnabled: val })}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px]">
                <span className="text-muted-foreground">Status:</span>
                {config.returnReminderEnabled ? (
                  <Badge className="bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] h-5 px-1.5 font-bold">
                    Visible &amp; Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 border-slate-300 dark:border-slate-700 text-[10px] h-5 px-1.5">
                    Hidden Everywhere
                  </Badge>
                )}
              </div>
            </div>

            {/* Category 3: Invoices */}
            <div className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between gap-3 ${
              config.invoiceReminderEnabled 
                ? "border-purple-500/40 bg-purple-50/40 dark:bg-purple-950/20 shadow-xs" 
                : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-70"
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    config.invoiceReminderEnabled ? "bg-purple-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                  }`}>
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      Returned Invoices
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Sets awaiting cash memo
                    </div>
                  </div>
                </div>
                <Switch
                  checked={config.invoiceReminderEnabled}
                  onCheckedChange={(val) => setConfig({ ...config, invoiceReminderEnabled: val })}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px]">
                <span className="text-muted-foreground">Status:</span>
                {config.invoiceReminderEnabled ? (
                  <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] h-5 px-1.5 font-bold">
                    Visible &amp; Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 border-slate-300 dark:border-slate-700 text-[10px] h-5 px-1.5">
                    Hidden Everywhere
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 1: Payment Reminders */}
        <Card className="rounded-2xl border-border/60 shadow-sm bg-white/70 dark:bg-slate-900/70 backdrop-blur-md">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold">Collect Payment Reminders</CardTitle>
                  <CardDescription className="text-xs">
                    Alerts for Cash Queue memos and unpaid Cash Invoices
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={config.paymentReminderEnabled}
                onCheckedChange={(val) => setConfig({ ...config, paymentReminderEnabled: val })}
              />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Reminder Interval (High Weightage)
              </Label>
              <Select
                value={String(config.paymentIntervalHours)}
                onValueChange={(val) =>
                  setConfig({ ...config, paymentIntervalHours: Number(val) })
                }
                disabled={!config.paymentReminderEnabled}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Every 2 Hours</SelectItem>
                  <SelectItem value="4">Every 4 Hours (Recommended)</SelectItem>
                  <SelectItem value="6">Every 6 Hours</SelectItem>
                  <SelectItem value="8">Every 8 Hours</SelectItem>
                  <SelectItem value="12">Every 12 Hours</SelectItem>
                  <SelectItem value="24">Once Daily (24 Hours)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                How often the recurring popup/toast triggers if unpaid cash memos exist.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Minimum Alert Balance (₹)
              </Label>
              <Input
                type="number"
                min={0}
                step={500}
                value={config.minPaymentAlertAmount}
                onChange={(e) =>
                  setConfig({ ...config, minPaymentAlertAmount: Number(e.target.value) || 0 })
                }
                placeholder="0 (Alert on all amounts)"
                disabled={!config.paymentReminderEnabled}
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Set 0 to alert on any pending amount, or set a minimum amount threshold.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Item Returns Reminders */}
        <Card className="rounded-2xl border-border/60 shadow-sm bg-white/70 dark:bg-slate-900/70 backdrop-blur-md">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold">Item Return Reminders</CardTitle>
                  <CardDescription className="text-xs">
                    Follow-ups for dispatched surgery sets &amp; implants
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={config.returnReminderEnabled}
                onCheckedChange={(val) => setConfig({ ...config, returnReminderEnabled: val })}
              />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Default Return Cutoff Threshold (Days)
              </Label>
              <Select
                value={String(config.returnCutoffDays)}
                onValueChange={(val) => setConfig({ ...config, returnCutoffDays: Number(val) })}
                disabled={!config.returnReminderEnabled}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select cutoff days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Day Out</SelectItem>
                  <SelectItem value="2">2 Days Out (Default)</SelectItem>
                  <SelectItem value="3">3 Days Out</SelectItem>
                  <SelectItem value="5">5 Days Out</SelectItem>
                  <SelectItem value="7">7 Days Out</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                DCs with items dispatched for this many days or more will be flagged for return.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Urgent Red Overdue Mark (Days)
              </Label>
              <Select
                value={String(config.returnUrgentDays)}
                onValueChange={(val) => setConfig({ ...config, returnUrgentDays: Number(val) })}
                disabled={!config.returnReminderEnabled}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select urgent days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 Days (Strict)</SelectItem>
                  <SelectItem value="3">3 Days (Default)</SelectItem>
                  <SelectItem value="4">4 Days</SelectItem>
                  <SelectItem value="5">5 Days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                DCs past this number of days will show with an Urgent red badge in notifications.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: First Login Reminder Popup */}
        <Card className="rounded-2xl border-amber-300/70 dark:border-amber-900/60 shadow-md bg-amber-50/20 dark:bg-amber-950/10 backdrop-blur-md md:col-span-2">
          <CardHeader className="p-4 pb-3 border-b border-amber-200/50 dark:border-amber-900/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    First Login / Morning Reminder Popup
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Show a welcoming pending action popup modal when logging in or starting the day
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem("srrortho_last_login_popup_date");
                    sessionStorage.removeItem("srrortho_seen_login_popup");
                    window.location.href = "/saved?test_popup=1";
                  }}
                  className="h-7 text-xs border-amber-400/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 gap-1 font-semibold"
                >
                  <Eye className="w-3 h-3" /> Test Live on DC Tracker
                </Button>
                <Switch
                  checked={config.firstLoginPopupEnabled}
                  onCheckedChange={(val) => setConfig({ ...config, firstLoginPopupEnabled: val })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Include Payments
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Cash memos awaiting payment
                  </div>
                </div>
                <Switch
                  checked={config.firstLoginIncludePayments}
                  onCheckedChange={(val) =>
                    setConfig({ ...config, firstLoginIncludePayments: val })
                  }
                  disabled={!config.firstLoginPopupEnabled}
                />
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Include Returns
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    DCs out ≥ {config.returnCutoffDays} days
                  </div>
                </div>
                <Switch
                  checked={config.firstLoginIncludeReturns}
                  onCheckedChange={(val) => setConfig({ ...config, firstLoginIncludeReturns: val })}
                  disabled={!config.firstLoginPopupEnabled}
                />
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Include Invoices
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Returned awaiting memo
                  </div>
                </div>
                <Switch
                  checked={config.firstLoginIncludeInvoices}
                  onCheckedChange={(val) => setConfig({ ...config, firstLoginIncludeInvoices: val })}
                  disabled={!config.firstLoginPopupEnabled}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 When enabled, user will see a rich modal upon first logging in each day with total pending amounts, counts, and 1-click links to collect payments or inspect items.
            </p>
          </CardContent>
        </Card>

        {/* Section 4: Sound & Banner Display */}
        <Card className="rounded-2xl border-border/60 shadow-sm bg-white/70 dark:bg-slate-900/70 backdrop-blur-md md:col-span-2">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold">Audio &amp; Toast Behavior</CardTitle>
                  <CardDescription className="text-xs">
                    Configure sound notifications and banner persistence
                  </CardDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={testAudioChime}
                className="h-7 text-xs gap-1"
              >
                <Volume2 className="w-3 h-3" /> Test Chime
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Audio Chimes
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Play gentle Web Audio chime when a reminder fires
                </p>
              </div>
              <Switch
                checked={config.soundEnabled}
                onCheckedChange={(val) => setConfig({ ...config, soundEnabled: val })}
              />
            </div>

            <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Banner Auto-Dismiss
              </Label>
              <Select
                value={String(config.bannerAutoDismissSeconds)}
                onValueChange={(val) =>
                  setConfig({ ...config, bannerAutoDismissSeconds: Number(val) })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Auto-dismiss timer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Stay until manually closed (Default)</SelectItem>
                  <SelectItem value="8">After 8 Seconds</SelectItem>
                  <SelectItem value="15">After 15 Seconds</SelectItem>
                  <SelectItem value="30">After 30 Seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Reminder & Snooze Audit Trail */}
        <Card className="rounded-2xl border-border/60 shadow-sm bg-white/70 dark:bg-slate-900/70 backdrop-blur-md md:col-span-2">
          <CardHeader className="p-4 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold">Reminder &amp; Snooze Audit Trail</CardTitle>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200">
                      {auditLogs.length} Events
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Maintains transparent records of reminders shown, snooze durations selected (15m / 1h / Tomorrow), and staff click-throughs
                  </CardDescription>
                </div>
              </div>

              {auditLogs.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAudit}
                  className="h-7 text-xs text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 gap-1.5 self-start sm:self-auto"
                >
                  <Trash2 className="w-3 h-3" /> Clear Audit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  No reminder actions or snoozes logged yet
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  When morning login popups appear, staff choose &quot;Remind Later (15m, 1h, Tomorrow)&quot;, or click to collect/return, a permanent audit trail entry will be recorded here.
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 rounded-xl">
                {auditLogs.map((log) => {
                  let badgeStyle = "bg-slate-100 text-slate-800 border-slate-200";
                  if (log.action.includes("SNOOZE")) {
                    badgeStyle = log.action === "SNOOZE_15M"
                      ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                      : log.action === "SNOOZE_1H"
                      ? "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300"
                      : "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300";
                  } else if (log.action === "POPUP_SHOWN") {
                    badgeStyle = "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300";
                  } else if (log.action === "COLLECT_CLICK") {
                    badgeStyle = "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300";
                  } else if (log.action === "RETURN_CLICK") {
                    badgeStyle = "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300";
                  }

                  const formattedDate = (() => {
                    try {
                      return new Date(log.timestamp).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      });
                    } catch {
                      return log.timestamp;
                    }
                  })();

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={`text-[10px] font-bold py-0.5 px-2 ${badgeStyle}`}>
                            {log.label}
                          </Badge>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {formattedDate}
                          </span>
                          <Badge variant="secondary" className="text-[10px] font-normal text-slate-600 dark:text-slate-300 py-0 px-1.5">
                            By: {log.userEmail}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                          {log.details}
                        </p>
                      </div>

                      {log.pendingAmount > 0 && (
                        <div className="text-right shrink-0 self-end sm:self-center">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Pending</span>
                          <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                            ₹{log.pendingAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          size="sm"
          onClick={handleSave}
          className={`h-9 px-5 text-xs font-bold gap-1.5 shadow-md ${
            isSaved
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-teal-700 hover:bg-teal-800 text-white"
          }`}
        >
          <Check className="w-4 h-4" />
          {isSaved ? "Saved Successfully!" : "Save Notification Preferences"}
        </Button>
      </div>
    </div>
  );
};
