import React, { useState, useEffect, useMemo, useRef } from "react";
import { Bike, Car, Check, ChevronsUpDown, Flame, Package, Sparkles, Trash2, Truck, User, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Personnel,
  getSavedPersonnel,
  addPersonnel,
  deletePersonnel,
  normalizePersonnelName,
  isDisallowedPersonnel,
  isTransportLogisticsName,
  getPersonnelUsageStats,
  PersonnelUsageStats,
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
  return null;
};

export const renderTransportIcon = (iconName?: string, className = "w-3.5 h-3.5 text-teal-600 shrink-0") => {
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
  placeholder = "Select or enter personnel...",
  disabled = false,
  className = "",
  id,
  showQuickPicks = true,
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [personnelList, setPersonnelList] = useState<Personnel[]>(getSavedPersonnel);
  const [historicalNames, setHistoricalNames] = useState<string[]>([]);
  const [dcs, setDcs] = useState<SavedDc[]>([]);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Detect enclosing dialog container to avoid react-remove-scroll locking
  useEffect(() => {
    if (containerRef.current) {
      const dialogEl =
        containerRef.current.closest<HTMLElement>('[role="dialog"]') ||
        containerRef.current.closest<HTMLElement>('[data-radix-dialog-content]');
      if (dialogEl) {
        setPortalContainer(dialogEl);
      }
    }
  }, [open]);

  // Fix: Prevent wheel and touch events on CommandList from being canceled by document scroll-lock
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

  // Load registered personnel and historical DC names
  useEffect(() => {
    const updateList = () => {
      setPersonnelList(getSavedPersonnel());
    };

    updateList();
    window.addEventListener("srrortho:personnel_updated", updateList);

    // Gather names & usage frequencies from saved DCs
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

  // Compute personnel usage frequencies from DC history
  const usageStatsMap = useMemo(() => {
    return getPersonnelUsageStats(dcs);
  }, [dcs]);

  // Combined suggestions: Max-used people ranked at the top!
  const suggestions = useMemo<PersonnelSuggestion[]>(() => {
    const map = new Map<string, PersonnelSuggestion>();

    // 1. Official registered personnel
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

    // 2. Historical DC names
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

    // Sort order:
    // 1. Maximum usage count first (most used at the very top!)
    // 2. Official personnel before unregistered
    // 3. Alphabetical for equal frequency
    return Array.from(map.values()).sort((a, b) => {
      if (b.totalUsage !== a.totalUsage) {
        return b.totalUsage - a.totalUsage;
      }
      if (a.isOfficial && !b.isOfficial) return -1;
      if (!a.isOfficial && b.isOfficial) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [personnelList, historicalNames, usageStatsMap]);

  // Extract top recommended / most frequently used personnel
  const topRecommendations = useMemo(() => {
    return suggestions.filter((s) => s.totalUsage > 0).slice(0, 4);
  }, [suggestions]);

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearchValue("");
  };

  const handleAddNew = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || isDisallowedPersonnel(trimmed) || isTransportLogisticsName(trimmed)) return;
    try {
      addPersonnel(trimmed, { role: "Delivery Executive" });
      onChange(trimmed);
      setOpen(false);
      setSearchValue("");
      toast({
        title: "Personnel Added",
        description: `"${trimmed}" saved to delivery roster.`,
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
    if (!searchValue.trim()) return false;
    const lower = searchValue.trim().toLowerCase();
    if (TRANSPORT_MODES.some((m) => m.name.toLowerCase() === lower)) return true;
    return suggestions.some((s) => s.name.toLowerCase() === lower);
  }, [searchValue, suggestions]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={`w-full justify-between h-9 px-3 text-left font-normal bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all ${
              !value ? "text-muted-foreground" : "text-slate-900 dark:text-slate-100 font-semibold"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {matchedTransport ? (
                renderTransportIcon(matchedTransport.iconName)
              ) : (
                <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              )}
              <span className="truncate">{value || placeholder}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {value && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                  }}
                  className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                  title="Clear"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
              <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          container={portalContainer}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[420px] p-0 z-[150] shadow-2xl border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900"
          align="start"
          sideOffset={4}
        >
          <Command shouldFilter={true} className="w-full">
            <CommandInput
              placeholder="Search staff, top picks or Courier..."
              value={searchValue}
              onValueChange={setSearchValue}
              className="h-9 text-xs"
            />
            <CommandList
              ref={listRef}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 overscroll-contain touch-pan-y"
              style={{
                maxHeight: "260px",
                overflowY: "auto",
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <CommandEmpty className="py-3 px-3 text-xs text-center text-muted-foreground">
                No personnel matching "{searchValue}"
              </CommandEmpty>

              {/* 1. Recommended (Top Frequent Personnel) - Simple, clean, NO numbers */}
              {topRecommendations.length > 0 && !searchValue.trim() && (
                <CommandGroup heading="Frequent Staff">
                  {topRecommendations.map((item) => {
                    const isSelected = value?.trim().toLowerCase() === item.name.toLowerCase();
                    return (
                      <CommandItem
                        key={`rec_${item.name}`}
                        value={`${item.name} frequent`}
                        onSelect={() => handleSelect(item.name)}
                        className="flex items-center justify-between py-2 px-3 text-xs cursor-pointer hover:bg-teal-50/60 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {item.name}
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {/* 2. Delivery / Transport Mode: Courier */}
              <CommandGroup heading="Transport & Logistics">
                {TRANSPORT_MODES.map((mode) => {
                  const isSelected = value?.trim().toLowerCase() === mode.name.toLowerCase();
                  return (
                    <CommandItem
                      key={mode.name}
                      value={`${mode.name} ${mode.category} ${mode.badge} ${mode.keywords}`}
                      onSelect={() => handleSelect(mode.name)}
                      className="flex items-center justify-between py-2 px-3 text-xs cursor-pointer hover:bg-teal-50/60 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {renderTransportIcon(mode.iconName)}
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{mode.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              {/* 3. Add typed name if not matching */}
              {searchValue.trim() && !isExactMatch && !isDisallowedPersonnel(searchValue.trim()) && !isTransportLogisticsName(searchValue.trim()) && (
                <CommandGroup heading="New Entry">
                  <CommandItem
                    value={`add_${searchValue.trim()}`}
                    onSelect={() => handleAddNew(searchValue)}
                    className="cursor-pointer text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/30 hover:bg-teal-100 flex items-center gap-2 py-2 px-3"
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Add & Select: "{searchValue.trim()}"</span>
                  </CommandItem>
                </CommandGroup>
              )}

              {/* 4. Full Personnel List (ranked by frequency, then alphabetical, NO numbers) */}
              <CommandGroup heading="All Team Members">
                {suggestions.map((item) => {
                  const isSelected = value?.trim().toLowerCase() === item.name.toLowerCase();
                  return (
                    <CommandItem
                      key={item.name}
                      value={`${item.name} ${item.role || ''}`}
                      onSelect={() => handleSelect(item.name)}
                      className="group flex items-center justify-between py-2 px-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {item.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 ml-auto mr-1" />}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteItem(e, item)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded text-slate-400 hover:text-rose-600 transition-opacity"
                          title={`Delete "${item.name}"`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Quick Recommendation Chips (under input when unselected) - NO NUMBERS */}
      {showQuickPicks && topRecommendations.length > 0 && !value && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-teal-600 shrink-0" />
            Quick:
          </span>
          {topRecommendations.map((person) => (
            <button
              key={person.name}
              type="button"
              onClick={() => handleSelect(person.name)}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-teal-300 font-medium text-[11.5px] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <User className="w-3 h-3 text-teal-600 shrink-0" />
              <span>{person.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

