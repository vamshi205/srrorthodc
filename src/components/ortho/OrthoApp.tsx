import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import html2pdf from "html2pdf.js";
import {
  Activity,
  Printer,
  Download,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Wrench,
  RefreshCw,
  Bookmark,
  Save,
  LogOut,
  List,
  Search,
  X,
  Menu,
  Images,
  Sun,
  Moon,
  FileText,
  Receipt,
  Building2,
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Phone,
  Stethoscope,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
// import { LoginScreen } from '@/components/ortho/LoginScreen'; // Removed
import { ProcedureSelector } from "@/components/ortho/ProcedureSelector";
import { TopToolbar } from "@/components/ortho/TopToolbar";
import { AppLoadingSpinner } from "@/components/ui/LoadingSpinner";

import {
  ProcedureCard,
  parseItemNameParts,
} from "@/components/ortho/ProcedureCard";
import { SummaryPanel } from "@/components/ortho/SummaryPanel";
import { PrintPreview } from "@/components/ortho/PrintPreview";
import { useToast } from "@/hooks/use-toast";
import { useProcedures } from "@/hooks/useProcedures";
import { loadSavedDcs, saveSavedDc } from "@/lib/savedDcStorage";
import { Procedure, ActiveProcedure, SizeQty } from "@/types/procedure";
import { auth } from "@/firebase";
import { PersonnelSelect } from "@/components/ortho/PersonnelSelect";
import { HospitalSelect } from "@/components/ortho/HospitalSelect";
import { DoctorSelect } from "@/components/ortho/DoctorSelect";
import { ReceivedBySelect } from "@/components/ortho/ReceivedBySelect";
import {
  saveCustomer,
  getSavedCustomers,
  Customer,
} from "@/lib/customerStorage";
import { saveDoctorName } from "@/lib/doctorStorage";
import {
  findNearDuplicateHospital,
  DuplicateMatchResult,
} from "@/lib/hospitalDuplicateDetector";

export default function OrthoApp() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();

  const [theme] = useState<"light" | "dark">("light");
  const toggleTheme = () => {};
  // Legacy authentication removed - handled by App.tsx ProtectedRoute
  // const [isAuthenticated, setIsAuthenticated] = useState(...)

  const {
    procedures,
    loading,
    procedureTypes,
    refetchSingleProcedure,
    searchProcedures,
    searchInstruments,
    searchItems,
    fetchProcedures,
  } = useProcedures();

  // Initialize with empty array - no procedures selected by default
  const [activeProcedures, setActiveProcedures] = useState<ActiveProcedure[]>(
    [],
  );
  const [collapsedProcedures, setCollapsedProcedures] = useState<Set<string>>(
    new Set(),
  );
  const [hospitalName, setHospitalName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [dcNo, setDcNo] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProcedureSelector, setShowProcedureSelector] = useState(false);
  const [initialFilterType, setInitialFilterType] = useState<string>("None");
  const [showSummaryMobile, setShowSummaryMobile] = useState(false);
  const [recentSavedDcs, setRecentSavedDcs] = useState<any[]>([]);
  const [isSavingDc, setIsSavingDc] = useState(false);
  const [showConfirmSaveDialog, setShowConfirmSaveDialog] = useState(false);
  const [deliveredBy, setDeliveredBy] = useState("");
  const [customDcDate, setCustomDcDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Saving transition overlay state
  const [savingOverlay, setSavingOverlay] = useState<{
    open: boolean;
    hospitalName?: string;
    dcNo?: string;
    progress?: number;
  }>({ open: false });

  // Prompt dialog for near-duplicate hospital names
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    enteredName: string;
    duplicateResult: DuplicateMatchResult;
    shouldNavigate: boolean;
    shouldClear: boolean;
    isPrintAfter?: boolean;
  } | null>(null);

  // Details Prompt before displaying Procedure
  const [pendingProcedure, setPendingProcedure] = useState<Procedure | null>(
    null,
  );
  const [showSelectDetailsDialog, setShowSelectDetailsDialog] = useState(false);
  const [tempHospital, setTempHospital] = useState("");
  const [tempDoctor, setTempDoctor] = useState("");
  const [tempDcNo, setTempDcNo] = useState("");
  const [tempDeliveredBy, setTempDeliveredBy] = useState("");
  const [tempReceivedBy, setTempReceivedBy] = useState("");

  // Manual DC builder
  const [dcMode, setDcMode] = useState<"procedure" | "manual">("procedure");
  const [autoDcStep, setAutoDcStep] = useState<"details" | "procedures">(
    "details",
  );
  const [manualMaterialType, setManualMaterialType] = useState("SS");
  const [manualItemQuery, setManualItemQuery] = useState("");
  const [manualItemName, setManualItemName] = useState("");
  const [manualItemSuggestionsOpen, setManualItemSuggestionsOpen] =
    useState(false);
  const [manualItemActiveIndex, setManualItemActiveIndex] = useState(-1);
  const [manualItemSize, setManualItemSize] = useState("");
  const [manualItemQty, setManualItemQty] = useState("1");
  const [manualItems, setManualItems] = useState<
    Array<{ name: string; size: string; qty: number }>
  >([]);
  const [manualInstrumentQuery, setManualInstrumentQuery] = useState("");
  const [manualInstruments, setManualInstruments] = useState<string[]>([]);
  const [manualInstrumentSuggestionsOpen, setManualInstrumentSuggestionsOpen] =
    useState(false);
  const [manualInstrumentActiveIndex, setManualInstrumentActiveIndex] =
    useState(-1);
  const [manualBoxInput, setManualBoxInput] = useState("");
  const [manualBoxNumbers, setManualBoxNumbers] = useState<string[]>([]);

  const printRef = useRef<HTMLDivElement>(null);

  // Ensure no procedures are selected on mount and after login
  useEffect(() => {
    setActiveProcedures([]);
    // Load recent saved DCs on mount
    loadSavedDcs()
      .then((dcs) => setRecentSavedDcs(dcs.slice(0, 6)))
      .catch((err) => {
        console.error("Failed to load recent DCs:", err);
      });
  }, []);

  const handleSwitchDcMode = useCallback((newMode: "procedure" | "manual") => {
    setDcMode(newMode);
    setAutoDcStep("details");

    // Clear selected details & header fields
    setHospitalName("");
    setDoctorName("");
    setDcNo("");
    setReceivedBy("");
    setDeliveredBy("");
    setRemarks("");
    setCustomDcDate(new Date().toISOString().split("T")[0]);

    // Clear procedures
    setActiveProcedures([]);
    setCollapsedProcedures(new Set());
    setShowProcedureSelector(true);
    setInitialFilterType(newMode === "procedure" ? "All" : "None");

    // Clear manual entries
    setManualItems([]);
    setManualInstruments([]);
    setManualBoxNumbers([]);
    setManualItemQuery("");
    setManualItemName("");
    setManualItemSize("");
    setManualItemQty("1");
    setManualInstrumentQuery("");
    setManualBoxInput("");
    setManualMaterialType("SS");
  }, []);

  // Clear procedures and update mode / hospital from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    const hospital = params.get("hospital");

    if (hospital) {
      setHospitalName(hospital);
      setTempHospital(hospital);
    }

    if (mode === "manual" && dcMode !== "manual") {
      handleSwitchDcMode("manual");
    } else if (mode === "procedure" && dcMode !== "procedure") {
      handleSwitchDcMode("procedure");
    }
  }, [location.search, dcMode, handleSwitchDcMode]);

  const handleSelectProcedure = useCallback(
    (procedure: Procedure) => {
      const exists = activeProcedures.find((p) => p.name === procedure.name);
      if (exists) {
        setActiveProcedures((prev) => {
          const newProcedures = prev.filter((p) => p.name !== procedure.name);
          if (newProcedures.length === 0) {
            setShowProcedureSelector(true);
          }
          return newProcedures;
        });
        return;
      }

      // Instant procedure selection with 0 popups!
      const activeProcedure: ActiveProcedure = {
        ...procedure,
        materialType: "SS",
        selectedItems: new Map(),
        selectedFixedItems: new Map(
          procedure.fixedItems.map((fi) => [fi.name, true]),
        ),
        fixedQtyEdits: new Map(),
        boxNumbers: [],
        originalFixedItems: procedure.fixedItems
          ? procedure.fixedItems.map((fi) => ({ ...fi }))
          : [],
        originalItems: procedure.items ? [...procedure.items] : [],
        instrumentImageMapping: procedure.instrumentImageMapping || {},
        fixedItemImageMapping: procedure.fixedItemImageMapping || {},
        itemImageMapping: procedure.itemImageMapping || {},
        instrumentLocationMapping: procedure.instrumentLocationMapping || {},
        fixedItemLocationMapping: procedure.fixedItemLocationMapping || {},
        itemLocationMapping: procedure.itemLocationMapping || {},
      };

      setActiveProcedures((prev) => {
        const previousNames = prev.map((p) => p.name);
        setCollapsedProcedures((collapsedSet) => {
          const nextSet = new Set(collapsedSet);
          previousNames.forEach((name) => nextSet.add(name));
          return nextSet;
        });
        return [...prev, activeProcedure];
      });

      setShowProcedureSelector(false);
    },
    [activeProcedures],
  );

  const handleRemoveProcedure = useCallback((name: string) => {
    setActiveProcedures((prev) => {
      const newProcedures = prev.filter((p) => p.name !== name);
      // Show selector if no procedures left
      if (newProcedures.length === 0) {
        setShowProcedureSelector(true);
        setInitialFilterType("None");
      }
      return newProcedures;
    });
  }, []);

  const handleRefreshProcedure = useCallback(
    async (name: string) => {
      const updated = await refetchSingleProcedure(name);
      if (updated) {
        setActiveProcedures((prev) =>
          prev.map((p) =>
            p.name === name
              ? {
                  ...p,
                  ...updated,
                  selectedItems: p.selectedItems,
                  selectedFixedItems: p.selectedFixedItems,
                  fixedQtyEdits: p.fixedQtyEdits,
                  boxNumbers: p.boxNumbers || [],
                  instrumentImageMapping:
                    updated.instrumentImageMapping ||
                    p.instrumentImageMapping ||
                    {},
                  fixedItemImageMapping:
                    updated.fixedItemImageMapping ||
                    p.fixedItemImageMapping ||
                    {},
                  itemImageMapping:
                    updated.itemImageMapping || p.itemImageMapping || {},
                  instrumentLocationMapping:
                    updated.instrumentLocationMapping ||
                    p.instrumentLocationMapping ||
                    {},
                  fixedItemLocationMapping:
                    updated.fixedItemLocationMapping ||
                    p.fixedItemLocationMapping ||
                    {},
                  itemLocationMapping:
                    updated.itemLocationMapping || p.itemLocationMapping || {},
                }
              : p,
          ),
        );
      }
    },
    [refetchSingleProcedure],
  );

  const handleProcedureMaterialTypeChange = useCallback(
    (procedureName: string, newType: string) => {
      setActiveProcedures((prev) =>
        prev.map((p) =>
          p.name === procedureName ? { ...p, materialType: newType } : p,
        ),
      );
    },
    [],
  );

  const handleItemToggle = useCallback(
    (procedureName: string, itemName: string, checked: boolean) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;
          const newMap = new Map(p.selectedItems);
          if (checked) {
            newMap.set(itemName, { itemName, sizeQty: [] });
          } else {
            newMap.delete(itemName);
          }
          return { ...p, selectedItems: newMap };
        }),
      );
    },
    [],
  );

  const handleSizeQtyChange = useCallback(
    (procedureName: string, itemName: string, sizeQty: SizeQty[]) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;
          const newMap = new Map(p.selectedItems);
          newMap.set(itemName, { itemName, sizeQty });
          return { ...p, selectedItems: newMap };
        }),
      );
    },
    [],
  );

  const handleFixedItemToggle = useCallback(
    (procedureName: string, itemName: string, checked: boolean) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;
          const newMap = new Map(p.selectedFixedItems);
          newMap.set(itemName, checked);
          return { ...p, selectedFixedItems: newMap };
        }),
      );
    },
    [],
  );

  const handleFixedQtyChange = useCallback(
    (procedureName: string, itemName: string, qty: string) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;
          const newMap = new Map(p.fixedQtyEdits);
          newMap.set(itemName, qty);
          return { ...p, fixedQtyEdits: newMap };
        }),
      );
    },
    [],
  );

  const handleAddInstrument = useCallback(
    (procedureName: string, instrument: string) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;
          if (p.instruments.includes(instrument)) return p;
          return { ...p, instruments: [...p.instruments, instrument] };
        }),
      );
    },
    [],
  );

  const handleRemoveInstrument = useCallback(
    (procedureName: string, instrument: string) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;
          return {
            ...p,
            instruments: p.instruments.filter((i) => i !== instrument),
          };
        }),
      );
    },
    [],
  );

  const handleAddItem = useCallback(
    (procedureName: string, itemName: string) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name === procedureName && !p.items.includes(itemName)) {
            return { ...p, items: [...p.items, itemName] };
          }
          return p;
        }),
      );
    },
    [],
  );

  const handleRemoveFixedItemPart = useCallback(
    (procedureName: string, itemName: string, partToRemove: string) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;

          const qtyMap = new Map(p.fixedQtyEdits);
          const selectedMap = new Map(p.selectedFixedItems);
          const locationMap = { ...(p.fixedItemLocationMapping || {}) };
          const imageMap = { ...(p.fixedItemImageMapping || {}) };

          // Find the fixed item and remove the part
          const updatedFixedItems = p.fixedItems.map((item) => {
            if (item.name === itemName) {
              const partToRemoveTrimmed = partToRemove.trim();
              const { title, parts } = parseItemNameParts(itemName);

              let newName = itemName;
              let newQtyNum = 1;

              if (parts.length > 0) {
                const remainingParts = parts.filter(
                  (pt) =>
                    pt.partToRemove.toLowerCase() !==
                      partToRemoveTrimmed.toLowerCase() &&
                    pt.display.toLowerCase() !==
                      partToRemoveTrimmed.toLowerCase(),
                );

                if (remainingParts.length > 0) {
                  let cleanTitle = title;
                  const formattedList = remainingParts
                    .map((pt) => pt.display)
                    .join(", ");
                  newName = `${cleanTitle} ${formattedList}`;
                  if (cleanTitle.includes("(") && !newName.endsWith(")")) {
                    newName += ")";
                  }
                  newQtyNum = remainingParts.length;
                } else {
                  newName = title.replace(/\($/, "").trim();
                  newQtyNum = 1;
                }
              } else {
                // Fallback split for non-standard items
                const rawParts = itemName
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean);
                const updatedParts = rawParts.filter(
                  (part) =>
                    !part
                      .toLowerCase()
                      .includes(partToRemoveTrimmed.toLowerCase()),
                );
                newName =
                  updatedParts.length > 0 ? updatedParts.join(", ") : itemName;
                newQtyNum = updatedParts.length > 0 ? updatedParts.length : 1;
              }

              if (newName !== itemName && newName.trim().length > 0) {
                const newQtyStr = String(newQtyNum);

                // Update fixedQtyEdits map
                qtyMap.delete(itemName);
                qtyMap.set(newName.trim(), newQtyStr);

                // Update selectedFixedItems map
                const wasSelected = selectedMap.get(itemName);
                if (wasSelected !== undefined) {
                  selectedMap.delete(itemName);
                  selectedMap.set(newName.trim(), wasSelected);
                }

                // Update location & image mappings
                if (locationMap[itemName]) {
                  locationMap[newName.trim()] = locationMap[itemName];
                  delete locationMap[itemName];
                }
                if (imageMap[itemName]) {
                  imageMap[newName.trim()] = imageMap[itemName];
                  delete imageMap[itemName];
                }

                return { ...item, name: newName.trim(), qty: newQtyStr };
              }
            }
            return item;
          });

          return {
            ...p,
            fixedItems: updatedFixedItems,
            fixedQtyEdits: qtyMap,
            selectedFixedItems: selectedMap,
            fixedItemLocationMapping: locationMap,
            fixedItemImageMapping: imageMap,
          };
        }),
      );
    },
    [],
  );

  const handleRemoveSelectableItemPart = useCallback(
    (procedureName: string, itemName: string, partToRemove: string) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;

          const updatedItems = p.items.map((item) => {
            const match = item.match(/^(.+?)\s*\{(.+)\}$/);
            const rawName = match ? match[1].trim() : item.trim();
            const metaStr = match ? match[2] : null;

            if (rawName === itemName) {
              const partToRemoveTrimmed = partToRemove.trim();
              const { title, parts } = parseItemNameParts(itemName);

              let newName = itemName;
              if (parts.length > 0) {
                const remainingParts = parts.filter(
                  (pt) =>
                    pt.partToRemove.toLowerCase() !==
                      partToRemoveTrimmed.toLowerCase() &&
                    pt.display.toLowerCase() !==
                      partToRemoveTrimmed.toLowerCase(),
                );

                if (remainingParts.length > 0) {
                  let cleanTitle = title;
                  const formattedList = remainingParts
                    .map((pt) => pt.display)
                    .join(", ");
                  newName = `${cleanTitle} ${formattedList}`;
                  if (cleanTitle.includes("(") && !newName.endsWith(")")) {
                    newName += ")";
                  }
                } else {
                  newName = title
                    .replace(/\($/, "")
                    .replace(/x\s*$/i, "")
                    .trim();
                  if (newName.endsWith("(")) {
                    newName = newName.slice(0, -1).trim();
                  }
                }
              } else {
                const rawParts = itemName
                  .split(/[,\r\n]+/)
                  .map((part) => part.trim())
                  .filter(Boolean);
                const updatedParts = rawParts.filter(
                  (part) =>
                    !part
                      .toLowerCase()
                      .includes(partToRemoveTrimmed.toLowerCase()),
                );
                newName =
                  updatedParts.length > 0 ? updatedParts.join(", ") : itemName;
              }

              if (newName !== rawName && newName.trim().length > 0) {
                return metaStr
                  ? `${newName.trim()} {${metaStr}}`
                  : newName.trim();
              }
            }
            return item;
          });

          // Update selectedItems map - find items that were updated
          const selectedMap = new Map(p.selectedItems);
          updatedItems.forEach((item) => {
            const match = item.match(/^(.+?)\s*\{(.+)\}$/);
            const newName = match ? match[1].trim() : item.trim();
            const oldItem = p.items.find((oldItem) => {
              const oldMatch = oldItem.match(/^(.+?)\s*\{(.+)\}$/);
              const oldName = oldMatch ? oldMatch[1].trim() : oldItem.trim();
              return oldName === itemName;
            });

            if (oldItem && newName !== itemName) {
              const selectedItem = selectedMap.get(itemName);
              if (selectedItem) {
                selectedMap.delete(itemName);
                selectedMap.set(newName, selectedItem);
              }
            }
          });

          return { ...p, items: updatedItems, selectedItems: selectedMap };
        }),
      );
    },
    [],
  );

  const handleResetFixedItem = useCallback(
    (procedureName: string, itemName: string) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;

          const masterProc = procedures.find(
            (mp) => mp.name === p.name || (mp.docId && mp.docId === p.docId),
          );
          const origList = p.originalFixedItems || masterProc?.fixedItems || [];
          const currentTitle = parseItemNameParts(itemName).title;

          const origMatch = origList.find((fi) => {
            if (fi.name === itemName) return true;
            const origTitle = parseItemNameParts(fi.name).title;
            return (
              currentTitle &&
              origTitle &&
              currentTitle.toLowerCase() === origTitle.toLowerCase()
            );
          });

          if (!origMatch || origMatch.name === itemName) return p;

          const qtyMap = new Map(p.fixedQtyEdits);
          const selectedMap = new Map(p.selectedFixedItems);
          const locationMap = { ...(p.fixedItemLocationMapping || {}) };
          const imageMap = { ...(p.fixedItemImageMapping || {}) };

          const updatedFixedItems = p.fixedItems.map((item) => {
            if (item.name === itemName) {
              return { name: origMatch.name, qty: origMatch.qty };
            }
            return item;
          });

          qtyMap.delete(itemName);
          qtyMap.set(origMatch.name, origMatch.qty);

          const wasSelected = selectedMap.get(itemName);
          selectedMap.delete(itemName);
          selectedMap.set(
            origMatch.name,
            wasSelected !== undefined ? wasSelected : true,
          );

          if (locationMap[itemName]) {
            locationMap[origMatch.name] = locationMap[itemName];
            delete locationMap[itemName];
          }
          if (imageMap[itemName]) {
            imageMap[origMatch.name] = imageMap[itemName];
            delete imageMap[itemName];
          }

          return {
            ...p,
            fixedItems: updatedFixedItems,
            fixedQtyEdits: qtyMap,
            selectedFixedItems: selectedMap,
            fixedItemLocationMapping: locationMap,
            fixedItemImageMapping: imageMap,
          };
        }),
      );
    },
    [procedures],
  );

  const handleResetSelectableItem = useCallback(
    (procedureName: string, itemName: string) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;

          const masterProc = procedures.find(
            (mp) => mp.name === p.name || (mp.docId && mp.docId === p.docId),
          );
          const origList = p.originalItems || masterProc?.items || [];
          const currentTitle = parseItemNameParts(itemName).title;

          const origMatch = origList.find((origStr) => {
            const rawOrigName = origStr.replace(/\s*\{.+?\}$/, "").trim();
            if (rawOrigName === itemName) return true;
            const origTitle = parseItemNameParts(rawOrigName).title;
            return (
              currentTitle &&
              origTitle &&
              currentTitle.toLowerCase() === origTitle.toLowerCase()
            );
          });

          if (!origMatch) return p;
          const rawOrigName = origMatch.replace(/\s*\{.+?\}$/, "").trim();
          if (rawOrigName === itemName) return p;

          const updatedItems = p.items.map((item) => {
            const match = item.match(/^(.+?)\s*\{(.+)\}$/);
            const rawName = match ? match[1].trim() : item.trim();
            if (rawName === itemName) {
              return origMatch;
            }
            return item;
          });

          return {
            ...p,
            items: updatedItems,
          };
        }),
      );
    },
    [procedures],
  );

  const handlePrint = () => {
    if (!hospitalName || !dcNo || !receivedBy) {
      setShowSettingsModal(true);
      return;
    }
    setShowPrintModal(true);
  };

  const normalizedItemSuggestions = useMemo(() => {
    const suggestions = searchItems(manualItemQuery);
    const normalized = suggestions
      .map((s) => s.match(/^(.+?)\s*\{/)?.[1]?.trim() || s.trim())
      .filter(Boolean);
    return Array.from(new Set(normalized)).slice(0, 10);
  }, [manualItemQuery, searchItems]);

  const instrumentSuggestions = useMemo(() => {
    return searchInstruments(manualInstrumentQuery).slice(0, 10);
  }, [manualInstrumentQuery, searchInstruments]);

  useEffect(() => {
    if (!manualItemSuggestionsOpen) return;
    const q = manualItemQuery.trim().toLowerCase();
    if (!q) return;
    const matchIdx = normalizedItemSuggestions.findIndex(
      (s) => s.toLowerCase() === q,
    );
    if (matchIdx >= 0 && matchIdx !== manualItemActiveIndex) {
      setManualItemActiveIndex(matchIdx);
    }
  }, [
    manualItemActiveIndex,
    manualItemQuery,
    manualItemSuggestionsOpen,
    normalizedItemSuggestions,
  ]);

  const selectManualItemSuggestion = useCallback((value: string) => {
    setManualItemName(value);
    setManualItemQuery(value);
    setManualItemSuggestionsOpen(false);
    setManualItemActiveIndex(-1);
  }, []);

  const selectManualInstrumentSuggestion = useCallback((value: string) => {
    setManualInstruments((prev) =>
      prev.includes(value) ? prev : [...prev, value],
    );
    setManualInstrumentQuery("");
    setManualInstrumentSuggestionsOpen(false);
    setManualInstrumentActiveIndex(-1);
  }, []);

  const buildSavePayload = useCallback(() => {
    const items: Array<{
      name: string;
      sizes: { size: string; qty: number }[];
      procedure: string;
      isSelectable: boolean;
    }> = [];
    const instruments = new Set<string>();
    const boxNumbers: string[] = [];

    activeProcedures.forEach((procedure) => {
      const procedureMaterial = procedure.materialType || "SS";
      procedure.selectedItems.forEach((item, itemName) => {
        const displayName =
          procedureMaterial !== "None"
            ? `${procedureMaterial} ${itemName}`
            : itemName;
        items.push({
          name: displayName,
          sizes: item.sizeQty.map((sq) => ({
            size: sq.size,
            qty: parseInt(sq.qty) || 1,
          })),
          procedure: procedure.name,
          isSelectable: true,
        });
      });

      procedure.fixedItems.forEach((fixedItem) => {
        const isSelected =
          procedure.selectedFixedItems.get(fixedItem.name) ?? true;
        if (isSelected) {
          const editedQty =
            procedure.fixedQtyEdits.get(fixedItem.name) ?? fixedItem.qty;
          const displayName =
            procedureMaterial !== "None"
              ? `${procedureMaterial} ${fixedItem.name}`
              : fixedItem.name;
          items.push({
            name: displayName,
            sizes: [{ size: "", qty: parseInt(editedQty) || 1 }],
            procedure: procedure.name,
            isSelectable: false,
          });
        }
      });

      procedure.instruments.forEach((inst) => instruments.add(inst));
      if (procedure.boxNumbers && procedure.boxNumbers.length > 0) {
        boxNumbers.push(...procedure.boxNumbers);
      }
    });

    // Manual DC items (all selectable, no fixed items)
    manualItems.forEach((mi) => {
      const displayName =
        manualMaterialType !== "None"
          ? `${manualMaterialType} ${mi.name}`
          : mi.name;
      items.push({
        name: displayName,
        sizes: [{ size: mi.size || "", qty: mi.qty }],
        procedure: "Manual",
        isSelectable: true,
      });
    });
    manualInstruments.forEach((inst) => instruments.add(inst));
    if (manualBoxNumbers.length > 0) {
      boxNumbers.push(...manualBoxNumbers);
    }

    return { items, instruments: Array.from(instruments), boxNumbers };
  }, [
    activeProcedures,
    manualItems,
    manualInstruments,
    manualBoxNumbers,
    manualMaterialType,
  ]);

  const handleClearManualEntry = useCallback(() => {
    setManualItems([]);
    setManualInstruments([]);
    setManualBoxNumbers([]);
    setManualItemQuery("");
    setManualItemName("");
    setManualItemSize("");
    setManualItemQty("1");
    setManualInstrumentQuery("");
    setManualBoxInput("");
    setHospitalName("");
    setDoctorName("");
    setDcNo("");
    setReceivedBy("");
    setDeliveredBy("");
    setRemarks("");
  }, []);

  const handleHospitalChange = useCallback(
    (newHospital: string) => {
      // If selecting a different hospital, clear doctor field so previous hospital's doctor doesn't remain
      if (
        newHospital.trim().toLowerCase() !== hospitalName.trim().toLowerCase()
      ) {
        setDoctorName("");
      }
      setHospitalName(newHospital);
    },
    [hospitalName],
  );

  const handleSaveDc = useCallback(
    async (
      shouldNavigate: boolean = true,
      shouldClear: boolean = true,
      isPrintAfter: boolean = false,
      skipDuplicateCheck: boolean = false,
      overrideHospitalName?: string,
    ): Promise<boolean> => {
      const activeHospital = (overrideHospitalName || hospitalName).trim();
      if (!activeHospital || !dcNo || !receivedBy || !deliveredBy) {
        setShowSettingsModal(true);
        return false;
      }
      if (
        activeProcedures.length === 0 &&
        manualItems.length === 0 &&
        manualInstruments.length === 0 &&
        manualBoxNumbers.length === 0
      ) {
        toast({
          title: "Nothing to save",
          description:
            "Add procedures or use Manual DC to add items/instruments.",
        });
        return false;
      }

      // Near-duplicate hospital check: prompt user if entered name resembles existing registered profile
      if (!skipDuplicateCheck) {
        const existingCustomers = getSavedCustomers();
        const exactMatch = existingCustomers.find(
          (c) => c.name.trim().toLowerCase() === activeHospital.toLowerCase(),
        );

        if (!exactMatch) {
          const duplicateMatch = findNearDuplicateHospital(
            activeHospital,
            existingCustomers,
            0.75,
          );
          if (duplicateMatch) {
            setDuplicatePrompt({
              enteredName: activeHospital,
              duplicateResult: duplicateMatch,
              shouldNavigate,
              shouldClear,
              isPrintAfter,
            });
            return false;
          }
        }
      }

      setIsSavingDc(true);
      try {
        const { items, instruments, boxNumbers } = buildSavePayload();
        const dcMaterialType = (() => {
          const types = new Set<string>();
          activeProcedures.forEach((p) => types.add(p.materialType || "SS"));
          if (manualItems.length > 0) types.add(manualMaterialType || "SS");
          const arr = Array.from(types);
          if (arr.length === 0) return "SS";
          if (arr.length === 1) return arr[0];
          return "Mixed";
        })();

        await saveSavedDc({
          hospitalName: activeHospital,
          dcNo,
          doctorName: doctorName.trim() || undefined,
          materialType: dcMaterialType,
          deliveredBy,
          receivedBy,
          remarks,
          items,
          instruments,
          boxNumbers,
          customAt: customDcDate
            ? new Date(customDcDate).toISOString()
            : undefined,
        });

        // Ensure hospital name is automatically registered in customer directory on the fly
        if (activeHospital) {
          saveCustomer({
            name: activeHospital,
            contactPerson: doctorName.trim() ? doctorName.trim() : undefined,
          }).catch((err) =>
            console.error(
              "Auto-sync hospital to customer directory error:",
              err,
            ),
          );
        }

        // Ensure doctor name is saved to doctor recommendations roster
        if (doctorName.trim()) {
          saveDoctorName(doctorName.trim());
        }

        toast({
          title: "DC saved successfully",
          description: `${activeHospital} · ${dcNo}`,
        });

        // Reload recent DCs
        const dcs = await loadSavedDcs();
        setRecentSavedDcs(dcs.slice(0, 6));

        if (shouldNavigate) {
          // Show 2-second animated loading bar overlay for seamless transition
          setSavingOverlay({
            open: true,
            hospitalName: activeHospital,
            dcNo,
            progress: 30,
          });

          setTimeout(() => {
            setSavingOverlay((prev) => ({ ...prev, progress: 75 }));
          }, 600);

          setTimeout(() => {
            setSavingOverlay((prev) => ({ ...prev, progress: 100 }));
          }, 1400);

          setTimeout(() => {
            if (shouldClear) {
              setShowSettingsModal(false);
              setShowPrintModal(false);
              setDcMode("procedure");
              setActiveProcedures([]);
              setCollapsedProcedures(new Set());
              setInitialFilterType("None");
              setShowProcedureSelector(true);
              setManualMaterialType("SS");
              handleClearManualEntry();
              setCustomDcDate(new Date().toISOString().split("T")[0]);
              setDoctorName("");
              setHospitalName("");
            }
            setSavingOverlay({ open: false });
            navigate("/saved");
          }, 2000);
        } else if (shouldClear) {
          setShowSettingsModal(false);
          setShowPrintModal(false);
          setDcMode("procedure");
          setActiveProcedures([]);
          setCollapsedProcedures(new Set());
          setInitialFilterType("None");
          setShowProcedureSelector(true);
          setManualMaterialType("SS");
          handleClearManualEntry();
          setCustomDcDate(new Date().toISOString().split("T")[0]);
          setDoctorName("");
          setHospitalName("");
        }

        return true;
      } catch (error) {
        console.error("Error saving DC:", error);
        toast({
          title: "Error saving DC",
          description:
            error instanceof Error
              ? error.message
              : "Failed to save DC to Google Sheets",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsSavingDc(false);
      }
    },
    [
      activeProcedures,
      buildSavePayload,
      customDcDate,
      dcNo,
      deliveredBy,
      doctorName,
      handleClearManualEntry,
      hospitalName,
      manualBoxNumbers.length,
      manualInstruments.length,
      manualItems.length,
      manualMaterialType,
      navigate,
      receivedBy,
      remarks,
      toast,
    ],
  );

  const handleSavePDF = async () => {
    if (!printRef.current) return;
    const opt = {
      margin: 10,
      filename: `SRR-Ortho-Implant-DC-${dcNo || "draft"}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: "mm" as const,
        format: "a4" as const,
        orientation: "portrait" as const,
      },
    };
    await html2pdf().set(opt).from(printRef.current).save();
  };

  const handlePrintPDF = async () => {
    if (!printRef.current) return;
    const opt = {
      margin: 10,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: "mm" as const,
        format: "a4" as const,
        orientation: "portrait" as const,
      },
    };
    const pdf = await html2pdf()
      .set(opt)
      .from(printRef.current)
      .outputPdf("blob");
    const blobUrl = URL.createObjectURL(pdf);
    const printWindow = window.open(blobUrl);
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("srrortho:auth");
    localStorage.removeItem("srrortho:procedures_cache");
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleAddBox = useCallback(
    (procedureName: string, boxNumber: string) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;
          const trimmed = boxNumber.trim();
          if (trimmed && !p.boxNumbers.includes(trimmed)) {
            return { ...p, boxNumbers: [...p.boxNumbers, trimmed] };
          }
          return p;
        }),
      );
    },
    [],
  );

  const handleRemoveBox = useCallback(
    (procedureName: string, index: number) => {
      setActiveProcedures((prev) =>
        prev.map((p) => {
          if (p.name !== procedureName) return p;
          return {
            ...p,
            boxNumbers: p.boxNumbers.filter((_, i) => i !== index),
          };
        }),
      );
    },
    [],
  );

  // Legacy login screen logic removed
  // if (!isAuthenticated) { return <LoginScreen ... />; }

  return (
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden">
      <div className="min-h-screen">
        {/* Main Content */}
        <main className="flex-grow flex flex-col w-full px-1.5 sm:px-3 lg:px-4 py-2 sm:py-2.5 overflow-x-hidden">
          {/* Top toolbar (desktop & mobile) */}
          <TopToolbar
            theme={theme}
            toggleTheme={toggleTheme}
            fetchProcedures={fetchProcedures}
            loading={loading}
            handlePrint={handlePrint}
            navigate={navigate}
            handleLogout={handleLogout}
            setDcMode={handleSwitchDcMode}
            setInitialFilterType={setInitialFilterType}
            setShowProcedureSelector={setShowProcedureSelector}
            setActiveProcedures={setActiveProcedures}
            setCollapsedProcedures={setCollapsedProcedures}
          />
          {(() => {
            const hasData =
              activeProcedures.length > 0 ||
              manualItems.length > 0 ||
              manualInstruments.length > 0 ||
              manualBoxNumbers.length > 0;
            return (
              <div
                className={`grid ${hasData ? "lg:grid-cols-3" : "grid-cols-1"} gap-4 sm:gap-6`}
              >
                {/* Left: Procedure Selection & Active Procedures */}
                <div
                  className={`${hasData ? "lg:col-span-2" : "col-span-1"} space-y-4 sm:space-y-6 min-w-0`}
                >
                  {/* Active Procedures - Show first if they exist */}
                  {activeProcedures.length > 0 && (
                    <div className="space-y-3 sm:space-y-4">
                      <h2 className="font-sans font-semibold text-base sm:text-lg">
                        Active Procedures
                      </h2>
                      {activeProcedures.map((procedure, index) => (
                        <ProcedureCard
                          key={procedure.name}
                          procedure={procedure}
                          masterProcedures={procedures}
                          index={index}
                          isCollapsed={collapsedProcedures.has(procedure.name)}
                          onToggleCollapse={() =>
                            setCollapsedProcedures((prev) => {
                              const next = new Set(prev);
                              next.has(procedure.name)
                                ? next.delete(procedure.name)
                                : next.add(procedure.name);
                              return next;
                            })
                          }
                          onRemove={() => handleRemoveProcedure(procedure.name)}
                          onRefresh={() =>
                            handleRefreshProcedure(procedure.name)
                          }
                          onMaterialTypeChange={(t) =>
                            handleProcedureMaterialTypeChange(procedure.name, t)
                          }
                          onItemToggle={(item, checked) =>
                            handleItemToggle(procedure.name, item, checked)
                          }
                          onSizeQtyChange={(item, sq) =>
                            handleSizeQtyChange(procedure.name, item, sq)
                          }
                          onFixedItemToggle={(item, checked) =>
                            handleFixedItemToggle(procedure.name, item, checked)
                          }
                          onFixedQtyChange={(item, qty) =>
                            handleFixedQtyChange(procedure.name, item, qty)
                          }
                          onAddInstrument={(inst) =>
                            handleAddInstrument(procedure.name, inst)
                          }
                          onRemoveInstrument={(inst) =>
                            handleRemoveInstrument(procedure.name, inst)
                          }
                          onAddItem={(item) =>
                            handleAddItem(procedure.name, item)
                          }
                          onSearchItems={searchItems}
                          instrumentSuggestions={[]}
                          onSearchInstruments={searchInstruments}
                          onRemoveFixedItemPart={(item, part) =>
                            handleRemoveFixedItemPart(
                              procedure.name,
                              item,
                              part,
                            )
                          }
                          onRemoveSelectableItemPart={(item, part) =>
                            handleRemoveSelectableItemPart(
                              procedure.name,
                              item,
                              part,
                            )
                          }
                          onResetFixedItem={(item) =>
                            handleResetFixedItem(procedure.name, item)
                          }
                          onResetSelectableItem={(item) =>
                            handleResetSelectableItem(procedure.name, item)
                          }
                          onAddBox={(boxNumber) =>
                            handleAddBox(procedure.name, boxNumber)
                          }
                          onRemoveBox={(index) =>
                            handleRemoveBox(procedure.name, index)
                          }
                        />
                      ))}
                    </div>
                  )}

                  {/* Mode Panel (Welcome Card Choice vs Procedure List vs Manual DC) */}
                  {!new URLSearchParams(location.search).get("mode") &&
                  activeProcedures.length === 0 ? (
                    <div className="bg-card rounded-xl p-6 sm:p-10 border shadow-sm text-center space-y-6 max-w-5xl mx-auto my-4">
                      <div className="space-y-2">
                        <h2 className="text-2xl sm:text-3xl font-sans font-extrabold text-slate-900 dark:text-slate-100">
                          Welcome to SRR Ortho Plus Portal
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground">
                          Select a service to generate delivery challans, create
                          quotations, or track saved records.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 w-full">
                        {/* Card 1: Create DC */}
                        <button
                          onClick={() => {
                            setDcMode("procedure");
                            setInitialFilterType("All");
                            setShowProcedureSelector(true);
                            navigate("/?mode=procedure");
                          }}
                          className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20 hover:border-teal-500 transition-all duration-200 shadow-sm text-center"
                        >
                          <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow group-hover:scale-110 transition-transform flex-shrink-0">
                            <Plus className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 leading-tight">
                              Create DC
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug hidden sm:block">
                              Browse procedures &amp; select items for a new DC.
                            </p>
                          </div>
                        </button>

                        {/* Card 2: Cash Invoice */}
                        <button
                          onClick={() => navigate("/cash-invoice")}
                          className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-500 transition-all duration-200 shadow-sm text-center"
                        >
                          <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow group-hover:scale-110 transition-transform flex-shrink-0">
                            <Receipt className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 leading-tight">
                              Cash Invoice
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug hidden sm:block">
                              Create cash bills for walk-in sales.
                            </p>
                          </div>
                        </button>

                        {/* Card 3: Bank Accounts */}
                        <button
                          onClick={() => navigate("/bank-accounts")}
                          className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500 transition-all duration-200 shadow-sm text-center"
                        >
                          <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow group-hover:scale-110 transition-transform flex-shrink-0">
                            <Landmark className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 leading-tight">
                              Bank Accounts
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug hidden sm:block">
                              Ledger &amp; link cash receipts.
                            </p>
                          </div>
                        </button>

                        {/* Card 3: Create Quotation */}
                        <button
                          onClick={() => navigate("/quotation")}
                          className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-500 transition-all duration-200 shadow-sm text-center text-slate-900"
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow group-hover:scale-110 transition-transform flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-tight">
                              Create Quotation
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug hidden sm:block">
                              Generate official price quotes &amp; docs.
                            </p>
                          </div>
                        </button>

                        {/* Card 4: DC Tracker */}
                        <button
                          onClick={() => navigate("/saved")}
                          className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-amber-400/50 bg-amber-400/10 hover:bg-amber-400/20 hover:border-amber-400 transition-all duration-200 shadow-sm text-center"
                        >
                          <div className="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow group-hover:scale-110 transition-transform flex-shrink-0">
                            <List className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-amber-500 leading-tight">
                              DC Tracker
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug hidden sm:block">
                              View, track &amp; manage saved DCs.
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : dcMode === "procedure" || dcMode === "manual" ? (
                    <>                      {/* Step 1: Ask Hospital Details FIRST for Auto and Manual DC */}
                      {autoDcStep === "details" ? (
                        <Card className="max-w-3xl mx-auto my-4 border-slate-200 dark:border-slate-800 shadow-sm">
                          <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                                  1
                                </div>
                                <div>
                                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                                    Hospital &amp; Delivery Details
                                  </CardTitle>
                                  <CardDescription className="text-xs">
                                    Fill in header details to begin building your Delivery Challan.
                                  </CardDescription>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs font-semibold">
                                {dcMode === "manual" ? "Manual DC" : "Auto DC"}
                              </Badge>
                            </div>
                          </CardHeader>

                          <CardContent className="pt-5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  Hospital / Clinic Name <span className="text-rose-500">*</span>
                                </Label>
                                <div className="mt-1">
                                  <HospitalSelect
                                    id="hospital-name-input-step1"
                                    value={hospitalName}
                                    onChange={handleHospitalChange}
                                    placeholder="Search or select hospital name..."
                                  />
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  Doctor / Surgeon Name
                                </Label>
                                <div className="mt-1">
                                  <DoctorSelect
                                    id="doctor-name-input-step1"
                                    value={doctorName}
                                    onChange={setDoctorName}
                                    hospitalName={hospitalName}
                                    placeholder="Select Dr. Name..."
                                  />
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  DC Number <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                  value={dcNo}
                                  onChange={(e) => setDcNo(e.target.value)}
                                  placeholder="e.g. 1024"
                                  className="mt-1 h-9 text-xs sm:text-sm font-semibold"
                                />
                              </div>

                              <div>
                                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  Delivered By
                                </Label>
                                <div className="mt-1">
                                  <PersonnelSelect
                                    value={deliveredBy}
                                    onChange={setDeliveredBy}
                                    placeholder="Select delivery personnel..."
                                  />
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  DC Date
                                </Label>
                                <Input
                                  type="date"
                                  value={customDcDate}
                                  onChange={(e) =>
                                    setCustomDcDate(e.target.value)
                                  }
                                  className="mt-1 h-9 text-xs font-medium"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                                  Received By
                                </Label>
                                <ReceivedBySelect
                                  value={receivedBy}
                                  onChange={setReceivedBy}
                                />
                              </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                              <Button
                                onClick={() => {
                                  if (!hospitalName.trim()) {
                                    toast({
                                      title: "Hospital Name Required",
                                      description:
                                        "Please select or enter a hospital name to proceed.",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  if (!dcNo.trim()) {
                                    toast({
                                      title: "DC Number Required",
                                      description:
                                        "Please enter a valid DC Number to proceed.",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  setAutoDcStep("procedures");
                                }}
                                className="w-full sm:w-auto h-9 px-6 text-xs font-semibold gap-1.5 bg-teal-700 hover:bg-teal-800 text-white shadow-xs"
                              >
                                <span>
                                  {dcMode === "manual"
                                    ? "Continue to Manual DC"
                                    : "Continue to Select Procedures"}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <>
                          {/* Compact Header Summary Bar showing submitted hospital details */}
                          <div className="rounded-xl p-3 border-2 border-teal-500/30 dark:border-teal-800 bg-teal-50/90 dark:bg-slate-900/90 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1 flex-wrap">
                              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                ✓
                              </div>
                              <div className="flex items-center gap-3 text-xs flex-wrap">
                                <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                  <Building2 className="w-3.5 h-3.5 text-teal-600" />
                                  {hospitalName || "Hospital Not Set"}
                                </span>
                                {doctorName && (
                                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                    <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                                    {doctorName}
                                  </span>
                                )}
                                {dcNo && (
                                  <Badge
                                    variant="outline"
                                    className="bg-white dark:bg-slate-950 text-teal-800 dark:text-teal-300 font-mono font-bold text-[11px]"
                                  >
                                    DC #{dcNo}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAutoDcStep("details")}
                              className="h-8 text-xs font-bold gap-1 border-teal-300 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-950 shrink-0"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Edit Details
                            </Button>
                          </div>

                          {dcMode === "procedure" ? (
                            /* Step 2: Procedure Selector Grid */
                            (activeProcedures.length === 0 ||
                              showProcedureSelector) && (
                              <div className="bg-card border rounded-xl p-4 min-w-0 flex-1 flex flex-col min-h-[400px] shadow-sm">
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                                  <h2 className="font-sans font-semibold text-base sm:text-lg text-foreground flex items-center gap-2">
                                    Step 2: Select Procedure
                                  </h2>
                                  {activeProcedures.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setShowProcedureSelector(false)
                                      }
                                      className="text-xs font-bold text-muted-foreground hover:text-foreground"
                                    >
                                      Hide Selector
                                    </Button>
                                  )}
                                </div>
                                {loading ? (
                                  <AppLoadingSpinner
                                    message="Loading Procedures..."
                                    subtext="Fetching procedure catalogs from Firestore database"
                                  />
                                ) : (
                                  <ProcedureSelector
                                    procedures={procedures}
                                    procedureTypes={procedureTypes}
                                    activeProcedureNames={activeProcedures.map(
                                      (p) => p.name,
                                    )}
                                    onSelectProcedure={handleSelectProcedure}
                                    searchProcedures={searchProcedures}
                                    initialFilterType={initialFilterType}
                                  />
                                )}
                              </div>
                            )
                          ) : (
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div>
                                  <h2 className="font-sans font-semibold text-base sm:text-lg">
                                    Manual DC
                                  </h2>
                                  <div className="text-xs text-muted-foreground">
                                    Add items/instruments/boxes manually
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Select
                                    value={manualMaterialType}
                                    onValueChange={setManualMaterialType}
                                  >
                                    <SelectTrigger className="h-8 sm:h-9 w-[100px] sm:w-[140px] text-xs bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="SS">SS</SelectItem>
                                      <SelectItem value="Titanium">
                                        Titanium
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs border-2 border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                                    onClick={handleClearManualEntry}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />{" "}
                                    <span className="hidden xs:inline">
                                      Clear
                                    </span>
                                    <span className="xs:hidden">×</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs border-border/70 bg-background/70"
                                    onClick={() => {
                                      handleSwitchDcMode("procedure");
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />{" "}
                                    <span className="hidden sm:inline">
                                      Auto DC
                                    </span>
                                    <span className="sm:hidden">Auto DC</span>
                                  </Button>
                                </div>
                              </div>

                              {/* Items */}
                              <div className="rounded-xl border border-border/60 bg-background/70 p-2.5 sm:p-4 space-y-3 border-l-4 border-l-blue-600/40">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-semibold">
                                        Items
                                      </span>
                                      <span className="text-xs text-muted-foreground hidden sm:inline">
                                        Search → select → add
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground font-medium">
                                    {manualItems.length} added
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {/* Item search */}
                                  <div className="relative">
                                    <Label className="text-xs">Item</Label>
                                    <div className="relative mt-1">
                                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                      <Input
                                        value={manualItemQuery}
                                        onChange={(e) => {
                                          setManualItemQuery(e.target.value);
                                          setManualItemName(e.target.value);
                                          setManualItemSuggestionsOpen(true);
                                          setManualItemActiveIndex(0);
                                        }}
                                        onFocus={() => {
                                          if (
                                            manualItemQuery.trim().length > 0
                                          ) {
                                            setManualItemSuggestionsOpen(true);
                                            setManualItemActiveIndex((idx) =>
                                              idx < 0 ? 0 : idx,
                                            );
                                          }
                                        }}
                                        onBlur={() => {
                                          // allow click selection to run first
                                          setTimeout(
                                            () =>
                                              setManualItemSuggestionsOpen(
                                                false,
                                              ),
                                            120,
                                          );
                                        }}
                                        onKeyDown={(e) => {
                                          const hasSuggestions =
                                            normalizedItemSuggestions.length >
                                              0 &&
                                            manualItemQuery.trim().length > 0;
                                          if (!hasSuggestions) return;

                                          if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            setManualItemSuggestionsOpen(true);
                                            setManualItemActiveIndex((idx) => {
                                              const next =
                                                idx < 0
                                                  ? 0
                                                  : Math.min(
                                                      idx + 1,
                                                      normalizedItemSuggestions.length -
                                                        1,
                                                    );
                                              return next;
                                            });
                                          } else if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            setManualItemSuggestionsOpen(true);
                                            setManualItemActiveIndex((idx) => {
                                              const next =
                                                idx < 0
                                                  ? normalizedItemSuggestions.length -
                                                    1
                                                  : Math.max(idx - 1, 0);
                                              return next;
                                            });
                                          } else if (
                                            e.key === "Enter" ||
                                            e.key === "Tab"
                                          ) {
                                            if (manualItemSuggestionsOpen) {
                                              const idx =
                                                manualItemActiveIndex >= 0
                                                  ? manualItemActiveIndex
                                                  : 0;
                                              const v =
                                                normalizedItemSuggestions[idx];
                                              if (v) {
                                                e.preventDefault();
                                                selectManualItemSuggestion(v);
                                              }
                                            }
                                          } else if (e.key === "Escape") {
                                            setManualItemSuggestionsOpen(false);
                                            setManualItemActiveIndex(-1);
                                          }
                                        }}
                                        placeholder="Search items..."
                                        className="pl-8 h-9 bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600"
                                        aria-autocomplete="list"
                                        aria-expanded={
                                          manualItemSuggestionsOpen
                                        }
                                      />
                                    </div>
                                    {manualItemSuggestionsOpen &&
                                      manualItemQuery.trim().length > 0 &&
                                      normalizedItemSuggestions.length > 0 && (
                                        <div
                                          className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-auto"
                                          role="listbox"
                                        >
                                          {normalizedItemSuggestions.map(
                                            (s, idx) => (
                                              <button
                                                key={s}
                                                type="button"
                                                role="option"
                                                aria-selected={
                                                  idx === manualItemActiveIndex
                                                }
                                                className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                                                  idx === manualItemActiveIndex
                                                    ? "bg-blue-600 text-white"
                                                    : "hover:bg-slate-100 text-slate-900"
                                                }`}
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  selectManualItemSuggestion(s);
                                                }}
                                                onMouseEnter={() =>
                                                  setManualItemActiveIndex(idx)
                                                }
                                              >
                                                <div className="flex items-center gap-2">
                                                  <span
                                                    className={`h-1.5 w-1.5 rounded-full ${
                                                      idx ===
                                                      manualItemActiveIndex
                                                        ? "bg-white"
                                                        : "bg-blue-300"
                                                    }`}
                                                  />
                                                  <span className="truncate">
                                                    {s}
                                                  </span>
                                                </div>
                                              </button>
                                            ),
                                          )}
                                        </div>
                                      )}
                                  </div>
                                  {/* Size, Qty, and Add button in a row */}
                                  <div className="grid grid-cols-[1fr_80px_auto] gap-2 items-end">
                                    <div>
                                      <Label className="text-xs">Size</Label>
                                      <Input
                                        value={manualItemSize}
                                        onChange={(e) =>
                                          setManualItemSize(e.target.value)
                                        }
                                        placeholder="Optional"
                                        className="mt-1 h-9 bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Qty</Label>
                                      <Input
                                        type="number"
                                        value={manualItemQty}
                                        onChange={(e) =>
                                          setManualItemQty(e.target.value)
                                        }
                                        min="1"
                                        className="mt-1 h-9 bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      onClick={() => {
                                        const name = manualItemName.trim();
                                        const qtyNum = Math.max(
                                          1,
                                          parseInt(manualItemQty || "1", 10) ||
                                            1,
                                        );
                                        if (!name) {
                                          toast({ title: "Item is required" });
                                          return;
                                        }
                                        setManualItems((prev) => [
                                          ...prev,
                                          {
                                            name,
                                            size: manualItemSize.trim(),
                                            qty: qtyNum,
                                          },
                                        ]);
                                        setManualItemName("");
                                        setManualItemQuery("");
                                        setManualItemSize("");
                                        setManualItemQty("1");
                                      }}
                                      className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm"
                                    >
                                      <Plus className="w-4 h-4" />{" "}
                                      <span className="hidden sm:inline">
                                        Add
                                      </span>
                                    </Button>
                                  </div>
                                </div>

                                {manualItems.length > 0 && (
                                  <div className="rounded-lg border border-border/60 overflow-hidden bg-background/80">
                                    {/* Mobile view */}
                                    <div className="sm:hidden divide-y divide-border/60">
                                      {manualItems.map((it, idx) => (
                                        <div
                                          key={`${it.name}-${idx}`}
                                          className="p-2.5 flex items-start justify-between gap-2"
                                        >
                                          <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium truncate">
                                              {it.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                              Size: {it.size || "-"} • Qty:{" "}
                                              <span className="font-semibold text-foreground">
                                                {it.qty}
                                              </span>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            className="text-muted-foreground hover:text-destructive flex-shrink-0 p-1"
                                            onClick={() =>
                                              setManualItems((prev) =>
                                                prev.filter(
                                                  (_, i) => i !== idx,
                                                ),
                                              )
                                            }
                                            title="Remove item"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                    {/* Desktop view */}
                                    <div className="hidden sm:block">
                                      <div className="grid grid-cols-[1fr_120px_70px_40px] gap-2 px-3 py-2 text-[11px] font-semibold bg-muted/30 border-b border-border/60">
                                        <div>Item</div>
                                        <div>Size</div>
                                        <div className="text-right">Qty</div>
                                        <div />
                                      </div>
                                      <div className="divide-y divide-border/60">
                                        {manualItems.map((it, idx) => (
                                          <div
                                            key={`${it.name}-${idx}`}
                                            className="grid grid-cols-[1fr_120px_70px_40px] gap-2 px-3 py-2 text-sm"
                                          >
                                            <div className="truncate">
                                              {it.name}
                                            </div>
                                            <div className="truncate text-muted-foreground">
                                              {it.size || "-"}
                                            </div>
                                            <div className="text-right font-semibold">
                                              {it.qty}
                                            </div>
                                            <button
                                              type="button"
                                              className="text-muted-foreground hover:text-destructive flex items-center justify-center"
                                              onClick={() =>
                                                setManualItems((prev) =>
                                                  prev.filter(
                                                    (_, i) => i !== idx,
                                                  ),
                                                )
                                              }
                                              title="Remove item"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Instruments */}
                              <div className="rounded-xl border border-border/60 bg-background/70 p-2.5 sm:p-4 space-y-3 border-l-4 border-l-indigo-600/40">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-xs font-semibold">
                                      Instruments
                                    </span>
                                    <span className="text-xs text-muted-foreground hidden sm:inline">
                                      Pick with procedure badge
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground font-medium">
                                    {manualInstruments.length} added
                                  </div>
                                </div>
                                <div className="relative">
                                  <Label className="text-xs">Instrument</Label>
                                  <div className="relative mt-1">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                      value={manualInstrumentQuery}
                                      onChange={(e) => {
                                        setManualInstrumentQuery(
                                          e.target.value,
                                        );
                                        setManualInstrumentSuggestionsOpen(
                                          true,
                                        );
                                        setManualInstrumentActiveIndex(0);
                                      }}
                                      placeholder="Search instruments..."
                                      className="pl-8 h-9 bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600"
                                      onFocus={() => {
                                        if (
                                          manualInstrumentQuery.trim().length >
                                          0
                                        ) {
                                          setManualInstrumentSuggestionsOpen(
                                            true,
                                          );
                                          setManualInstrumentActiveIndex(
                                            (idx) => (idx < 0 ? 0 : idx),
                                          );
                                        }
                                      }}
                                      onBlur={() => {
                                        setTimeout(
                                          () =>
                                            setManualInstrumentSuggestionsOpen(
                                              false,
                                            ),
                                          120,
                                        );
                                      }}
                                      onKeyDown={(e) => {
                                        const hasSuggestions =
                                          instrumentSuggestions.length > 0 &&
                                          manualInstrumentQuery.trim().length >
                                            0;
                                        if (!hasSuggestions) return;

                                        if (e.key === "ArrowDown") {
                                          e.preventDefault();
                                          setManualInstrumentSuggestionsOpen(
                                            true,
                                          );
                                          setManualInstrumentActiveIndex(
                                            (idx) => {
                                              const next =
                                                idx < 0
                                                  ? 0
                                                  : Math.min(
                                                      idx + 1,
                                                      instrumentSuggestions.length -
                                                        1,
                                                    );
                                              return next;
                                            },
                                          );
                                        } else if (e.key === "ArrowUp") {
                                          e.preventDefault();
                                          setManualInstrumentSuggestionsOpen(
                                            true,
                                          );
                                          setManualInstrumentActiveIndex(
                                            (idx) => {
                                              const next =
                                                idx < 0
                                                  ? instrumentSuggestions.length -
                                                    1
                                                  : Math.max(idx - 1, 0);
                                              return next;
                                            },
                                          );
                                        } else if (
                                          e.key === "Enter" ||
                                          e.key === "Tab"
                                        ) {
                                          if (manualInstrumentSuggestionsOpen) {
                                            const idx =
                                              manualInstrumentActiveIndex >= 0
                                                ? manualInstrumentActiveIndex
                                                : 0;
                                            const v =
                                              instrumentSuggestions[idx]
                                                ?.instrument;
                                            if (v) {
                                              e.preventDefault();
                                              selectManualInstrumentSuggestion(
                                                v,
                                              );
                                            }
                                          }
                                        } else if (e.key === "Escape") {
                                          setManualInstrumentSuggestionsOpen(
                                            false,
                                          );
                                          setManualInstrumentActiveIndex(-1);
                                        }
                                      }}
                                      aria-autocomplete="list"
                                      aria-expanded={
                                        manualInstrumentSuggestionsOpen
                                      }
                                    />
                                  </div>
                                  {manualInstrumentSuggestionsOpen &&
                                    manualInstrumentQuery.trim().length > 0 &&
                                    instrumentSuggestions.length > 0 && (
                                      <div
                                        className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-auto"
                                        role="listbox"
                                      >
                                        {instrumentSuggestions.map((s, idx) => (
                                          <button
                                            key={`${s.instrument}-${s.procedureName}`}
                                            type="button"
                                            role="option"
                                            aria-selected={
                                              idx ===
                                              manualInstrumentActiveIndex
                                            }
                                            className={`w-full text-left px-2.5 sm:px-3 py-2 text-sm transition-colors ${
                                              idx ===
                                              manualInstrumentActiveIndex
                                                ? "bg-blue-600 text-white"
                                                : "hover:bg-slate-100"
                                            }`}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              selectManualInstrumentSuggestion(
                                                s.instrument,
                                              );
                                            }}
                                            onMouseEnter={() =>
                                              setManualInstrumentActiveIndex(
                                                idx,
                                              )
                                            }
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                  className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${idx === manualInstrumentActiveIndex ? "bg-white" : "bg-blue-300"}`}
                                                />
                                                <div className="font-medium truncate text-xs sm:text-sm">
                                                  {s.instrument}
                                                </div>
                                              </div>
                                              <Badge
                                                variant="secondary"
                                                className={`h-5 px-1.5 text-[9px] sm:text-[10px] shrink-0 ${
                                                  idx ===
                                                  manualInstrumentActiveIndex
                                                    ? "bg-white/15 text-white border-white/20"
                                                    : ""
                                                }`}
                                              >
                                                {s.procedureName}
                                              </Badge>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                </div>
                                {manualInstruments.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {manualInstruments.map((inst) => (
                                      <span
                                        key={inst}
                                        className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-xs bg-muted/20"
                                      >
                                        {inst}
                                        <button
                                          type="button"
                                          className="text-muted-foreground hover:text-destructive"
                                          onClick={() =>
                                            setManualInstruments((prev) =>
                                              prev.filter((x) => x !== inst),
                                            )
                                          }
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Box Numbers */}
                              <div className="rounded-xl border border-border/60 bg-background/70 p-2.5 sm:p-4 space-y-3 border-l-4 border-l-green-600/40">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-semibold">
                                      Box Numbers
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Optional
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground font-medium">
                                    {manualBoxNumbers.length} added
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Input
                                    value={manualBoxInput}
                                    onChange={(e) =>
                                      setManualBoxInput(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const trimmed = manualBoxInput.trim();
                                        if (!trimmed) return;
                                        setManualBoxNumbers((prev) =>
                                          prev.includes(trimmed)
                                            ? prev
                                            : [...prev, trimmed],
                                        );
                                        setManualBoxInput("");
                                      }
                                    }}
                                    placeholder="Enter box number"
                                    className="flex-1 h-9 bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 px-3 sm:px-4 border-2 border-green-700 bg-green-600 text-white hover:bg-green-700 hover:text-white"
                                    onClick={() => {
                                      const trimmed = manualBoxInput.trim();
                                      if (!trimmed) return;
                                      setManualBoxNumbers((prev) =>
                                        prev.includes(trimmed)
                                          ? prev
                                          : [...prev, trimmed],
                                      );
                                      setManualBoxInput("");
                                    }}
                                  >
                                    Add
                                  </Button>
                                </div>
                                {manualBoxNumbers.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {manualBoxNumbers.map((b) => (
                                      <span
                                        key={b}
                                        className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-xs bg-muted/20"
                                      >
                                        {b}
                                        <button
                                          type="button"
                                          className="text-muted-foreground hover:text-destructive"
                                          onClick={() =>
                                            setManualBoxNumbers((prev) =>
                                              prev.filter((x) => x !== b),
                                            )
                                          }
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : null}

                  {/* Submission Actions (1-click Save & Print) */}
                  {(dcMode === "manual" || activeProcedures.length > 0) && (
                    <div
                      id="dc-submission"
                      className="glass-card rounded-xl p-4 sm:p-5 space-y-4 border-t-4 border-t-teal-600"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-sans font-semibold text-base sm:text-lg">
                          Finalize Delivery Challan
                        </h3>
                        <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                          {hospitalName ? hospitalName : "Enter Hospital Above"}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-1">
                        <Button
                          onClick={async () => {
                            if (!hospitalName.trim()) {
                              toast({
                                title: "Hospital Name Required",
                                description:
                                  "Please enter the Hospital Name in the top header form.",
                                variant: "destructive",
                              });
                              document
                                .getElementById("hospital-name-input")
                                ?.focus();
                              return;
                            }
                            await handleSaveDc();
                          }}
                          className="w-full sm:flex-1 gap-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm h-11 shadow-md"
                          disabled={isSavingDc}
                        >
                          {isSavingDc ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Saving DC...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Save DC (1-Click)
                            </>
                          )}
                        </Button>

                        <Button
                          onClick={async () => {
                            if (!hospitalName.trim()) {
                              toast({
                                title: "Hospital Name Required",
                                description:
                                  "Please enter the Hospital Name in the top header form.",
                                variant: "destructive",
                              });
                              document
                                .getElementById("hospital-name-input")
                                ?.focus();
                              return;
                            }
                            const success = await handleSaveDc(
                              false,
                              false,
                              true,
                            );
                            if (success) {
                              setShowPrintModal(true);
                            }
                          }}
                          className="w-full sm:flex-1 gap-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm h-11 shadow-md shadow-teal-600/20"
                          disabled={isSavingDc}
                        >
                          <Printer className="w-4 h-4" />
                          Save & Print DC
                        </Button>

                        <Button
                          onClick={() => {
                            setDcMode("procedure");
                            setInitialFilterType("All");
                            setShowProcedureSelector(true);
                            setCollapsedProcedures(
                              new Set(activeProcedures.map((p) => p.name)),
                            );
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          variant="outline"
                          className="w-full sm:w-auto gap-2 border-slate-300 hover:bg-slate-100 font-bold text-sm h-11"
                        >
                          <Plus className="w-4 h-4 text-teal-700" />+ Add
                          Procedure
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Summary */}
                {hasData && (
                  <div className="lg:col-span-1 min-w-0 lg:border-l lg:border-border lg:pl-6">
                    {/* Mobile: Toggleable Summary */}
                    <div className="lg:hidden mb-4">
                      <button
                        onClick={() => setShowSummaryMobile(!showSummaryMobile)}
                        className="w-full glass-card rounded-xl p-3 flex items-center justify-between"
                      >
                        <h2 className="font-sans font-semibold text-base">
                          Summary
                        </h2>
                        {showSummaryMobile ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      {showSummaryMobile && (
                        <div className="glass-card rounded-xl p-3 mt-4">
                          <SummaryPanel
                            activeProcedures={activeProcedures}
                            hospitalName={hospitalName}
                            dcNo={dcNo}
                            deliveredBy={deliveredBy}
                            receivedBy={receivedBy}
                            manualItems={manualItems}
                            manualInstruments={manualInstruments}
                            manualBoxNumbers={manualBoxNumbers}
                            manualMaterialType={manualMaterialType}
                          />
                        </div>
                      )}
                    </div>

                    {/* Desktop: Always visible Summary when data exists */}
                    <div className="hidden lg:block">
                      <div className="glass-card rounded-xl p-3 sm:p-4 sticky top-24">
                        <h2 className="font-sans font-semibold text-base sm:text-lg mb-3 sm:mb-4">
                          Summary
                        </h2>
                        <SummaryPanel
                          activeProcedures={activeProcedures}
                          hospitalName={hospitalName}
                          dcNo={dcNo}
                          deliveredBy={deliveredBy}
                          receivedBy={receivedBy}
                          manualItems={manualItems}
                          manualInstruments={manualInstruments}
                          manualBoxNumbers={manualBoxNumbers}
                          manualMaterialType={manualMaterialType}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </main>
      </div>

      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>DC Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-xs font-bold">Hospital Name *</Label>
              <div className="mt-1">
                <HospitalSelect
                  value={hospitalName}
                  onChange={handleHospitalChange}
                  placeholder="Select or enter hospital name..."
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold">Doctor Name</Label>
              <div className="mt-1">
                <DoctorSelect
                  value={doctorName}
                  onChange={setDoctorName}
                  hospitalName={hospitalName}
                  placeholder="Dr. Name"
                />
              </div>
            </div>
            <div>
              <Label>DC Number</Label>
              <Input
                value={dcNo}
                onChange={(e) => setDcNo(e.target.value)}
                placeholder="Enter DC number"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                aria-autocomplete="none"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Delivered By *</Label>
              <div className="mt-1">
                <PersonnelSelect
                  value={deliveredBy}
                  onChange={setDeliveredBy}
                  placeholder="Select or enter deliverer..."
                />
              </div>
            </div>
            <div>
              <Label>Received By *</Label>
              <Input
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Enter receiver name"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Remarks</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add remarks (optional)"
                className="mt-1"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => {
                  if (!hospitalName || !dcNo || !receivedBy || !deliveredBy) {
                    toast({
                      title: "Missing information",
                      description: "Please fill in all mandatory fields (*)",
                      variant: "destructive",
                    });
                    return;
                  }
                  setShowSettingsModal(false);
                  setShowConfirmSaveDialog(true);
                }}
                className="w-full sm:flex-1 gap-2"
                disabled={isSavingDc}
              >
                {isSavingDc ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save DC"
                )}
              </Button>
              <Button
                onClick={() => {
                  if (!hospitalName || !dcNo || !receivedBy || !deliveredBy) {
                    toast({
                      title: "Missing information",
                      description: "Please fill in all mandatory fields (*)",
                      variant: "destructive",
                    });
                    return;
                  }
                  setShowSettingsModal(false);
                  setShowConfirmSaveDialog(true);
                }}
                className="w-full sm:flex-1"
                variant="outline"
                disabled={isSavingDc}
              >
                Save & Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Save Dialog */}
      <Dialog
        open={showConfirmSaveDialog}
        onOpenChange={setShowConfirmSaveDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Save to Google Sheets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
              <div className="text-sm">
                <span className="font-semibold">Hospital:</span>{" "}
                <span className="text-muted-foreground">{hospitalName}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">DC No:</span>{" "}
                <span className="text-muted-foreground">{dcNo}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Delivered By:</span>{" "}
                <span className="text-muted-foreground">{deliveredBy}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Received By:</span>{" "}
                <span className="text-muted-foreground">{receivedBy}</span>
              </div>
              <div className="text-sm flex items-center gap-2 pt-1 border-t border-border/50 mt-1">
                <span className="font-semibold whitespace-nowrap">
                  DC Date:
                </span>
                <Input
                  type="date"
                  value={customDcDate}
                  onChange={(e) => setCustomDcDate(e.target.value)}
                  className="h-8 py-0 px-2 text-xs bg-white border-slate-300 focus:ring-blue-500 w-full"
                />
              </div>
              {(() => {
                const { items, instruments, boxNumbers } = buildSavePayload();
                const totalItems = items.reduce(
                  (sum, item) =>
                    sum + item.sizes.reduce((s, size) => s + size.qty, 0),
                  0,
                );
                return (
                  <>
                    <div className="text-sm">
                      <span className="font-semibold">Total Items:</span>{" "}
                      <span className="text-muted-foreground">
                        {totalItems}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">Instruments:</span>{" "}
                      <span className="text-muted-foreground">
                        {instruments.length}
                      </span>
                    </div>
                    {boxNumbers.length > 0 && (
                      <div className="text-sm">
                        <span className="font-semibold">Box Numbers:</span>{" "}
                        <span className="text-muted-foreground">
                          {boxNumbers.length}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <p className="text-sm text-muted-foreground">
              This DC will be saved to Google Sheets. You can manage it later
              from the "Saved DC List".
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmSaveDialog(false)}
                className="w-full sm:w-auto"
                disabled={isSavingDc}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setShowConfirmSaveDialog(false);
                  await handleSaveDc();
                }}
                className="w-full sm:flex-1 bg-slate-900 text-white hover:bg-slate-800 font-bold"
                disabled={isSavingDc}
              >
                Save Only
              </Button>
              <Button
                onClick={async () => {
                  setShowConfirmSaveDialog(false);
                  const success = await handleSaveDc(false, false, true);
                  if (success) {
                    setShowPrintModal(true);
                  }
                }}
                className="w-full sm:flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold"
                disabled={isSavingDc}
              >
                Save & Print
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Near-Duplicate Hospital Prompt Dialog */}
      <Dialog
        open={!!duplicatePrompt}
        onOpenChange={(open) => {
          if (!open) setDuplicatePrompt(null);
        }}
      >
        <DialogContent className="max-w-md border-2 border-amber-500/40 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              Similar Hospital Profile Found
            </DialogTitle>
            <DialogDescription className="text-xs">
              An existing registered hospital closely matches the name you
              entered. Use the existing profile to keep records linked and avoid
              creating a duplicate entry.
            </DialogDescription>
          </DialogHeader>

          {duplicatePrompt && (
            <div className="space-y-3.5 pt-2">
              {/* Entered vs Existing comparison cards */}
              <div className="space-y-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                      You Entered
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9.5px] px-1.5 py-0 h-4 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium"
                    >
                      New Name
                    </Badge>
                  </div>
                  <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 mt-1">
                    "{duplicatePrompt.enteredName}"
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border-2 border-teal-500/50 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                      Existing Profile (
                      {Math.round(duplicatePrompt.duplicateResult.score * 100)}%
                      match)
                    </span>
                    <Badge className="text-[9.5px] px-1.5 py-0 h-4 bg-teal-700 hover:bg-teal-700 text-white font-bold">
                      Recommended
                    </Badge>
                  </div>

                  <div className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    {duplicatePrompt.duplicateResult.match.name}
                  </div>

                  <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300 pt-1.5 border-t border-teal-200/60 dark:border-teal-800/60">
                    {duplicatePrompt.duplicateResult.match.address && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {duplicatePrompt.duplicateResult.match.address}
                        </span>
                      </div>
                    )}
                    {duplicatePrompt.duplicateResult.match.otNumber && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                        <Stethoscope className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          OT: {duplicatePrompt.duplicateResult.match.otNumber}
                        </span>
                      </div>
                    )}
                    {(duplicatePrompt.duplicateResult.match.hospitalNumber ||
                      duplicatePrompt.duplicateResult.match.mobile) && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {duplicatePrompt.duplicateResult.match
                            .hospitalNumber ||
                            duplicatePrompt.duplicateResult.match.mobile}
                        </span>
                      </div>
                    )}
                    {duplicatePrompt.duplicateResult.match.contactPerson && (
                      <div className="text-[11px] text-slate-500">
                        Contact Person:{" "}
                        <strong>
                          {duplicatePrompt.duplicateResult.match.contactPerson}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  onClick={async () => {
                    const chosenHospital =
                      duplicatePrompt.duplicateResult.match.name;
                    const nav = duplicatePrompt.shouldNavigate;
                    const clr = duplicatePrompt.shouldClear;
                    const print = duplicatePrompt.isPrintAfter || false;
                    setHospitalName(chosenHospital);
                    setDuplicatePrompt(null);

                    const success = await handleSaveDc(
                      nav,
                      clr,
                      print,
                      true,
                      chosenHospital,
                    );
                    if (success && print) {
                      setShowPrintModal(true);
                    }
                  }}
                  className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-600/20"
                >
                  <Check className="w-4 h-4" />
                  Use Existing Profile: "
                  {duplicatePrompt.duplicateResult.match.name}"
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDuplicatePrompt(null)}
                    className="flex-1 h-8 text-xs font-semibold"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      const typedName = duplicatePrompt.enteredName;
                      const nav = duplicatePrompt.shouldNavigate;
                      const clr = duplicatePrompt.shouldClear;
                      const print = duplicatePrompt.isPrintAfter || false;
                      setDuplicatePrompt(null);

                      const success = await handleSaveDc(
                        nav,
                        clr,
                        print,
                        true,
                        typedName,
                      );
                      if (success && print) {
                        setShowPrintModal(true);
                      }
                    }}
                    className="flex-1 h-8 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Keep "{duplicatePrompt.enteredName}"
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Modal */}
      <Dialog
        open={showPrintModal}
        onOpenChange={(open) => {
          setShowPrintModal(open);
          if (!open) {
            // After closing print preview of a saved DC, clear form & navigate to Saved DCs
            setShowSettingsModal(false);
            setDcMode("procedure");
            setActiveProcedures([]);
            setCollapsedProcedures(new Set());
            setInitialFilterType("None");
            setShowProcedureSelector(true);
            setManualMaterialType("SS");
            handleClearManualEntry();
            setCustomDcDate(new Date().toISOString().split("T")[0]);
            setDcNo("");
            navigate("/saved");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader className="no-print">
            <DialogTitle>Print Preview</DialogTitle>
          </DialogHeader>
          <div data-print-content>
            <PrintPreview
              ref={printRef}
              activeProcedures={activeProcedures}
              hospitalName={hospitalName}
              doctorName={doctorName}
              dcNo={dcNo}
              deliveredBy={deliveredBy}
              receivedBy={receivedBy}
              manualItems={manualItems}
              manualInstruments={manualInstruments}
              manualBoxNumbers={manualBoxNumbers}
              manualMaterialType={manualMaterialType}
            />
          </div>
          <div className="flex gap-3 mt-4 no-print" data-no-print>
            <Button onClick={handlePrintPDF} className="flex-1">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={handleSavePDF}
              variant="outline"
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Save PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2-Second Save DC Transition Loading Overlay matching DC Tracker style */}
      <Dialog open={savingOverlay.open}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[90vw] max-w-[90vw] sm:max-w-[420px] max-h-[90vh] p-0 overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 gap-0 [&>button]:hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Saving Delivery Challan...</DialogTitle>
            <DialogDescription>
              Saving Delivery Challan and opening DC Tracker
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 text-center space-y-4">
            {/* Animated Icon Tile */}
            <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-inner">
              {savingOverlay.progress === 100 ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-bounce" />
              ) : (
                <Loader2 className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin" />
              )}
            </div>

            {/* Title & DC Badge */}
            <div className="space-y-1.5">
              {savingOverlay.dcNo && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                    DC #{savingOverlay.dcNo}
                  </span>
                  <span>→</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    DC Tracker
                  </span>
                </div>
              )}
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight pt-1">
                {savingOverlay.progress === 100
                  ? "DC Saved Successfully! ✅"
                  : "Saving Delivery Challan..."}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed px-2">
                Opening DC Tracker for <strong className="text-slate-900 dark:text-slate-100">{savingOverlay.hospitalName}</strong>...
              </p>
            </div>

            {/* Smooth Progress Bar */}
            <div className="pt-2 px-2">
              <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    savingOverlay.progress === 100
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-teal-500 via-indigo-500 to-amber-500"
                  }`}
                  style={{ width: `${savingOverlay.progress || 20}%` }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
