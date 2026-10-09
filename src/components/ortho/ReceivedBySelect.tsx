import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Store, User } from "lucide-react";

interface ReceivedBySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
}

export const ReceivedBySelect: React.FC<ReceivedBySelectProps> = ({
  value,
  onChange,
  className = "",
  id,
}) => {
  // Parse preset mode and optional person name from value string
  const isVendorMode = value.startsWith("Vendor at Office");
  const isHospitalMode = value === "Hospital Delivery" || (!isVendorMode && value !== "");

  // Extract optional person name if value is formatted like "Vendor at Office (John)" or custom text
  const vendorPersonName = isVendorMode ? value.replace(/^Vendor at Office\s*(\((.*?)\))?$/, "$2").trim() : "";

  const handleSelectMode = (mode: "hospital" | "vendor") => {
    if (mode === "hospital") {
      onChange("Hospital Delivery");
    } else {
      onChange("Vendor at Office");
    }
  };

  const handlePersonNameChange = (name: string) => {
    if (name.trim()) {
      onChange(`Vendor at Office (${name.trim()})`);
    } else {
      onChange("Vendor at Office");
    }
  };

  return (
    <div className={`space-y-2 ${className}`} id={id}>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleSelectMode("hospital")}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
            isHospitalMode && value.includes("Hospital Delivery")
              ? "bg-teal-50 border-teal-500 text-teal-800 dark:bg-teal-950/60 dark:border-teal-600 dark:text-teal-200"
              : "bg-background border-input text-muted-foreground hover:bg-accent"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-teal-600" />
          <span>Hospital Delivery</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectMode("vendor")}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
            isVendorMode
              ? "bg-purple-50 border-purple-500 text-purple-800 dark:bg-purple-950/60 dark:border-purple-600 dark:text-purple-200"
              : "bg-background border-input text-muted-foreground hover:bg-accent"
          }`}
        >
          <Store className="w-3.5 h-3.5 text-purple-600" />
          <span>Vendor at Office</span>
        </button>
      </div>

      {isVendorMode && (
        <div className="space-y-1 animate-in fade-in-50 duration-150">
          <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <User className="w-3 h-3 text-purple-600" />
            Vendor Person Name (Optional)
          </Label>
          <Input
            value={vendorPersonName}
            onChange={(e) => handlePersonNameChange(e.target.value)}
            placeholder="e.g. Rahul / Sai Traders"
            className="h-8 text-xs bg-white dark:bg-slate-950"
          />
        </div>
      )}

      {!isHospitalMode && !isVendorMode && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Recipient Name / Staff"
          className="h-9 text-xs"
        />
      )}
    </div>
  );
};
