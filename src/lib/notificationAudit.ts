import { auth } from "@/firebase";

export interface ReminderAuditEntry {
  id: string;
  timestamp: string;
  action:
    | "POPUP_SHOWN"
    | "SNOOZE_15M"
    | "SNOOZE_1H"
    | "SNOOZE_TOMORROW"
    | "COLLECT_CLICK"
    | "RETURN_CLICK"
    | "DISMISSED";
  label: string;
  details: string;
  userEmail: string;
  pendingAmount: number;
  partiesCount: number;
  returnCount: number;
}

const AUDIT_STORAGE_KEY = "srrortho_reminder_audit_trail";
const MAX_AUDIT_ENTRIES = 100;

export function getReminderAuditLogs(): ReminderAuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logReminderAction(
  entry: Omit<ReminderAuditEntry, "id" | "timestamp" | "userEmail">
): void {
  try {
    const currentLogs = getReminderAuditLogs();
    const userEmail = auth?.currentUser?.email || "Staff User";
    const newEntry: ReminderAuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userEmail,
    };

    const updatedLogs = [newEntry, ...currentLogs].slice(0, MAX_AUDIT_ENTRIES);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updatedLogs));
    window.dispatchEvent(
      new CustomEvent("srrortho:reminder_audit_updated", { detail: updatedLogs })
    );
  } catch (err) {
    console.warn("Failed to log reminder audit action:", err);
  }
}

export function clearReminderAuditLogs(): void {
  try {
    localStorage.removeItem(AUDIT_STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent("srrortho:reminder_audit_updated", { detail: [] })
    );
  } catch (err) {
    console.warn("Failed to clear reminder audit logs:", err);
  }
}
