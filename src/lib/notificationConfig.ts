export interface NotificationConfig {
  paymentIntervalHours: number; // default 4
  paymentReminderEnabled: boolean; // default true
  minPaymentAlertAmount: number; // default 0

  returnCutoffDays: number; // default 2
  returnUrgentDays: number; // default 3
  returnAlertTiming: "daily" | "6h" | "12h"; // default 'daily'
  returnReminderEnabled: boolean; // default true

  firstLoginPopupEnabled: boolean; // default true
  firstLoginIncludePayments: boolean; // default true
  firstLoginIncludeReturns: boolean; // default true
  firstLoginIncludeInvoices: boolean; // default true

  soundEnabled: boolean; // default true
  bannerAutoDismissSeconds: number; // default 8 (0 = manual dismiss only)
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  paymentIntervalHours: 4,
  paymentReminderEnabled: true,
  minPaymentAlertAmount: 0,

  returnCutoffDays: 2,
  returnUrgentDays: 3,
  returnAlertTiming: "daily",
  returnReminderEnabled: true,

  firstLoginPopupEnabled: true,
  firstLoginIncludePayments: true,
  firstLoginIncludeReturns: true,
  firstLoginIncludeInvoices: true,

  soundEnabled: true,
  bannerAutoDismissSeconds: 8,
};

const STORAGE_KEY = "srrortho_notification_config";

export function getNotificationConfig(): NotificationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_NOTIFICATION_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_NOTIFICATION_CONFIG };
  }
}

export function saveNotificationConfig(config: NotificationConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("srrortho:notification_config_changed", { detail: config }));
  } catch (err) {
    console.error("Failed to save notification config:", err);
  }
}
