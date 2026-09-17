import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  Phone,
  Plus,
  Search,
  Sparkles,
  X,
  MapPin,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Customer,
  getSavedCustomers,
  saveCustomer,
  getAllHospitalNames,
  normalizeHospitalName,
  fetchUnifiedCustomers,
} from "@/lib/customerStorage";
import { loadSavedDcs, SavedDc } from "@/lib/savedDcStorage";
import { useToast } from "@/hooks/use-toast";

interface HospitalSelectProps {
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer?: (customer: Customer) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

export const HospitalSelect: React.FC<HospitalSelectProps> = ({
  value,
  onChange,
  onSelectCustomer,
  placeholder = "Search or enter hospital / clinic...",
  disabled = false,
  className = "",
  id,
  autoFocus = false,
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [customers, setCustomers] = useState<Customer[]>(getSavedCustomers);
  const [historicalNames, setHistoricalNames] = useState<string[]>([]);

  // On-the-fly quick add modal states
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load and subscribe to customer updates
  useEffect(() => {
    const updateList = () => {
      setCustomers(getSavedCustomers());
    };

    updateList();
    window.addEventListener("srrortho:customers_updated", updateList);

    // Background sync with Firestore
    fetchUnifiedCustomers()
      .then((unified) => setCustomers(unified))
      .catch((e) => console.error("Error syncing customers:", e));

    // Also harvest historical names from DCs
    loadSavedDcs()
      .then((dcs: SavedDc[]) => {
        const names = getAllHospitalNames(dcs);
        setHistoricalNames(names);
      })
      .catch((err) => console.error("Error loading historical DC hospital names:", err));

    return () => {
      window.removeEventListener("srrortho:customers_updated", updateList);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Combined suggestions
  const allSuggestions = useMemo(() => {
    const map = new Map<string, Customer>();

    // 1. Registered directory customers (higher priority)
    customers.forEach((c) => {
      const canonical = normalizeHospitalName(c.name);
      if (canonical) {
        map.set(canonical.toLowerCase(), {
          ...c,
          name: canonical,
        });
      }
    });

    // 2. Historical DC names not yet registered
    historicalNames.forEach((name) => {
      const canonical = normalizeHospitalName(name);
      if (!canonical) return;
      const key = canonical.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: `hist_${key}`,
          name: canonical,
          notes: "From DC History",
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Items with mobile or registered first, then alphabetical
      const aScore = (a.mobile ? 2 : 0) + (a.notes !== "From DC History" ? 1 : 0);
      const bScore = (b.mobile ? 2 : 0) + (b.notes !== "From DC History" ? 1 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    });
  }, [customers, historicalNames]);

  // Filter suggestions based on typed value
  const filteredSuggestions = useMemo(() => {
    const query = (value || "").trim().toLowerCase();
    if (!query) return allSuggestions.slice(0, 30);

    return allSuggestions
      .filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(query);
        const mobileMatch = item.mobile && item.mobile.toLowerCase().includes(query);
        const addressMatch = item.address && item.address.toLowerCase().includes(query);
        return nameMatch || mobileMatch || addressMatch;
      })
      .slice(0, 30);
  }, [allSuggestions, value]);

  // Check if current value exactly matches any suggestion
  const exactMatch = useMemo(() => {
    const trimmed = (value || "").trim().toLowerCase();
    if (!trimmed) return null;
    return allSuggestions.find((s) => s.name.toLowerCase() === trimmed) || null;
  }, [allSuggestions, value]);

  const handleSelect = (cust: Customer) => {
    onChange(cust.name);
    if (onSelectCustomer) onSelectCustomer(cust);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(filteredSuggestions.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
      }
    } else if (e.key === "Enter") {
      if (open && highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        e.preventDefault();
        handleSelect(filteredSuggestions[highlightedIndex]);
      } else if (open && !exactMatch && value?.trim()) {
        // Close on enter if something typed
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Keep highlighted item in view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      ) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  // Fast quick add directly without modal
  const handleQuickAdd = async (nameToAdd: string) => {
    const clean = normalizeHospitalName(nameToAdd);
    if (!clean) return;

    try {
      const saved = await saveCustomer({ name: clean, mobile: "" });
      onChange(saved.name);
      if (onSelectCustomer) onSelectCustomer(saved);
      setOpen(false);
      toast({
        title: "Hospital Added",
        description: `"${saved.name}" has been saved to customer directory.`,
      });
    } catch (e: any) {
      toast({
        title: "Could not add hospital",
        description: e.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  // Open the detail quick-add modal to enter mobile number on the fly
  const handleOpenQuickAddModal = (initialName: string) => {
    setNewName(initialName.trim());
    setNewMobile("");
    setNewAddress("");
    setNewContactPerson("");
    setOpen(false);
    setQuickAddModalOpen(true);
  };

  // Submit on-the-fly modal with mobile number
  const handleSaveModalCustomer = async () => {
    const clean = normalizeHospitalName(newName);
    if (!clean) {
      toast({
        title: "Name Required",
        description: "Please enter the hospital or customer name.",
        variant: "destructive",
      });
      return;
    }

    if (!newMobile.trim()) {
      toast({
        title: "Mobile Number Required",
        description: "Please provide a valid mobile number for cash invoices and reminders.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveCustomer({
        name: clean,
        mobile: newMobile.trim(),
        address: newAddress.trim(),
        contactPerson: newContactPerson.trim(),
      });

      onChange(saved.name);
      if (onSelectCustomer) onSelectCustomer(saved);
      setQuickAddModalOpen(false);

      toast({
        title: "Hospital Saved",
        description: `"${saved.name}" added with mobile ${saved.mobile}.`,
      });
    } catch (e: any) {
      toast({
        title: "Save Failed",
        description: e.message || "Failed to save hospital",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Autocomplete Input Container */}
      <div className="relative flex items-center">
        <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-teal-600 pointer-events-none shrink-0" />
        
        <Input
          ref={inputRef}
          id={id}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className="pl-8 pr-16 h-9 text-xs sm:text-sm font-semibold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:border-teal-600 focus:ring-teal-600 shadow-xs"
        />

        {/* Action icons on right */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Clear text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={open ? "Close suggestions" : "Browse all hospitals"}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                open ? "rotate-180 text-teal-600" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Floating Auto-complete Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[300px] sm:min-w-[380px] max-w-[500px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden text-xs animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Header Banner */}
          <div className="bg-slate-50 dark:bg-slate-950 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Search className="w-3 h-3 text-teal-600" />
              {value.trim() ? `Matching "${value.trim()}"` : "Saved Hospitals Directory"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {filteredSuggestions.length} found · ↑↓ to navigate
            </span>
          </div>

          {/* Quick On-the-Fly Add Banner when typing an unlisted hospital */}
          {value.trim() && !exactMatch && (
            <div className="p-2 bg-teal-50/70 dark:bg-teal-950/40 border-b border-teal-100 dark:border-teal-900/60 space-y-1.5">
              <div className="text-[11px] font-medium text-teal-950 dark:text-teal-200">
                Hospital not found in directory:
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => handleOpenQuickAddModal(value)}
                  className="h-7 text-xs bg-teal-700 hover:bg-teal-800 text-white font-bold gap-1 px-2.5 shadow-xs"
                >
                  <Phone className="w-3 h-3" />
                  Add with Mobile No.
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickAdd(value)}
                  className="h-7 text-xs border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-200 hover:bg-teal-100/60 font-semibold gap-1 px-2"
                >
                  <Plus className="w-3 h-3" />
                  Quick Save Name
                </Button>
              </div>
            </div>
          )}

          {/* Suggestions List */}
          <div ref={listRef} className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
            {filteredSuggestions.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">
                No hospitals matching "{value}". Click above to add it.
              </div>
            ) : (
              filteredSuggestions.map((item, idx) => {
                const isSelected = exactMatch?.name === item.name;
                const isHighlighted = highlightedIndex === idx;

                return (
                  <div
                    key={item.id || item.name}
                    data-index={idx}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      isHighlighted
                        ? "bg-teal-50 dark:bg-teal-950/60 text-slate-900 dark:text-white"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center shrink-0 text-teal-700 dark:text-teal-300">
                        {isSelected ? (
                          <Check className="w-3 h-3 font-bold" />
                        ) : (
                          <Building2 className="w-3 h-3" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.contactPerson && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                              ({item.contactPerson})
                            </span>
                          )}
                        </div>

                        {(item.mobile || item.address) && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2 truncate mt-0.5">
                            {item.mobile && (
                              <span className="flex items-center gap-0.5 text-teal-700 dark:text-teal-400 font-semibold">
                                <Phone className="w-2.5 h-2.5" />
                                {item.mobile}
                              </span>
                            )}
                            {item.address && (
                              <span className="flex items-center gap-0.5 truncate max-w-[170px]" title={item.address}>
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                {item.address}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 ml-2 flex items-center gap-1">
                      {item.notes === "From DC History" ? (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal"
                        >
                          <Clock className="w-2 h-2 mr-0.5" /> History
                        </Badge>
                      ) : item.mobile ? (
                        <Badge
                          className="text-[9.5px] px-1.5 py-0 h-4 bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border-0 font-semibold"
                        >
                          📱 Registered
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer action bar */}
          <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleOpenQuickAddModal(value || "")}
              className="text-[11px] font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3 h-3" />
              Register New Hospital / Customer
            </button>

            <span className="text-[10px] text-slate-400">
              Shared with Cash Invoices
            </span>
          </div>
        </div>
      )}

      {/* On-The-Fly Add Hospital with Mobile Number Modal */}
      <Dialog open={quickAddModalOpen} onOpenChange={setQuickAddModalOpen}>
        <DialogContent className="max-w-md border-2 border-teal-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <Building2 className="w-5 h-5 text-teal-600" />
              Add Hospital / Customer
            </DialogTitle>
            <DialogDescription className="text-xs">
              Save this hospital to your customer directory. It will be available for auto-complete in Delivery Challans and Cash Invoices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Hospital / Customer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Yashoda Hospital, Secunderabad"
                className="mt-1 h-9 text-xs"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-600" />
                Mobile Number <span className="text-red-500">*</span>
              </Label>
              <Input
                type="tel"
                value={newMobile}
                onChange={(e) => setNewMobile(e.target.value)}
                placeholder="e.g. 9848012345"
                className="mt-1 h-9 text-xs font-semibold"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Required for payment follow-ups, collection reminders &amp; WhatsApp invoicing.
              </p>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Doctor Name / Contact Person (Optional)
              </Label>
              <Input
                value={newContactPerson}
                onChange={(e) => setNewContactPerson(e.target.value)}
                placeholder="e.g. Dr. Ramesh / OT Store Incharge"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Address / Branch Location (Optional)
              </Label>
              <Input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="e.g. Somajiguda, Hyderabad"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickAddModalOpen(false)}
                disabled={isSaving}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSaving || !newName.trim() || !newMobile.trim()}
                onClick={handleSaveModalCustomer}
                className="h-8 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isSaving ? "Saving..." : "Save Hospital"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
