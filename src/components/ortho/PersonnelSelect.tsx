import React, { useState, useEffect, useMemo, useRef } from "react";
import { Bike, Car, Check, ChevronDown, Package, Sparkles, Trash2, Truck, User, UserPlus, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import {
  Personnel,
  getSavedPersonnel,
  addPersonnel,
  deletePersonnel,
  normalizePersonnelName,
  isDisallowedPersonnel,
  isTransportLogisticsName,
  getPersonnelUsageStats,
  toTitleCase,
} from "@/lib/personnelStorage";
import { loadSavedDcs, SavedDc } from "@/lib/savedDcStorage";
import { useToast } from "@/hooks/use-toast";

export interface TransportModeOption {
  name: string;
  badge: string;
  category: string;
  keywords: string;
  iconName: "truck" | "bike" | "car" | "package";
}

export const TRANSPORT_MODES: TransportModeOption[] = [
  {
    name: "Courier (Rapido/Ola/Uber/Porter etc)",
    badge: "Logistics / Parcel / Cab",
    category: "Courier & On-Demand Transport",
    keywords: "courier rapido ola uber porter parcel logistics cab bike tempo dunzo delivery transport parcel runner pickup speedpost dhl bluedart dtdc",
    iconName: "truck",
  },
  {
    name: "Vendor / External Supplier",
    badge: "Vendor Pickup / Delivery",
    category: "Vendor & Supplier",
    keywords: "vendor supplier external vendor delivery vendor person representative",
    iconName: "package",
  },
];

export const getTransportMode = (val?: string): TransportModeOption | null => {
  if (!val) return null;
  const lower = val.trim().toLowerCase();
  if (
    lower.startsWith("courier") ||
    lower.includes("rapido") ||
    lower.includes("porter") ||
    lower.includes("uber") ||
    lower.includes("ola")
  ) {
    return TRANSPORT_MODES[0];
  }
  if (
    lower.startsWith("vendor") ||
    lower.includes("supplier")
  ) {
    return TRANSPORT_MODES[1];
  }
  return null;
};

export const renderTransportIcon = (iconName?: string, className = "w-4 h-4 text-teal-600 shrink-0") => {
  switch (iconName) {
    case "bike":
      return <Bike className={className} />;
    case "car":
      return <Car className={className} />;
    case "package":
      return <Package className={className} />;
    default:
      return <Truck className={className} />;
  }
};

export interface PersonnelSuggestion {
  id?: string;
  name: string;
  role?: string;
  isOfficial: boolean;
  totalUsage: number;
  returnCount: number;
  deliveryCount: number;
}

interface PersonnelSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  roleFilter?: string;
  id?: string;
  autoFocus?: boolean;
  showQuickPicks?: boolean;
}

export const PersonnelSelect: React.FC<PersonnelSelectProps> = ({
  value,
  onChange,
  placeholder = "Select or type personnel name...",
  disabled = false,
  className = "",
  id,
  showQuickPicks = true,
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [personnelList, setPersonnelList] = useState<Personnel[]>(getSavedPersonnel);
  const [historicalNames, setHistoricalNames] = useState<string[]>([]);
  const [dcs, setDcs] = useState<SavedDc[]>([]);

  // Sync search input with value prop when blurred
  useEffect(() => {
    if (!isFocused) {
      setSearchValue(value ? toTitleCase(value) : "");
    }
  }, [value, isFocused]);

  // Prevent wheel/touch events on list from canceling document scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, [open]);

  // Load personnel roster and historical DC names
  useEffect(() => {
    const updateList = () => {
      setPersonnelList(getSavedPersonnel());
    };

    updateList();
    window.addEventListener("srrortho:personnel_updated", updateList);

    loadSavedDcs()
      .then((loadedDcs: SavedDc[]) => {
        setDcs(loadedDcs);
        const set = new Set<string>();
        loadedDcs.forEach((d) => {
          const deliv = normalizePersonnelName(d.deliveredBy);
          if (deliv && !isDisallowedPersonnel(deliv) && !isTransportLogisticsName(deliv)) {
            set.add(deliv);
          }
          const ret = normalizePersonnelName(d.returnedBy);
          if (ret && !isDisallowedPersonnel(ret) && !isTransportLogisticsName(ret)) {
            set.add(ret);
          }
        });
        setHistoricalNames(Array.from(set));
      })
      .catch((err) => console.error("Error loading DCs for personnel names:", err));

    return () => {
      window.removeEventListener("srrortho:personnel_updated", updateList);
    };
  }, []);

  const usageStatsMap = useMemo(() => {
    return getPersonnelUsageStats(dcs);
  }, [dcs]);

  const suggestions = useMemo<PersonnelSuggestion[]>(() => {
    const map = new Map<string, PersonnelSuggestion>();

    personnelList.forEach((p) => {
      const canonical = normalizePersonnelName(p.name);
      if (p.active && canonical && !isDisallowedPersonnel(canonical) && !isTransportLogisticsName(canonical)) {
        const key = canonical.toLowerCase();
        const stats = usageStatsMap.get(key);
        map.set(key, {
          id: p.id,
          name: canonical,
          role: p.role,
          isOfficial: true,
          totalUsage: stats?.totalUsage || 0,
          returnCount: stats?.returnCount || 0,
          deliveryCount: stats?.deliveryCount || 0,
        });
      }
    });

    historicalNames.forEach((name) => {
      const canonical = normalizePersonnelName(name);
      if (!canonical || isDisallowedPersonnel(canonical) || isTransportLogisticsName(canonical)) return;
      const key = canonical.toLowerCase();
      const stats = usageStatsMap.get(key);
      if (!map.has(key)) {
        map.set(key, {
          name: canonical,
          role: "DC History",
          isOfficial: false,
          totalUsage: stats?.totalUsage || 0,
          returnCount: stats?.returnCount || 0,
          deliveryCount: stats?.deliveryCount || 0,
        });
      } else {
        const existing = map.get(key)!;
        if (stats && existing.totalUsage === 0) {
          existing.totalUsage = stats.totalUsage;
          existing.returnCount = stats.returnCount;
          existing.deliveryCount = stats.deliveryCount;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.totalUsage !== a.totalUsage) {
        return b.totalUsage - a.totalUsage;
      }
      if (a.isOfficial && !b.isOfficial) return -1;
      if (!a.isOfficial && b.isOfficial) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [personnelList, historicalNames, usageStatsMap]);

  const filteredSuggestions = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return suggestions;
    return suggestions.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.role && s.role.toLowerCase().includes(term))
    );
  }, [suggestions, searchValue]);

  const filteredTransportModes = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return TRANSPORT_MODES;
    return TRANSPORT_MODES.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.keywords.toLowerCase().includes(term)
    );
  }, [searchValue]);

  const topRecommendations = useMemo(() => {
    return suggestions.filter((s) => s.totalUsage > 0).slice(0, 4);
  }, [suggestions]);

  const handleSelect = (rawName: string) => {
    if (rawName.toLowerCase().startsWith("vendor")) {
      const personName = window.prompt("Enter Vendor / Delivery Person Name (Optional):");
      const finalVal = personName && personName.trim() ? `Vendor (${toTitleCase(personName.trim())})` : "Vendor";
      onChange(finalVal);
      setSearchValue(finalVal);
      setOpen(false);
      setIsFocused(false);
      return;
    }
    const formattedName = toTitleCase(rawName);
    onChange(formattedName);
    setSearchValue(formattedName);
    setOpen(false);
    setIsFocused(false);
  };

  const handleAddNew = (rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed || isDisallowedPersonnel(trimmed) || isTransportLogisticsName(trimmed)) return;
    const titleCased = toTitleCase(trimmed);
    try {
      addPersonnel(titleCased, { role: "Delivery Executive" });
      onChange(titleCased);
      setSearchValue(titleCased);
      setOpen(false);
      setIsFocused(false);
      toast({
        title: "Personnel Added",
        description: `"${titleCased}" saved to delivery roster.`,
      });
    } catch (e: any) {
      toast({
        title: "Could not add",
        description: e.message || "Invalid name",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = (e: React.MouseEvent, item: { id?: string; name: string }) => {
    e.stopPropagation();
    deletePersonnel(item.id || item.name);
    if (value.toLowerCase() === item.name.toLowerCase()) {
      onChange("");
      setSearchValue("");
    }
    toast({
      title: "Removed Personnel",
      description: `"${item.name}" has been removed from suggestions.`,
    });
  };

  const matchedTransport = useMemo(() => {
    return getTransportMode(value);
  }, [value]);

  const isExactMatch = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return false;
    if (TRANSPORT_MODES.some((m) => m.name.toLowerCase() === term)) return true;
    return suggestions.some((s) => s.name.toLowerCase() === term);
  }, [searchValue, suggestions]);

  const displayInputValue = isFocused ? searchValue : (value ? toTitleCase(value) : "");

  return (
    <div ref={containerRef} className={`ui fluid search selection dropdown relative w-full ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            onClick={() => {
              if (!disabled && inputRef.current) {
                inputRef.current.focus();
                setOpen(true);
              }
            }}
            className={`flex items-center w-full h-9 px-3 rounded-lg border bg-white dark:bg-slate-950 transition-all cursor-text shadow-2xs ${
              open
                ? "border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-500"
                : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
            } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900" : ""}`}
          >
            {/* Left Icon */}
            <div className="shrink-0 mr-2 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
              {matchedTransport ? (
                renderTransportIcon(matchedTransport.iconName)
              ) : (
                <User className="w-4 h-4 text-teal-600 shrink-0" />
              )}
            </div>

            {/* Direct Inline Search Input */}
            <input
              id={id}
              ref={inputRef}
              disabled={disabled}
              value={displayInputValue}
              placeholder={placeholder}
              onFocus={() => {
                setIsFocused(true);
                setSearchValue(value ? toTitleCase(value) : "");
                setOpen(true);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setIsFocused(false);
                }, 200);
              }}
              onChange={(e) => {
                const val = e.target.value;
                setSearchValue(val);
                if (!open) setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchValue.trim()) {
                  e.preventDefault();
                  const term = searchValue.trim();
                  const match = suggestions.find((s) => s.name.toLowerCase() === term.toLowerCase());
                  if (match) {
                    handleSelect(match.name);
                  } else if (!isExactMatch && !isDisallowedPersonnel(term) && !isTransportLogisticsName(term)) {
                    handleAddNew(term);
                  }
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              className="w-full h-full bg-transparent border-0 outline-none ring-0 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-0 p-0"
            />

            {/* Right Action Icons */}
            <div className="shrink-0 ml-1.5 flex items-center gap-1">
              {value && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                    setSearchValue("");
                    if (inputRef.current) inputRef.current.focus();
                  }}
                  className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Clear selection"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  open ? "rotate-180 text-teal-600" : ""
                }`}
              />
            </div>
          </div>
        </PopoverAnchor>

        <PopoverContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[420px] p-0 z-[99999] shadow-2xl border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900"
          align="start"
          sideOffset={4}
        >
          <div
            ref={listRef}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 overscroll-contain touch-pan-y"
            style={{
              maxHeight: "260px",
              overflowY: "auto",
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {/* 1. Transport & Logistics */}
            {filteredTransportModes.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Transport & Logistics
                </div>
                {filteredTransportModes.map((mode) => {
                  const isSelected = value?.trim().toLowerCase() === mode.name.toLowerCase();
                  return (
                    <div
                      key={mode.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(mode.name);
                      }}
                      className="flex items-center justify-between py-2 px-3 text-xs cursor-pointer hover:bg-teal-50/70 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {renderTransportIcon(mode.iconName)}
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{mode.name}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. Add typed name if not matching */}
            {searchValue.trim() && !isExactMatch && !isDisallowedPersonnel(searchValue.trim()) && !isTransportLogisticsName(searchValue.trim()) && (
              <div className="py-1">
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAddNew(searchValue);
                  }}
                  className="cursor-pointer text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50/60 dark:bg-teal-950/40 hover:bg-teal-100 flex items-center gap-2 py-2 px-3 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Add & Select: "{toTitleCase(searchValue.trim())}"</span>
                </div>
              </div>
            )}

            {/* 3. Team Members */}
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Team Members
              </div>
              {filteredSuggestions.length === 0 ? (
                <div className="py-3 px-3 text-xs text-center text-muted-foreground">
                  No personnel matching "{searchValue}"
                </div>
              ) : (
                filteredSuggestions.map((item) => {
                  const titleName = toTitleCase(item.name);
                  const isSelected = value?.trim().toLowerCase() === titleName.toLowerCase();
                  return (
                    <div
                      key={item.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(titleName);
                      }}
                      className="group flex items-center justify-between py-2 px-3 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {titleName}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0 ml-auto mr-1" />}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => handleDeleteItem(e, item)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded text-slate-400 hover:text-rose-600 transition-opacity"
                          title={`Delete "${titleName}"`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick Recommendation Chips (under input when unselected) */}
      {showQuickPicks && topRecommendations.length > 0 && !value && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-teal-600 shrink-0" />
            Quick:
          </span>
          {topRecommendations.map((person) => {
            const titleName = toTitleCase(person.name);
            return (
              <button
                key={person.name}
                type="button"
                onClick={() => handleSelect(titleName)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-teal-300 font-medium text-[11.5px] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <User className="w-3 h-3 text-teal-600 shrink-0" />
                <span>{titleName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
