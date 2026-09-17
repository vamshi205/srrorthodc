import React, { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronsUpDown, Plus, User, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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
  getAllPersonnelNames,
  normalizePersonnelName,
} from "@/lib/personnelStorage";
import { loadSavedDcs, SavedDc } from "@/lib/savedDcStorage";

interface PersonnelSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  roleFilter?: string;
  id?: string;
  autoFocus?: boolean;
}

export const PersonnelSelect: React.FC<PersonnelSelectProps> = ({
  value,
  onChange,
  placeholder = "Select or enter name...",
  disabled = false,
  className = "",
  id,
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [personnelList, setPersonnelList] = useState<Personnel[]>(getSavedPersonnel);
  const [historicalNames, setHistoricalNames] = useState<string[]>([]);

  // Load registered personnel and historical DC names
  useEffect(() => {
    const updateList = () => {
      setPersonnelList(getSavedPersonnel());
    };

    updateList();
    window.addEventListener("srrortho:personnel_updated", updateList);

    // Also gather names from saved DCs
    loadSavedDcs()
      .then((dcs: SavedDc[]) => {
        const all = getAllPersonnelNames(dcs, false);
        setHistoricalNames(all);
      })
      .catch((err) => console.error("Error loading DCs for personnel names:", err));

    return () => {
      window.removeEventListener("srrortho:personnel_updated", updateList);
    };
  }, []);

  // Combined unique suggestions
  const suggestions = useMemo(() => {
    const map = new Map<string, { name: string; role?: string; isOfficial: boolean }>();

    // First add official registered personnel
    personnelList.forEach((p) => {
      const canonical = normalizePersonnelName(p.name);
      if (p.active && canonical) {
        map.set(canonical.toLowerCase(), {
          name: canonical,
          role: p.role,
          isOfficial: true,
        });
      }
    });

    // Then add historical names not already registered
    historicalNames.forEach((name) => {
      const canonical = normalizePersonnelName(name);
      if (!canonical) return;
      const key = canonical.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: canonical,
          role: "DC History",
          isOfficial: false,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Official first, then alphabetical
      if (a.isOfficial && !b.isOfficial) return -1;
      if (!a.isOfficial && b.isOfficial) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [personnelList, historicalNames]);

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearchValue("");
  };

  const handleAddNew = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addPersonnel(trimmed, { role: "Delivery Executive" });
    onChange(trimmed);
    setOpen(false);
    setSearchValue("");
  };

  const isExactMatch = useMemo(() => {
    if (!searchValue.trim()) return false;
    return suggestions.some(
      (s) => s.name.toLowerCase() === searchValue.trim().toLowerCase()
    );
  }, [searchValue, suggestions]);

  return (
    <div className={`relative w-full ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={`w-full justify-between h-9 px-3 text-left font-normal bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 ${
              !value ? "text-muted-foreground" : "text-slate-900 dark:text-slate-100 font-medium"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
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
          className="w-[280px] sm:w-[320px] p-0 z-50 shadow-xl border border-slate-200 dark:border-slate-800"
          align="start"
        >
          <Command shouldFilter={true}>
            <CommandInput
              placeholder="Search or type name..."
              value={searchValue}
              onValueChange={setSearchValue}
              className="h-9 text-xs"
            />
            <CommandList className="max-h-60 overflow-y-auto">
              <CommandEmpty className="py-2.5 px-3 text-xs text-center text-muted-foreground">
                No saved personnel matching "{searchValue}"
              </CommandEmpty>

              {/* Add typed name if not exactly matching */}
              {searchValue.trim() && !isExactMatch && (
                <CommandGroup heading="New Name">
                  <CommandItem
                    value={`add_${searchValue.trim()}`}
                    onSelect={() => handleAddNew(searchValue)}
                    className="cursor-pointer text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50/70 dark:bg-teal-950/40 hover:bg-teal-100 flex items-center gap-2 py-2"
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Add & Select: "{searchValue.trim()}"</span>
                  </CommandItem>
                </CommandGroup>
              )}

              {/* Suggestions List */}
              <CommandGroup heading="Saved Personnel">
                {suggestions.map((item) => {
                  const isSelected = value?.trim().toLowerCase() === item.name.toLowerCase();
                  return (
                    <CommandItem
                      key={item.name}
                      value={item.name}
                      onSelect={() => handleSelect(item.name)}
                      className="flex items-center justify-between py-1.5 px-2.5 text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 text-teal-600 ${
                            isSelected ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.name}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9.5px] px-1.5 py-0 shrink-0 font-normal ${
                          item.isOfficial
                            ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 border-amber-200"
                        }`}
                      >
                        {item.role || "Staff"}
                      </Badge>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
