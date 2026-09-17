import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  User,
  Check,
  ChevronDown,
  Sparkles,
  X,
  Stethoscope,
  Star,
  Clock,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { loadSavedDcs, SavedDc } from "@/lib/savedDcStorage";
import {
  getDoctorRecommendations,
  DoctorRecommendation,
  saveDoctorName,
} from "@/lib/doctorStorage";

interface DoctorSelectProps {
  value: string;
  onChange: (value: string) => void;
  hospitalName?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

export const DoctorSelect: React.FC<DoctorSelectProps> = ({
  value,
  onChange,
  hospitalName = "",
  placeholder = "Dr. Name",
  disabled = false,
  className = "",
  id,
  autoFocus = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dcs, setDcs] = useState<SavedDc[]>([]);

  // Load DCs to calculate hospital and general doctor recommendations
  useEffect(() => {
    loadSavedDcs()
      .then((data) => setDcs(data))
      .catch((err) => console.error("Error loading DCs for doctors:", err));
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

  // Compute recommendations whenever hospital or DCs change
  const recommendations = useMemo(() => {
    return getDoctorRecommendations(hospitalName, dcs);
  }, [hospitalName, dcs]);

  // Separate hospital-specific recommendations for quick-select chips
  const hospitalSpecificDocs = useMemo(() => {
    if (!hospitalName.trim()) return [];
    return recommendations.filter((r) => r.isHospitalSpecific).slice(0, 4);
  }, [recommendations, hospitalName]);

  // Filter recommendations based on user query
  const filteredList = useMemo(() => {
    const query = (value || "").trim().toLowerCase();
    if (!query) return recommendations.slice(0, 20);

    return recommendations
      .filter((r) => r.name.toLowerCase().includes(query))
      .slice(0, 20);
  }, [recommendations, value]);

  const exactMatch = useMemo(() => {
    const query = (value || "").trim().toLowerCase();
    if (!query) return null;
    return recommendations.find((r) => r.name.toLowerCase() === query) || null;
  }, [recommendations, value]);

  const handleSelect = (docName: string) => {
    onChange(docName);
    saveDoctorName(docName);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredList.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(filteredList.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredList.length - 1
        );
      }
    } else if (e.key === "Enter") {
      if (open && highlightedIndex >= 0 && highlightedIndex < filteredList.length) {
        e.preventDefault();
        handleSelect(filteredList[highlightedIndex].name);
      } else if (open) {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input container */}
      <div className="relative flex items-center">
        <Stethoscope className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none shrink-0" />

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
              title="Clear doctor name"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={open ? "Close suggestions" : "View recommendations"}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                open ? "rotate-180 text-teal-600" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Quick-Select Hospital Recommendation Chips (below input) */}
      {hospitalSpecificDocs.length > 0 && !value && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
            Suggested:
          </span>
          {hospitalSpecificDocs.map((doc) => (
            <button
              key={doc.name}
              type="button"
              onClick={() => handleSelect(doc.name)}
              className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 font-semibold transition-colors flex items-center gap-1 text-[10.5px]"
            >
              <span>{doc.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Floating Auto-complete / Recommendations Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[280px] sm:min-w-[320px] max-w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden text-xs animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Header Banner */}
          <div className="bg-slate-50 dark:bg-slate-950 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Stethoscope className="w-3 h-3 text-teal-600" />
              {hospitalName
                ? `Doctors for "${hospitalName}"`
                : "Doctor Recommendations"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {filteredList.length} suggestions
            </span>
          </div>

          {/* If typing a new name not in recommendations */}
          {value.trim() && !exactMatch && (
            <div
              onClick={() => handleSelect(value.trim())}
              className="p-2 bg-teal-50/70 dark:bg-teal-950/40 border-b border-teal-100 dark:border-teal-900/60 flex items-center justify-between cursor-pointer hover:bg-teal-100/60 transition-colors"
            >
              <div className="flex items-center gap-1.5 font-bold text-teal-800 dark:text-teal-200 truncate">
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Use: "{value.trim()}"</span>
              </div>
              <Badge className="bg-teal-600 text-white text-[9px] h-4 px-1 shrink-0">
                New
              </Badge>
            </div>
          )}

          {/* List of Doctor Recommendations */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1"
          >
            {filteredList.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">
                No doctors matching "{value}". Press Enter to use this name.
              </div>
            ) : (
              filteredList.map((item, idx) => {
                const isSelected = exactMatch?.name === item.name;
                const isHighlighted = highlightedIndex === idx;

                return (
                  <div
                    key={item.name}
                    data-index={idx}
                    onClick={() => handleSelect(item.name)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      isHighlighted
                        ? "bg-teal-50 dark:bg-teal-950/60 text-slate-900 dark:text-white"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          item.isHospitalSpecific
                            ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3 h-3 font-bold text-teal-600" />
                        ) : item.isHospitalSpecific ? (
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        ) : (
                          <User className="w-3 h-3" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {item.isHospitalSpecific
                            ? `Frequently associated with ${hospitalName || "this hospital"}`
                            : "Recorded in doctor roster"}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {item.isHospitalSpecific ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 font-semibold gap-0.5"
                        >
                          ★ Recommended
                        </Badge>
                      ) : item.count > 0 ? (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal"
                        >
                          <Clock className="w-2 h-2 mr-0.5" /> {item.count} DCs
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
