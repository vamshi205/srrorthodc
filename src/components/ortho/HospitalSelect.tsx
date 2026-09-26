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
  AlertCircle,
  Stethoscope,
  Smartphone,
  ShieldCheck,
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
import {
  findNearDuplicateHospital,
  DuplicateMatchResult,
} from "@/lib/hospitalDuplicateDetector";


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
  const [newContactRole, setNewContactRole] = useState<"OT Person" | "Accounts" | "Reception" | "Others" | "Doctor">("OT Person");
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

  // Canonical suggestions: Proper registered directory hospitals take priority.
  // Historical DC names are only included if not already covered by a registered customer.
  const allSuggestions = useMemo(() => {
    const map = new Map<string, Customer>();

    // 1. Registered directory customers (CANONICAL PROPER HOSPITALS)
    customers.forEach((c) => {
      const canonical = normalizeHospitalName(c.name);
      if (canonical) {
        map.set(canonical.toLowerCase(), {
          ...c,
          name: canonical,
        });
      }
    });

    // 2. Historical DC names: only include if it does NOT match any registered customer
    const registeredKeys = Array.from(map.keys());
    historicalNames.forEach((name) => {
      const canonical = normalizeHospitalName(name);
      if (!canonical) return;
      const key = canonical.toLowerCase();
      const cleanKey = key.replace(/[^a-z0-9]/g, "");

      const isCovered = registeredKeys.some((regKey) => {
        const cleanReg = regKey.replace(/[^a-z0-9]/g, "");
        return cleanReg === cleanKey || cleanReg.includes(cleanKey) || (cleanKey.length > 5 && cleanKey.includes(cleanReg));
      });

      if (!isCovered && !map.has(key)) {
        map.set(key, {
          id: `hist_${key}`,
          name: canonical,
          notes: "From DC History",
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Registered directory hospitals ALWAYS first
      const aIsReg = a.notes !== "From DC History";
      const bIsReg = b.notes !== "From DC History";
      if (aIsReg !== bIsReg) return aIsReg ? -1 : 1;

      // Has phone lines next
      const aHasPhone = Boolean(a.otNumber || a.hospitalNumber || a.personalNumber || a.mobile);
      const bHasPhone = Boolean(b.otNumber || b.hospitalNumber || b.personalNumber || b.mobile);
      if (aHasPhone !== bHasPhone) return aHasPhone ? -1 : 1;

      return a.name.localeCompare(b.name);
    });
  }, [customers, historicalNames]);

  // Filter suggestions with multi-token matching, address search, and phone lookup
  const filteredSuggestions = useMemo(() => {
    const rawQuery = (value || "").trim().toLowerCase();
    if (!rawQuery) return allSuggestions.slice(0, 30);

    const cleanQuery = rawQuery.replace(/[,\.\-\/]/g, " ");
    const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);

    return allSuggestions
      .filter((item) => {
        const nameLower = (item.name || "").toLowerCase();
        const cleanName = nameLower.replace(/[,\.\-\/]/g, " ");
        const addressLower = (item.address || "").toLowerCase();
        const contactPersonLower = (item.contactPerson || "").toLowerCase();
        const otDigits = (item.otNumber || "").replace(/\D/g, "");
        const hospDigits = (item.hospitalNumber || "").replace(/\D/g, "");
        const mobileDigits = (item.mobile || item.personalNumber || "").replace(/\D/g, "");
        const queryDigits = rawQuery.replace(/\D/g, "");

        // If numeric digits typed (>=3), match against phone numbers
        if (queryDigits.length >= 3) {
          if (otDigits.includes(queryDigits) || hospDigits.includes(queryDigits) || mobileDigits.includes(queryDigits)) {
            return true;
          }
        }

        // Token matching: every word in the query must match name, address, or contact person
        return queryTokens.every(
          (token) =>
            cleanName.includes(token) ||
            addressLower.includes(token) ||
            contactPersonLower.includes(token)
        );
      })
      .sort((a, b) => {
        const aNameLower = a.name.toLowerCase();
        const bNameLower = b.name.toLowerCase();

        // Exact match first
        if (aNameLower === rawQuery) return -1;
        if (bNameLower === rawQuery) return 1;

        // Starts with query next
        const aStarts = aNameLower.startsWith(rawQuery);
        const bStarts = bNameLower.startsWith(rawQuery);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;

        // Registered directory customer next
        const aIsReg = a.notes !== "From DC History";
        const bIsReg = b.notes !== "From DC History";
        if (aIsReg !== bIsReg) return aIsReg ? -1 : 1;

        return a.name.localeCompare(b.name);
      })
      .slice(0, 30);
  }, [allSuggestions, value]);

  // Check if current value exactly matches any suggestion
  const exactMatch = useMemo(() => {
    const trimmed = (value || "").trim().toLowerCase();
    if (!trimmed) return null;
    const clean = trimmed.replace(/[^a-z0-9]/g, "");
    return (
      allSuggestions.find((s) => s.name.toLowerCase() === trimmed) ||
      allSuggestions.find((s) => s.name.toLowerCase().replace(/[^a-z0-9]/g, "") === clean) ||
      null
    );
  }, [allSuggestions, value]);

  // Detect near-duplicate match using intelligent fuzzy detector
  const duplicateMatch = useMemo<DuplicateMatchResult | null>(() => {
    if (!value || exactMatch) return null;
    return findNearDuplicateHospital(value, allSuggestions, 0.70);
  }, [allSuggestions, value, exactMatch]);

  // Also detect duplicates inside the Quick-Add modal when typing a new name
  const modalDuplicateMatch = useMemo<DuplicateMatchResult | null>(() => {
    if (!newName || !quickAddModalOpen) return null;
    return findNearDuplicateHospital(newName, allSuggestions, 0.70);
  }, [allSuggestions, newName, quickAddModalOpen]);


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

    // Check if hospital already exists in customers
    const existing = customers.find(
      (c) => c.name.toLowerCase().trim() === clean.toLowerCase().trim()
    );
    if (existing) {
      onChange(existing.name);
      if (onSelectCustomer) onSelectCustomer(existing);
      setOpen(false);
      toast({
        title: "Selected Existing Hospital",
        description: `"${existing.name}" is already in customer directory.`,
      });
      return;
    }

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
    setNewContactRole("OT Person");
    setNewMobile("");
    setNewAddress("");
    setNewContactPerson("");
    setOpen(false);
    setQuickAddModalOpen(true);
  };

  // Submit on-the-fly modal with clean contact details
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

    // Check if hospital already exists
    const existing = customers.find(
      (c) => c.name.toLowerCase().trim() === clean.toLowerCase().trim()
    );
    if (existing) {
      onChange(existing.name);
      if (onSelectCustomer) onSelectCustomer(existing);
      setQuickAddModalOpen(false);
      toast({
        title: "Selected Existing Hospital",
        description: `"${existing.name}" is already registered in customer directory.`,
      });
      return;
    }

    const primaryNumber = newMobile.trim();
    if (!primaryNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please provide a valid phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const contacts = [
        {
          id: `c_${Date.now()}`,
          role: newContactRole,
          name: newContactPerson.trim(),
          phone: primaryNumber,
        }
      ];

      const saved = await saveCustomer({
        name: clean,
        mobile: primaryNumber,
        otNumber: newContactRole === "OT Person" ? primaryNumber : "",
        hospitalNumber: newContactRole === "Reception" ? primaryNumber : "",
        personalNumber: newContactRole === "Doctor" ? primaryNumber : "",
        contactPerson: newContactRole === "Doctor" ? newContactPerson.trim() : "",
        contacts,
        address: newAddress.trim(),
      });

      onChange(saved.name);
      if (onSelectCustomer) onSelectCustomer(saved);
      setQuickAddModalOpen(false);

      toast({
        title: "Hospital Saved",
        description: `"${saved.name}" added to customer directory.`,
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
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          aria-autocomplete="none"
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

      {/* Inline Near-Duplicate Alert below input when closed */}
      {!open && duplicateMatch && value.trim().length >= 3 && (
        <div className="mt-1 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 animate-in fade-in-50">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate">
              Similar to existing hospital: <strong className="text-slate-900 dark:text-white font-bold">{duplicateMatch.match.name}</strong>
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleSelect(duplicateMatch.match)}
            className="h-6 px-2 text-[10.5px] font-bold border-amber-400 dark:border-amber-700 bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-950 dark:text-amber-100 shrink-0 shadow-2xs"
          >
            Use Profile
          </Button>
        </div>
      )}

      {/* Floating Auto-complete Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[300px] sm:min-w-[380px] max-w-[500px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden text-xs animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Header Banner */}
          <div className="bg-slate-50 dark:bg-slate-950 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Search className="w-3 h-3 text-teal-600" />
              {value.trim() ? `Matching Hospitals for "${value.trim()}"` : "Verified Hospital Directory"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {filteredSuggestions.length} available · ↑↓ to choose
            </span>
          </div>

          {/* Near-Duplicate Recommendation Banner */}
          {duplicateMatch && (
            <div className="p-2.5 bg-amber-50/90 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                  Similar Hospital Found ({Math.round(duplicateMatch.score * 100)}% match)
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                  {duplicateMatch.match.name}
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                  {duplicateMatch.match.address && (
                    <span className="truncate max-w-[180px]">📍 {duplicateMatch.match.address}</span>
                  )}
                  {duplicateMatch.match.otNumber && (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      🩺 OT: {duplicateMatch.match.otNumber}
                    </span>
                  )}
                  {(duplicateMatch.match.hospitalNumber || duplicateMatch.match.mobile) && (
                    <span className="text-slate-500">
                      📞 {duplicateMatch.match.hospitalNumber || duplicateMatch.match.mobile}
                    </span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleSelect(duplicateMatch.match)}
                className="h-7 text-xs bg-teal-700 hover:bg-teal-800 text-white font-bold shrink-0 gap-1 px-2.5 shadow-xs"
              >
                <Check className="w-3 h-3" />
                Use Profile
              </Button>
            </div>
          )}


          {/* Suggestions List */}
          <div ref={listRef} className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
            {filteredSuggestions.length === 0 ? (
              <div className="p-4 text-center space-y-2.5 bg-white dark:bg-slate-900">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  No hospital found matching <strong>"{value}"</strong>.
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleOpenQuickAddModal(value)}
                  className="h-7 text-xs bg-teal-700 hover:bg-teal-800 text-white font-bold gap-1 shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  Register "{value}" in Directory
                </Button>
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
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                      isHighlighted
                        ? "bg-teal-50 dark:bg-teal-950/60 text-slate-900 dark:text-white"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center shrink-0 text-teal-700 dark:text-teal-300">
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 font-bold" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.contactPerson && (
                            <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-normal">
                              ({item.contactPerson})
                            </span>
                          )}
                        </div>

                        {(item.otNumber || item.hospitalNumber || item.personalNumber || item.mobile || item.address) && (
                          <div className="text-[10px] flex flex-wrap items-center gap-1.5 mt-1">
                            {item.otNumber && (
                              <span className="inline-flex items-center gap-0.5 text-emerald-800 dark:text-emerald-300 font-extrabold bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800 px-1.5 py-0.5 rounded text-[9.5px]">
                                <Stethoscope className="w-2.5 h-2.5 text-emerald-600" />
                                OT: {item.otNumber}
                              </span>
                            )}
                            {item.hospitalNumber && (
                              <span className="inline-flex items-center gap-0.5 text-sky-800 dark:text-sky-300 font-bold bg-sky-50 dark:bg-sky-950/70 border border-sky-200/80 dark:border-sky-800 px-1.5 py-0.5 rounded text-[9.5px]">
                                <Building2 className="w-2.5 h-2.5 text-sky-600" />
                                {item.hospitalNumber}
                              </span>
                            )}
                            {(item.personalNumber || item.mobile) && (
                              <span className="inline-flex items-center gap-0.5 text-purple-800 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/70 border border-purple-200/80 dark:border-purple-800 px-1.5 py-0.5 rounded text-[9.5px]">
                                <Smartphone className="w-2.5 h-2.5 text-purple-600" />
                                {item.personalNumber || item.mobile}
                              </span>
                            )}
                            {item.address && (
                              <span className="inline-flex items-center gap-0.5 text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={item.address}>
                                <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                {item.address}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 ml-2 flex items-center gap-1">
                      {item.notes !== "From DC History" ? (
                        <Badge
                          className="text-[9.5px] px-1.5 py-0.5 h-4 bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 border-0 font-extrabold flex items-center gap-0.5"
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-teal-600" />
                          Directory
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal"
                        >
                          <Clock className="w-2 h-2 mr-0.5" /> History
                        </Badge>
                      )}
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

            <span className="text-[10px] text-slate-400 font-medium">
              Customer Directory
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

          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Hospital / Customer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Yashoda Hospital, Secunderabad"
                className="mt-1 h-9 text-xs font-bold"
                autoFocus
              />

              {modalDuplicateMatch && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-extrabold uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      Similar Hospital Found ({Math.round(modalDuplicateMatch.score * 100)}% match)
                    </div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                      {modalDuplicateMatch.match.name}
                    </div>
                    {modalDuplicateMatch.match.address && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        📍 {modalDuplicateMatch.match.address}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleSelect(modalDuplicateMatch.match);
                      setQuickAddModalOpen(false);
                      toast({
                        title: "Selected Existing Profile",
                        description: `Using "${modalDuplicateMatch.match.name}" from directory.`,
                      });
                    }}
                    className="h-7 text-xs font-bold border-teal-600 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950 shrink-0"
                  >
                    Use Profile
                  </Button>
                </div>
              )}
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Contact Role
                </Label>
                <select
                  value={newContactRole}
                  onChange={(e: any) => setNewContactRole(e.target.value)}
                  className="mt-1 w-full h-9 text-xs font-bold rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-600"
                >
                  <option value="OT Person">🩺 OT Person</option>
                  <option value="Accounts">💳 Accounts</option>
                  <option value="Reception">🏥 Reception</option>
                  <option value="Doctor">👨‍⚕️ Doctor</option>
                  <option value="Others">📋 Others</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Phone / Mobile Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="tel"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  placeholder="e.g. 9848012345"
                  className="mt-1 h-9 text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Contact Person Name (Optional)
              </Label>
              <Input
                value={newContactPerson}
                onChange={(e) => setNewContactPerson(e.target.value)}
                placeholder="e.g. Dr. Ramesh / Sister Sujatha"
                className="mt-1 h-8 text-xs"
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
                className="mt-1 h-8 text-xs"
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
