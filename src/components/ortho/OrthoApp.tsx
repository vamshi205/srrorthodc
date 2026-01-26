import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { Activity, Printer, Download, Trash2, Plus, ChevronDown, ChevronUp, Wrench, RefreshCw, Bookmark, Save, LogOut, List, Search, X, Menu, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
// import { LoginScreen } from '@/components/ortho/LoginScreen'; // Removed
import { ProcedureSelector } from '@/components/ortho/ProcedureSelector';
import { ProcedureCard } from '@/components/ortho/ProcedureCard';
import { SummaryPanel } from '@/components/ortho/SummaryPanel';
import { PrintPreview } from '@/components/ortho/PrintPreview';
import { useToast } from '@/hooks/use-toast';
import { useProcedures } from '@/hooks/useProcedures';
import { loadSavedDcs, saveSavedDc } from '@/lib/savedDcStorage';
import { Procedure, ActiveProcedure, SizeQty } from '@/types/procedure';
import { auth } from '@/firebase';

export default function OrthoApp() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();
  // Legacy authentication removed - handled by App.tsx ProtectedRoute
  // const [isAuthenticated, setIsAuthenticated] = useState(...)

  const { procedures, loading, procedureTypes, refetchSingleProcedure, searchProcedures, searchInstruments, searchItems, fetchProcedures } = useProcedures();

  // Initialize with empty array - no procedures selected by default
  const [activeProcedures, setActiveProcedures] = useState<ActiveProcedure[]>([]);
  const [collapsedProcedures, setCollapsedProcedures] = useState<Set<string>>(new Set());
  const [hospitalName, setHospitalName] = useState('');
  const [dcNo, setDcNo] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProcedureSelector, setShowProcedureSelector] = useState(false);
  const [initialFilterType, setInitialFilterType] = useState<string>('None');
  const [showSummaryMobile, setShowSummaryMobile] = useState(false);
  const [recentSavedDcs, setRecentSavedDcs] = useState<any[]>([]);
  const [isSavingDc, setIsSavingDc] = useState(false);
  const [showConfirmSaveDialog, setShowConfirmSaveDialog] = useState(false);
  const [deliveredBy, setDeliveredBy] = useState('');
  const [customDcDate, setCustomDcDate] = useState(new Date().toISOString().split('T')[0]);

  // Manual DC builder
  const [dcMode, setDcMode] = useState<'procedure' | 'manual'>('procedure');
  const [manualMaterialType, setManualMaterialType] = useState('SS');
  const [manualItemQuery, setManualItemQuery] = useState('');
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemSuggestionsOpen, setManualItemSuggestionsOpen] = useState(false);
  const [manualItemActiveIndex, setManualItemActiveIndex] = useState(-1);
  const [manualItemSize, setManualItemSize] = useState('');
  const [manualItemQty, setManualItemQty] = useState('1');
  const [manualItems, setManualItems] = useState<Array<{ name: string; size: string; qty: number }>>([]);
  const [manualInstrumentQuery, setManualInstrumentQuery] = useState('');
  const [manualInstruments, setManualInstruments] = useState<string[]>([]);
  const [manualInstrumentSuggestionsOpen, setManualInstrumentSuggestionsOpen] = useState(false);
  const [manualInstrumentActiveIndex, setManualInstrumentActiveIndex] = useState(-1);
  const [manualBoxInput, setManualBoxInput] = useState('');
  const [manualBoxNumbers, setManualBoxNumbers] = useState<string[]>([]);

  const printRef = useRef<HTMLDivElement>(null);

  // Ensure no procedures are selected on mount and after login
  useEffect(() => {
    setActiveProcedures([]);
    // Load recent saved DCs on mount
    loadSavedDcs().then(dcs => setRecentSavedDcs(dcs.slice(0, 6))).catch(err => {
      console.error('Failed to load recent DCs:', err);
    });
  }, []);

  // Clear procedures and show selector on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');

    if (mode === 'manual') {
      setDcMode('manual');
      setActiveProcedures([]);
      setCollapsedProcedures(new Set());
      setShowProcedureSelector(false);
    } else {
      setDcMode('procedure');
      setActiveProcedures([]);
      setInitialFilterType('None');
      setShowProcedureSelector(true);
    }
  }, [location.search]);

  const handleSelectProcedure = useCallback((procedure: Procedure) => {
    setActiveProcedures((prev) => {
      const exists = prev.find((p) => p.name === procedure.name);
      if (exists) {
        const newProcedures = prev.filter((p) => p.name !== procedure.name);
        // Show selector if no procedures left
        if (newProcedures.length === 0) {
          setShowProcedureSelector(true);
        }
        return newProcedures;
      }
      const activeProcedure: ActiveProcedure = {
        ...procedure,
        materialType: 'SS',
        selectedItems: new Map(),
        selectedFixedItems: new Map(procedure.fixedItems.map((fi) => [fi.name, true])),
        fixedQtyEdits: new Map(),
        boxNumbers: [],
        instrumentImageMapping: procedure.instrumentImageMapping || {},
        fixedItemImageMapping: procedure.fixedItemImageMapping || {},
        itemImageMapping: procedure.itemImageMapping || {},
        instrumentLocationMapping: procedure.instrumentLocationMapping || {},
        fixedItemLocationMapping: procedure.fixedItemLocationMapping || {},
        itemLocationMapping: procedure.itemLocationMapping || {},
      };
      // Hide selector when a procedure is selected
      setShowProcedureSelector(false);
      return [...prev, activeProcedure];
    });
  }, []);

  const handleRemoveProcedure = useCallback((name: string) => {
    setActiveProcedures((prev) => {
      const newProcedures = prev.filter((p) => p.name !== name);
      // Show selector if no procedures left
      if (newProcedures.length === 0) {
        setShowProcedureSelector(true);
        setInitialFilterType('None');
      }
      return newProcedures;
    });
  }, []);

  const handleRefreshProcedure = useCallback(async (name: string) => {
    const updated = await refetchSingleProcedure(name);
    if (updated) {
      setActiveProcedures((prev) =>
        prev.map((p) =>
          p.name === name ? {
            ...p,
            ...updated,
            selectedItems: p.selectedItems,
            selectedFixedItems: p.selectedFixedItems,
            fixedQtyEdits: p.fixedQtyEdits,
            boxNumbers: p.boxNumbers || [],
            instrumentImageMapping: updated.instrumentImageMapping || p.instrumentImageMapping || {},
            fixedItemImageMapping: updated.fixedItemImageMapping || p.fixedItemImageMapping || {},
            itemImageMapping: updated.itemImageMapping || p.itemImageMapping || {},
            instrumentLocationMapping: updated.instrumentLocationMapping || p.instrumentLocationMapping || {},
            fixedItemLocationMapping: updated.fixedItemLocationMapping || p.fixedItemLocationMapping || {},
            itemLocationMapping: updated.itemLocationMapping || p.itemLocationMapping || {}
          } : p
        )
      );
    }
  }, [refetchSingleProcedure]);

  const handleProcedureMaterialTypeChange = useCallback((procedureName: string, newType: string) => {
    setActiveProcedures((prev) =>
      prev.map((p) => (p.name === procedureName ? { ...p, materialType: newType } : p))
    );
  }, []);

  const handleItemToggle = useCallback((procedureName: string, itemName: string, checked: boolean) => {
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
      })
    );
  }, []);

  const handleSizeQtyChange = useCallback((procedureName: string, itemName: string, sizeQty: SizeQty[]) => {
    setActiveProcedures((prev) =>
      prev.map((p) => {
        if (p.name !== procedureName) return p;
        const newMap = new Map(p.selectedItems);
        newMap.set(itemName, { itemName, sizeQty });
        return { ...p, selectedItems: newMap };
      })
    );
  }, []);

  const handleFixedItemToggle = useCallback((procedureName: string, itemName: string, checked: boolean) => {
    setActiveProcedures((prev) =>
      prev.map((p) => {
        if (p.name !== procedureName) return p;
        const newMap = new Map(p.selectedFixedItems);
        newMap.set(itemName, checked);
        return { ...p, selectedFixedItems: newMap };
      })
    );
  }, []);

  const handleFixedQtyChange = useCallback((procedureName: string, itemName: string, qty: string) => {
    setActiveProcedures((prev) =>
      prev.map((p) => {
        if (p.name !== procedureName) return p;
        const newMap = new Map(p.fixedQtyEdits);
        newMap.set(itemName, qty);
        return { ...p, fixedQtyEdits: newMap };
      })
    );
  }, []);

  const handleAddInstrument = useCallback((procedureName: string, instrument: string) => {
    setActiveProcedures((prev) =>
      prev.map((p) => {
        if (p.name !== procedureName) return p;
        if (p.instruments.includes(instrument)) return p;
        return { ...p, instruments: [...p.instruments, instrument] };
      })
    );
  }, []);

  const handleRemoveInstrument = useCallback((procedureName: string, instrument: string) => {
    setActiveProcedures((prev) =>
      prev.map((p) => {
        if (p.name !== procedureName) return p;
        return { ...p, instruments: p.instruments.filter((i) => i !== instrument) };
      })
    );
  }, []);

  const handleAddItem = useCallback((procedureName: string, itemName: string) => {
    setActiveProcedures((prev) =>
      prev.map((p) => {
        if (p.name === procedureName && !p.items.includes(itemName)) {
          return { ...p, items: [...p.items, itemName] };
        }
        return p;
      })
    );
  }, []);

  const handleRemoveFixedItemPart = useCallback((procedureName: string, itemName: string, partToRemove: string) => {
    setActiveProcedures((prev) =>
      prev.map((p) => {
        if (p.name !== procedureName) return p;

        // Find the fixed item and remove the part
        const updatedFixedItems = p.fixedItems.map((item) => {
          if (item.name === itemName) {
            const partToRemoveTrimmed = partToRemove.trim();

            // Simple approach: find the part in the string and remove it along with any comma
            // Handle cases like "120° DHS Plate Short Barrell 4hole,5hole,6hole"
            // The partToRemove might be just "4hole" but the actual part in the array is "120° DHS Plate Long Barrell 4hole"
            let newName = itemName;

            // Split by comma to get individual parts
            const parts = newName.split(',').map(p => p.trim());

            // Find which part contains the part to remove
            let foundAndRemoved = false;
            const updatedParts = parts.map((part, index) => {
              // If this is the part being removed
              if (part === partToRemoveTrimmed) {
                // First, try to detect if it has a suffix pattern (like "4hole", "5hole" at the end)
                // Pattern: space + number + word(s) at the end (e.g., " 4hole", " 5hole")
                const suffixPattern = /\s+(\d+\w+)$/; // Matches space + number + word at the end
                const match = part.match(suffixPattern);
                if (match) {
                  // Found a suffix pattern, remove just the suffix
                  const beforeSuffix = part.slice(0, -match[0].length).trim();
                  if (beforeSuffix.length > 0) {
                    foundAndRemoved = true;
                    return beforeSuffix;
                  }
                }

                // If no suffix pattern found, check if it's a short standalone part (like "5hole")
                // Remove the entire part if it's short and simple
                if (part.length < 15 && /^\d+\w+$/.test(part)) {
                  foundAndRemoved = true;
                  return null;
                }

                // Otherwise, if it's a longer part without a clear suffix pattern, remove the entire part
                foundAndRemoved = true;
                return null;
              }

              // If the part ends with the partToRemove and has content before it, remove just the suffix
              // This handles edge cases where partToRemove might be a substring
              if (part.endsWith(partToRemoveTrimmed) && part.length > partToRemoveTrimmed.length) {
                const charBeforeIndex = part.length - partToRemoveTrimmed.length - 1;
                const charBefore = charBeforeIndex >= 0 ? part[charBeforeIndex] : null;

                if (charBefore === ' ') {
                  const beforePart = part.slice(0, -partToRemoveTrimmed.length).trim();
                  if (beforePart.length > 0) {
                    foundAndRemoved = true;
                    return beforePart;
                  }
                }
              }

              return part;
            }).filter(p => p !== null && p.length > 0);

            if (updatedParts.length > 0 && foundAndRemoved) {
              // Join parts with commas
              newName = updatedParts.join(',');
            } else if (!foundAndRemoved) {
              // If we didn't find the part to remove, don't update
              return item;
            } else {
              // If all parts were removed, don't update
              return item;
            }

            // Only update if name actually changed
            if (newName !== itemName && newName.trim().length > 0) {
              // Update fixedQtyEdits if it exists
              const qtyMap = new Map(p.fixedQtyEdits);
              const oldQty = qtyMap.get(itemName);
              if (oldQty) {
                qtyMap.delete(itemName);
                qtyMap.set(newName.trim(), oldQty);
              }

              // Update selectedFixedItems
              const selectedMap = new Map(p.selectedFixedItems);
              const wasSelected = selectedMap.get(itemName);
              if (wasSelected !== undefined) {
                selectedMap.delete(itemName);
                selectedMap.set(newName.trim(), wasSelected);
              }

              return { ...item, name: newName.trim() };
            }
          }
          return item;
        });

        return { ...p, fixedItems: updatedFixedItems };
      })
    );
  }, []);

  const handleRemoveSelectableItemPart = useCallback((procedureName: string, itemName: string, partToRemove: string) => {
    setActiveProcedures((prev) =>
      prev.map((p) => {
        if (p.name !== procedureName) return p;

        // Update items array - find item and remove the part
        const updatedItems = p.items.map((item) => {
          // Parse the item to get the name
          const match = item.match(/^(.+?)\s*\{(.+)\}$/);
          if (match) {
            const name = match[1].trim();
            if (name === itemName) {
              const partToRemoveTrimmed = partToRemove.trim();

              // Simple approach: find the part in the string and remove it along with any comma
              let newName = name;

              // Try to find and remove the part with comma after it: "4hole,"
              const patternWithCommaAfter = partToRemoveTrimmed + ',';
              if (newName.includes(patternWithCommaAfter)) {
                newName = newName.replace(patternWithCommaAfter, '');
              } else {
                // Try to find and remove the part with comma before it: ",4hole"
                const patternWithCommaBefore = ',' + partToRemoveTrimmed;
                if (newName.includes(patternWithCommaBefore)) {
                  newName = newName.replace(patternWithCommaBefore, '');
                } else {
                  // Try to find if part is at the end of a word (like "4hole" in "120° DHS Plate Short Barrell 4hole")
                  const parts = newName.split(',').map(p => p.trim());
                  const updatedParts = parts.map(part => {
                    // If this is the part being removed
                    if (part === partToRemoveTrimmed) {
                      // First, try to detect if it has a suffix pattern (like "4hole", "5hole" at the end)
                      // Pattern: space + number + word(s) at the end (e.g., " 4hole", " 5hole")
                      const suffixPattern = /\s+(\d+\w+)$/; // Matches space + number + word at the end
                      const match = part.match(suffixPattern);
                      if (match) {
                        // Found a suffix pattern, remove just the suffix
                        const beforeSuffix = part.slice(0, -match[0].length).trim();
                        if (beforeSuffix.length > 0) {
                          return beforeSuffix;
                        }
                      }

                      // If no suffix pattern found, check if it's a short standalone part (like "5hole")
                      // Remove the entire part if it's short and simple
                      if (part.length < 15 && /^\d+\w+$/.test(part)) {
                        return null;
                      }

                      // Otherwise, if it's a longer part without a clear suffix pattern, remove the entire part
                      return null;
                    }

                    // If the part ends with the partToRemove and has content before it, remove just the suffix
                    if (part.endsWith(partToRemoveTrimmed) && part.length > partToRemoveTrimmed.length) {
                      const charBeforeIndex = part.length - partToRemoveTrimmed.length - 1;
                      const charBefore = charBeforeIndex >= 0 ? part[charBeforeIndex] : null;

                      if (charBefore === ' ') {
                        const beforePart = part.slice(0, -partToRemoveTrimmed.length).trim();
                        return beforePart.length > 0 ? beforePart : null;
                      }
                    }

                    return part;
                  }).filter(p => p !== null && p.length > 0);

                  if (updatedParts.length > 0) {
                    newName = updatedParts.join(',');
                  } else {
                    // If all parts were removed, don't update
                    return item;
                  }
                }
              }

              // Only update if name actually changed
              if (newName !== name && newName.trim().length > 0) {
                // Reconstruct the item string with new name
                return `${newName.trim()} {${match[2]}}`;
              }
            }
          } else {
            // Item without size/qty pattern
            if (item.trim() === itemName) {
              const partToRemoveTrimmed = partToRemove.trim();

              // Simple approach: find the part in the string and remove it along with any comma
              let newName = itemName;

              // Try to find and remove the part with comma after it: "4hole,"
              const patternWithCommaAfter = partToRemoveTrimmed + ',';
              if (newName.includes(patternWithCommaAfter)) {
                newName = newName.replace(patternWithCommaAfter, '');
              } else {
                // Try to find and remove the part with comma before it: ",4hole"
                const patternWithCommaBefore = ',' + partToRemoveTrimmed;
                if (newName.includes(patternWithCommaBefore)) {
                  newName = newName.replace(patternWithCommaBefore, '');
                } else {
                  // Try to find if part is at the end of a word
                  const parts = newName.split(',').map(p => p.trim());
                  const updatedParts = parts.map(part => {
                    // If this is the part being removed
                    if (part === partToRemoveTrimmed) {
                      // First, try to detect if it has a suffix pattern (like "4hole", "5hole" at the end)
                      // Pattern: space + number + word(s) at the end (e.g., " 4hole", " 5hole")
                      const suffixPattern = /\s+(\d+\w+)$/; // Matches space + number + word at the end
                      const match = part.match(suffixPattern);
                      if (match) {
                        // Found a suffix pattern, remove just the suffix
                        const beforeSuffix = part.slice(0, -match[0].length).trim();
                        if (beforeSuffix.length > 0) {
                          return beforeSuffix;
                        }
                      }

                      // If no suffix pattern found, check if it's a short standalone part (like "5hole")
                      // Remove the entire part if it's short and simple
                      if (part.length < 15 && /^\d+\w+$/.test(part)) {
                        return null;
                      }

                      // Otherwise, if it's a longer part without a clear suffix pattern, remove the entire part
                      return null;
                    }

                    // If the part ends with the partToRemove and has content before it, remove just the suffix
                    if (part.endsWith(partToRemoveTrimmed) && part.length > partToRemoveTrimmed.length) {
                      const charBeforeIndex = part.length - partToRemoveTrimmed.length - 1;
                      const charBefore = charBeforeIndex >= 0 ? part[charBeforeIndex] : null;

                      if (charBefore === ' ') {
                        const beforePart = part.slice(0, -partToRemoveTrimmed.length).trim();
                        return beforePart.length > 0 ? beforePart : null;
                      }
                    }

                    return part;
                  }).filter(p => p !== null && p.length > 0);

                  if (updatedParts.length > 0) {
                    newName = updatedParts.join(',');
                  } else {
                    // If all parts were removed, don't update
                    return item;
                  }
                }
              }

              // Only update if name actually changed
              if (newName !== itemName && newName.trim().length > 0) {
                return newName.trim();
              }
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
      })
    );
  }, []);

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
    const matchIdx = normalizedItemSuggestions.findIndex((s) => s.toLowerCase() === q);
    if (matchIdx >= 0 && matchIdx !== manualItemActiveIndex) {
      setManualItemActiveIndex(matchIdx);
    }
  }, [manualItemActiveIndex, manualItemQuery, manualItemSuggestionsOpen, normalizedItemSuggestions]);

  const selectManualItemSuggestion = useCallback((value: string) => {
    setManualItemName(value);
    setManualItemQuery(value);
    setManualItemSuggestionsOpen(false);
    setManualItemActiveIndex(-1);
  }, []);

  const selectManualInstrumentSuggestion = useCallback((value: string) => {
    setManualInstruments((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setManualInstrumentQuery('');
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
      const procedureMaterial = procedure.materialType || 'SS';
      procedure.selectedItems.forEach((item, itemName) => {
        const displayName = procedureMaterial !== 'None' ? `${procedureMaterial} ${itemName}` : itemName;
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
        const isSelected = procedure.selectedFixedItems.get(fixedItem.name) ?? true;
        if (isSelected) {
          const editedQty = procedure.fixedQtyEdits.get(fixedItem.name) ?? fixedItem.qty;
          const displayName =
            procedureMaterial !== 'None' ? `${procedureMaterial} ${fixedItem.name}` : fixedItem.name;
          items.push({
            name: displayName,
            sizes: [{ size: '', qty: parseInt(editedQty) || 1 }],
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
      const displayName = manualMaterialType !== 'None' ? `${manualMaterialType} ${mi.name}` : mi.name;
      items.push({
        name: displayName,
        sizes: [{ size: mi.size || '', qty: mi.qty }],
        procedure: 'Manual',
        isSelectable: true,
      });
    });
    manualInstruments.forEach((inst) => instruments.add(inst));
    if (manualBoxNumbers.length > 0) {
      boxNumbers.push(...manualBoxNumbers);
    }

    return { items, instruments: Array.from(instruments), boxNumbers };
  }, [activeProcedures, manualItems, manualInstruments, manualBoxNumbers, manualMaterialType]);

  const handleClearManualEntry = useCallback(() => {
    setManualItems([]);
    setManualInstruments([]);
    setManualBoxNumbers([]);
    setManualItemQuery('');
    setManualItemName('');
    setManualItemSize('');
    setManualItemQty('1');
    setManualInstrumentQuery('');
    setManualBoxInput('');
    setHospitalName('');
    setDcNo('');
    setReceivedBy('');
    setDeliveredBy('');
    setRemarks('');
  }, []);

  const handleSaveDc = useCallback(async (): Promise<boolean> => {
    if (!hospitalName || !dcNo || !receivedBy || !deliveredBy) {
      setShowSettingsModal(true);
      return false;
    }
    if (activeProcedures.length === 0 && manualItems.length === 0 && manualInstruments.length === 0 && manualBoxNumbers.length === 0) {
      toast({ title: 'Nothing to save', description: 'Add procedures or use Manual DC to add items/instruments.' });
      return false;
    }

    setIsSavingDc(true);
    try {
      const { items, instruments, boxNumbers } = buildSavePayload();
      const dcMaterialType = (() => {
        const types = new Set<string>();
        activeProcedures.forEach((p) => types.add(p.materialType || 'SS'));
        if (manualItems.length > 0) types.add(manualMaterialType || 'SS');
        const arr = Array.from(types);
        if (arr.length === 0) return 'SS';
        if (arr.length === 1) return arr[0];
        return 'Mixed';
      })();

      await saveSavedDc({
        hospitalName,
        dcNo,
        materialType: dcMaterialType,
        deliveredBy,
        receivedBy,
        remarks,
        items,
        instruments,
        boxNumbers,
        customAt: customDcDate ? new Date(customDcDate).toISOString() : undefined,
      });

      toast({ title: 'DC saved successfully', description: `${hospitalName} · ${dcNo}` });

      // Reload recent DCs
      const dcs = await loadSavedDcs();
      setRecentSavedDcs(dcs.slice(0, 6));

      // After saving: close modal and reset to default procedure list
      setShowSettingsModal(false);
      setShowPrintModal(false);
      setDcMode('procedure');
      setActiveProcedures([]);
      setCollapsedProcedures(new Set());
      setInitialFilterType('None');
      setShowProcedureSelector(true);
      setManualMaterialType('SS');
      handleClearManualEntry();
      setCustomDcDate(new Date().toISOString().split('T')[0]);

      // Navigate to Saved DC List
      setTimeout(() => {
        navigate('/saved');
      }, 500); // Small delay to let user see the success toast

      return true;
    } catch (error) {
      console.error('Error saving DC:', error);
      toast({
        title: 'Error saving DC',
        description: error instanceof Error ? error.message : 'Failed to save DC to Google Sheets',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsSavingDc(false);
    }
  }, [activeProcedures, buildSavePayload, dcNo, handleClearManualEntry, hospitalName, manualBoxNumbers.length, manualInstruments.length, manualItems.length, manualMaterialType, receivedBy, remarks, toast]);

  const handleSavePDF = async () => {
    if (!printRef.current) return;
    const opt = {
      margin: 10,
      filename: `SRR-Ortho-Implant-DC-${dcNo || 'draft'}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
    };
    await html2pdf().set(opt).from(printRef.current).save();
  };

  const handlePrintPDF = async () => {
    if (!printRef.current) return;
    const opt = {
      margin: 10,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
    };
    const pdf = await html2pdf().set(opt).from(printRef.current).outputPdf('blob');
    const blobUrl = URL.createObjectURL(pdf);
    const printWindow = window.open(blobUrl);
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('srrortho:auth');
    localStorage.removeItem('srrortho:procedures_cache');
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleAddBox = useCallback((procedureName: string, boxNumber: string) => {
    setActiveProcedures((prev) =>
      prev.map((p) => {
        if (p.name !== procedureName) return p;
        const trimmed = boxNumber.trim();
        if (trimmed && !p.boxNumbers.includes(trimmed)) {
          return { ...p, boxNumbers: [...p.boxNumbers, trimmed] };
        }
        return p;
      })
    );
  }, []);

  const handleRemoveBox = useCallback((procedureName: string, index: number) => {
    setActiveProcedures((prev) =>
      prev.map((p) => {
        if (p.name !== procedureName) return p;
        return { ...p, boxNumbers: p.boxNumbers.filter((_, i) => i !== index) };
      })
    );
  }, []);

  // Legacy login screen logic removed
  // if (!isAuthenticated) { return <LoginScreen ... />; }

  return (
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden">
      <div className="flex min-h-screen">
        {/* Left Menu (desktop only - hidden on tablets) */}
        <aside className="hidden lg:flex w-80 border-r border-border bg-card/70 backdrop-blur-md">
          <div className="flex flex-col w-full p-4 gap-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                <Activity className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold truncate">SRR Ortho Implant</div>
                <div className="text-xs text-muted-foreground">DC Generator</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Navigation</div>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setDcMode('procedure');
                  setInitialFilterType('All');
                  setShowProcedureSelector(true);
                }}
              >
                <Plus className="w-4 h-4" /> Procedure List
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setDcMode('manual');
                  setActiveProcedures([]);
                  setCollapsedProcedures(new Set());
                  setShowProcedureSelector(false);
                }}
              >
                <Plus className="w-4 h-4" /> Manual DC
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/images')}>
                <Images className="w-4 h-4" /> Image Database
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/saved')}>
                <List className="w-4 h-4" /> DC Tracker
              </Button>
            </div>

            <div className="mt-auto space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground">Recent Saved</div>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => navigate('/saved')}>
                  <Bookmark className="w-4 h-4" />
                </Button>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/60 p-2 space-y-1">
                {recentSavedDcs.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-2">No saved DCs yet</div>
                ) : (
                  recentSavedDcs.map((dc) => (
                    <button
                      key={dc.id}
                      onClick={() => navigate('/saved')}
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-xs font-medium truncate">{dc.hospitalName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{dc.dcNo}</div>
                    </button>
                  ))
                )}
              </div>

              <div className="pt-2 space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => navigate('/admin')}
                >
                  <Wrench className="w-4 h-4" /> Admin Panel
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" /> Logout
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
          {/* Top toolbar (desktop & mobile) */}
          <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-4">
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-md px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="md:hidden w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-semibold truncate">DC Generator</div>
                  <div className="text-xs text-muted-foreground truncate">{hospitalName || 'Hospital'} · {dcNo || 'DC'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Desktop actions */}
                <div className="hidden md:flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => fetchProcedures()} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
                    <Printer className="w-4 h-4" /> Print
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/admin')}>
                    <Wrench className="w-4 h-4" /> Admin
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" /> Logout
                  </Button>
                </div>

                {/* Mobile menu - shows on tablets and mobile */}
                <div className="lg:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9">
                        <Menu className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-4">
                      <SheetHeader className="pr-10">
                        <SheetTitle>Menu</SheetTitle>
                      </SheetHeader>

                      <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">Navigation</div>
                          <SheetClose asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start gap-2"
                              onClick={() => {
                                setDcMode('procedure');
                                setInitialFilterType('All');
                                setShowProcedureSelector(true);
                              }}
                            >
                              <Plus className="w-4 h-4" /> Procedure List
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start gap-2"
                              onClick={() => {
                                setDcMode('manual');
                                setActiveProcedures([]);
                                setCollapsedProcedures(new Set());
                                setShowProcedureSelector(false);
                              }}
                            >
                              <Plus className="w-4 h-4" /> Manual DC
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/images')}>
                              <Images className="w-4 h-4" /> Image Database
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/saved')}>
                              <List className="w-4 h-4" /> DC Tracker
                            </Button>
                          </SheetClose>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">Actions</div>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => fetchProcedures(true)} disabled={loading}>
                              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={handlePrint}>
                              <Printer className="w-4 h-4" /> Print
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/admin')}>
                              <Wrench className="w-4 h-4" /> Admin Panel
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2 text-red-600" onClick={handleLogout}>
                              <LogOut className="w-4 h-4" /> Logout
                            </Button>
                          </SheetClose>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left: Procedure Selection & Active Procedures */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
              {/* Active Procedures - Show first if they exist */}
              {activeProcedures.length > 0 && (
                <div className="space-y-3 sm:space-y-4">
                  <h2 className="font-display font-semibold text-base sm:text-lg">Active Procedures</h2>
                  {activeProcedures.map((procedure) => (
                    <ProcedureCard
                      key={procedure.name}
                      procedure={procedure}
                      isCollapsed={collapsedProcedures.has(procedure.name)}
                      onToggleCollapse={() => setCollapsedProcedures((prev) => { const next = new Set(prev); next.has(procedure.name) ? next.delete(procedure.name) : next.add(procedure.name); return next; })}
                      onRemove={() => handleRemoveProcedure(procedure.name)}
                      onRefresh={() => handleRefreshProcedure(procedure.name)}
                      onMaterialTypeChange={(t) => handleProcedureMaterialTypeChange(procedure.name, t)}
                      onItemToggle={(item, checked) => handleItemToggle(procedure.name, item, checked)}
                      onSizeQtyChange={(item, sq) => handleSizeQtyChange(procedure.name, item, sq)}
                      onFixedItemToggle={(item, checked) => handleFixedItemToggle(procedure.name, item, checked)}
                      onFixedQtyChange={(item, qty) => handleFixedQtyChange(procedure.name, item, qty)}
                      onAddInstrument={(inst) => handleAddInstrument(procedure.name, inst)}
                      onRemoveInstrument={(inst) => handleRemoveInstrument(procedure.name, inst)}
                      onAddItem={(item) => handleAddItem(procedure.name, item)}
                      onSearchItems={searchItems}
                      instrumentSuggestions={[]}
                      onSearchInstruments={searchInstruments}
                      onRemoveFixedItemPart={(item, part) => handleRemoveFixedItemPart(procedure.name, item, part)}
                      onRemoveSelectableItemPart={(item, part) => handleRemoveSelectableItemPart(procedure.name, item, part)}
                      onAddBox={(boxNumber) => handleAddBox(procedure.name, boxNumber)}
                      onRemoveBox={(index) => handleRemoveBox(procedure.name, index)}
                    />
                  ))}
                </div>
              )}

              {/* Mode Panel (Procedure List vs Manual DC) */}
              {dcMode === 'procedure' ? (
                <>
                  {/* Procedure Selector - Show full selector or compact button */}
                  {showProcedureSelector ? (
                    <div className="glass-card rounded-xl p-2.5 sm:p-4 min-w-0">
                      <h2 className="font-display font-semibold text-base sm:text-lg mb-2 sm:mb-4">Select Procedures</h2>
                      {loading ? (
                        <div className="py-12 text-center text-muted-foreground">Loading procedures...</div>
                      ) : (
                        <ProcedureSelector
                          procedures={procedures}
                          procedureTypes={procedureTypes}
                          activeProcedureNames={activeProcedures.map((p) => p.name)}
                          onSelectProcedure={handleSelectProcedure}
                          searchProcedures={searchProcedures}
                          initialFilterType={initialFilterType}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="glass-card rounded-xl p-2.5 sm:p-4 flex items-center justify-center min-w-0">
                      <Button
                        onClick={() => {
                          setDcMode('procedure');
                          setInitialFilterType('All');
                          setShowProcedureSelector(true);
                        }}
                        className="btn-gradient w-full sm:w-auto"
                        size="lg"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Procedure
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-md p-3 sm:p-5 space-y-4 min-w-0 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-base sm:text-lg">Manual DC</h2>
                      <div className="text-xs text-muted-foreground">
                        Add items/instruments/boxes manually
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={manualMaterialType} onValueChange={setManualMaterialType}>
                        <SelectTrigger className="h-8 sm:h-9 w-[100px] sm:w-[140px] text-xs bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SS">SS</SelectItem>
                          <SelectItem value="Titanium">Titanium</SelectItem>
                          <SelectItem value="None">No Prefix</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs border-2 border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                        onClick={handleClearManualEntry}
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Clear</span><span className="xs:hidden">×</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs border-border/70 bg-background/70"
                        onClick={() => {
                          setDcMode('procedure');
                          setInitialFilterType('All');
                          setShowProcedureSelector(true);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Procedure List</span><span className="sm:hidden">Proc</span>
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
                          <span className="text-xs text-muted-foreground hidden sm:inline">Search → select → add</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">{manualItems.length} added</div>
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
                              if (manualItemQuery.trim().length > 0) {
                                setManualItemSuggestionsOpen(true);
                                setManualItemActiveIndex((idx) => (idx < 0 ? 0 : idx));
                              }
                            }}
                            onBlur={() => {
                              // allow click selection to run first
                              setTimeout(() => setManualItemSuggestionsOpen(false), 120);
                            }}
                            onKeyDown={(e) => {
                              const hasSuggestions = normalizedItemSuggestions.length > 0 && manualItemQuery.trim().length > 0;
                              if (!hasSuggestions) return;

                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setManualItemSuggestionsOpen(true);
                                setManualItemActiveIndex((idx) => {
                                  const next = idx < 0 ? 0 : Math.min(idx + 1, normalizedItemSuggestions.length - 1);
                                  return next;
                                });
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setManualItemSuggestionsOpen(true);
                                setManualItemActiveIndex((idx) => {
                                  const next = idx < 0 ? normalizedItemSuggestions.length - 1 : Math.max(idx - 1, 0);
                                  return next;
                                });
                              } else if (e.key === 'Enter' || e.key === 'Tab') {
                                if (manualItemSuggestionsOpen) {
                                  const idx = manualItemActiveIndex >= 0 ? manualItemActiveIndex : 0;
                                  const v = normalizedItemSuggestions[idx];
                                  if (v) {
                                    e.preventDefault();
                                    selectManualItemSuggestion(v);
                                  }
                                }
                              } else if (e.key === 'Escape') {
                                setManualItemSuggestionsOpen(false);
                                setManualItemActiveIndex(-1);
                              }
                            }}
                            placeholder="Search items..."
                            className="pl-8 h-9 bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600"
                            aria-autocomplete="list"
                            aria-expanded={manualItemSuggestionsOpen}
                          />
                        </div>
                        {manualItemSuggestionsOpen && manualItemQuery.trim().length > 0 && normalizedItemSuggestions.length > 0 && (
                          <div
                            className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-auto"
                            role="listbox"
                          >
                            {normalizedItemSuggestions.map((s, idx) => (
                              <button
                                key={s}
                                type="button"
                                role="option"
                                aria-selected={idx === manualItemActiveIndex}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${idx === manualItemActiveIndex
                                  ? 'bg-blue-600 text-white'
                                  : 'hover:bg-slate-100 text-slate-900'
                                  }`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  selectManualItemSuggestion(s);
                                }}
                                onMouseEnter={() => setManualItemActiveIndex(idx)}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${idx === manualItemActiveIndex ? 'bg-white' : 'bg-blue-300'
                                      }`}
                                  />
                                  <span className="truncate">{s}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Size, Qty, and Add button in a row */}
                      <div className="grid grid-cols-[1fr_80px_auto] gap-2 items-end">
                        <div>
                          <Label className="text-xs">Size</Label>
                          <Input
                            value={manualItemSize}
                            onChange={(e) => setManualItemSize(e.target.value)}
                            placeholder="Optional"
                            className="mt-1 h-9 bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            value={manualItemQty}
                            onChange={(e) => setManualItemQty(e.target.value)}
                            min="1"
                            className="mt-1 h-9 bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            const name = manualItemName.trim();
                            const qtyNum = Math.max(1, parseInt(manualItemQty || '1', 10) || 1);
                            if (!name) {
                              toast({ title: 'Item is required' });
                              return;
                            }
                            setManualItems((prev) => [...prev, { name, size: manualItemSize.trim(), qty: qtyNum }]);
                            setManualItemName('');
                            setManualItemQuery('');
                            setManualItemSize('');
                            setManualItemQty('1');
                          }}
                          className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm"
                        >
                          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add</span>
                        </Button>
                      </div>
                    </div>

                    {manualItems.length > 0 && (
                      <div className="rounded-lg border border-border/60 overflow-hidden bg-background/80">
                        {/* Mobile view */}
                        <div className="sm:hidden divide-y divide-border/60">
                          {manualItems.map((it, idx) => (
                            <div key={`${it.name}-${idx}`} className="p-2.5 flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{it.name}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Size: {it.size || '-'} • Qty: <span className="font-semibold text-foreground">{it.qty}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive flex-shrink-0 p-1"
                                onClick={() => setManualItems((prev) => prev.filter((_, i) => i !== idx))}
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
                              <div key={`${it.name}-${idx}`} className="grid grid-cols-[1fr_120px_70px_40px] gap-2 px-3 py-2 text-sm">
                                <div className="truncate">{it.name}</div>
                                <div className="truncate text-muted-foreground">{it.size || '-'}</div>
                                <div className="text-right font-semibold">{it.qty}</div>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-destructive flex items-center justify-center"
                                  onClick={() => setManualItems((prev) => prev.filter((_, i) => i !== idx))}
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
                        <span className="text-xs text-muted-foreground hidden sm:inline">Pick with procedure badge</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">{manualInstruments.length} added</div>
                    </div>
                    <div className="relative">
                      <Label className="text-xs">Instrument</Label>
                      <div className="relative mt-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={manualInstrumentQuery}
                          onChange={(e) => {
                            setManualInstrumentQuery(e.target.value);
                            setManualInstrumentSuggestionsOpen(true);
                            setManualInstrumentActiveIndex(0);
                          }}
                          placeholder="Search instruments..."
                          className="pl-8 h-9 bg-background border-2 border-slate-400 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-600"
                          onFocus={() => {
                            if (manualInstrumentQuery.trim().length > 0) {
                              setManualInstrumentSuggestionsOpen(true);
                              setManualInstrumentActiveIndex((idx) => (idx < 0 ? 0 : idx));
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => setManualInstrumentSuggestionsOpen(false), 120);
                          }}
                          onKeyDown={(e) => {
                            const hasSuggestions = instrumentSuggestions.length > 0 && manualInstrumentQuery.trim().length > 0;
                            if (!hasSuggestions) return;

                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setManualInstrumentSuggestionsOpen(true);
                              setManualInstrumentActiveIndex((idx) => {
                                const next = idx < 0 ? 0 : Math.min(idx + 1, instrumentSuggestions.length - 1);
                                return next;
                              });
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setManualInstrumentSuggestionsOpen(true);
                              setManualInstrumentActiveIndex((idx) => {
                                const next = idx < 0 ? instrumentSuggestions.length - 1 : Math.max(idx - 1, 0);
                                return next;
                              });
                            } else if (e.key === 'Enter' || e.key === 'Tab') {
                              if (manualInstrumentSuggestionsOpen) {
                                const idx = manualInstrumentActiveIndex >= 0 ? manualInstrumentActiveIndex : 0;
                                const v = instrumentSuggestions[idx]?.instrument;
                                if (v) {
                                  e.preventDefault();
                                  selectManualInstrumentSuggestion(v);
                                }
                              }
                            } else if (e.key === 'Escape') {
                              setManualInstrumentSuggestionsOpen(false);
                              setManualInstrumentActiveIndex(-1);
                            }
                          }}
                          aria-autocomplete="list"
                          aria-expanded={manualInstrumentSuggestionsOpen}
                        />
                      </div>
                      {manualInstrumentSuggestionsOpen && manualInstrumentQuery.trim().length > 0 && instrumentSuggestions.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-auto" role="listbox">
                          {instrumentSuggestions.map((s, idx) => (
                            <button
                              key={`${s.instrument}-${s.procedureName}`}
                              type="button"
                              role="option"
                              aria-selected={idx === manualInstrumentActiveIndex}
                              className={`w-full text-left px-2.5 sm:px-3 py-2 text-sm transition-colors ${idx === manualInstrumentActiveIndex ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
                                }`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                selectManualInstrumentSuggestion(s.instrument);
                              }}
                              onMouseEnter={() => setManualInstrumentActiveIndex(idx)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${idx === manualInstrumentActiveIndex ? 'bg-white' : 'bg-blue-300'}`} />
                                  <div className="font-medium truncate text-xs sm:text-sm">{s.instrument}</div>
                                </div>
                                <Badge
                                  variant="secondary"
                                  className={`h-5 px-1.5 text-[9px] sm:text-[10px] shrink-0 ${idx === manualInstrumentActiveIndex ? 'bg-white/15 text-white border-white/20' : ''
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
                          <span key={inst} className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-xs bg-muted/20">
                            {inst}
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setManualInstruments((prev) => prev.filter((x) => x !== inst))}
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
                        <span className="text-xs text-muted-foreground">Optional</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">{manualBoxNumbers.length} added</div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={manualBoxInput}
                        onChange={(e) => setManualBoxInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const trimmed = manualBoxInput.trim();
                            if (!trimmed) return;
                            setManualBoxNumbers((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
                            setManualBoxInput('');
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
                          setManualBoxNumbers((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
                          setManualBoxInput('');
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    {manualBoxNumbers.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {manualBoxNumbers.map((b) => (
                          <span key={b} className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-xs bg-muted/20">
                            {b}
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setManualBoxNumbers((prev) => prev.filter((x) => x !== b))}
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

              {/* Submission Form (Save DC)
                - Manual mode: always show (manual entries are the "selection")
                - Procedure mode: show only when at least one active procedure is selected */}
              {(dcMode === 'manual' || activeProcedures.length > 0) && (
                <div id="dc-submission" className="glass-card rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display font-semibold text-base sm:text-lg">Submission</h3>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {hospitalName || dcNo || receivedBy ? (
                      <div className="space-y-0.5">
                        <div><span className="font-semibold text-foreground">Hospital:</span> {hospitalName || '-'}</div>
                        <div><span className="font-semibold text-foreground">DC No:</span> {dcNo || '-'}</div>
                        <div><span className="font-semibold text-foreground">Received By:</span> {receivedBy || '-'}</div>
                      </div>
                    ) : (
                      <div>Enter Hospital / DC details in the popup before saving or printing.</div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => {
                        if (!hospitalName || !dcNo || !receivedBy) {
                          setShowSettingsModal(true);
                        } else {
                          setShowConfirmSaveDialog(true);
                        }
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
                        <>
                          <Save className="w-4 h-4" />
                          Save DC
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Summary */}
            <div className="lg:col-span-1 min-w-0 lg:border-l lg:border-border lg:pl-6">
              {/* Mobile: Toggleable Summary */}
              <div className="lg:hidden mb-4">
                <button
                  onClick={() => setShowSummaryMobile(!showSummaryMobile)}
                  className="w-full glass-card rounded-xl p-3 flex items-center justify-between"
                >
                  <h2 className="font-display font-semibold text-base">Summary</h2>
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

              {/* Desktop: Always visible Summary */}
              <div className="hidden lg:block">
                <div className="glass-card rounded-xl p-3 sm:p-4 sticky top-24">
                  <h2 className="font-display font-semibold text-base sm:text-lg mb-3 sm:mb-4">Summary</h2>
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
          </div>
        </main>
      </div >

      {/* Settings Modal */}
      < Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal} >
        <DialogContent>
          <DialogHeader><DialogTitle>DC Details</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div><Label>Hospital Name</Label><Input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} placeholder="Enter hospital name" className="mt-1" /></div>
            <div><Label>DC Number</Label><Input value={dcNo} onChange={(e) => setDcNo(e.target.value)} placeholder="Enter DC number" className="mt-1" /></div>
            <div><Label>Delivered By *</Label><Input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} placeholder="Enter deliverer name" className="mt-1" /></div>
            <div><Label>Received By *</Label><Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Enter receiver name" className="mt-1" /></div>
            <div><Label>Remarks</Label><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add remarks (optional)" className="mt-1" /></div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => {
                  if (!hospitalName || !dcNo || !receivedBy || !deliveredBy) {
                    toast({
                      title: 'Missing information',
                      description: 'Please fill in all mandatory fields (*)',
                      variant: 'destructive'
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
                  'Save DC'
                )}
              </Button>
              <Button onClick={() => {
                if (!hospitalName || !dcNo || !receivedBy || !deliveredBy) {
                  toast({
                    title: 'Missing information',
                    description: 'Please fill in all mandatory fields (*)',
                    variant: 'destructive'
                  });
                  return;
                }
                setShowSettingsModal(false);
                setShowConfirmSaveDialog(true);
              }} className="w-full sm:flex-1" variant="outline" disabled={isSavingDc}>
                Save & Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Confirm Save Dialog */}
      < Dialog open={showConfirmSaveDialog} onOpenChange={setShowConfirmSaveDialog} >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Save to Google Sheets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
              <div className="text-sm">
                <span className="font-semibold">Hospital:</span>{' '}
                <span className="text-muted-foreground">{hospitalName}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">DC No:</span>{' '}
                <span className="text-muted-foreground">{dcNo}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Delivered By:</span>{' '}
                <span className="text-muted-foreground">{deliveredBy}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Received By:</span>{' '}
                <span className="text-muted-foreground">{receivedBy}</span>
              </div>
              <div className="text-sm flex items-center gap-2 pt-1 border-t border-border/50 mt-1">
                <span className="font-semibold whitespace-nowrap">DC Date:</span>
                <Input
                  type="date"
                  value={customDcDate}
                  onChange={(e) => setCustomDcDate(e.target.value)}
                  className="h-8 py-0 px-2 text-xs bg-white border-slate-300 focus:ring-blue-500 w-full"
                />
              </div>
              {(() => {
                const { items, instruments, boxNumbers } = buildSavePayload();
                const totalItems = items.reduce((sum, item) => sum + item.sizes.reduce((s, size) => s + size.qty, 0), 0);
                return (
                  <>
                    <div className="text-sm">
                      <span className="font-semibold">Total Items:</span>{' '}
                      <span className="text-muted-foreground">{totalItems}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">Instruments:</span>{' '}
                      <span className="text-muted-foreground">{instruments.length}</span>
                    </div>
                    {boxNumbers.length > 0 && (
                      <div className="text-sm">
                        <span className="font-semibold">Box Numbers:</span>{' '}
                        <span className="text-muted-foreground">{boxNumbers.length}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <p className="text-sm text-muted-foreground">
              This DC will be saved to Google Sheets. You can manage it later from the "Saved DC List".
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmSaveDialog(false);
                  setShowSettingsModal(true);
                }}
                className="w-full sm:flex-1"
                disabled={isSavingDc}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setShowConfirmSaveDialog(false);
                  const success = await handleSaveDc();
                  if (!success) {
                    setShowSettingsModal(true);
                  } else {
                    // Optionally open print dialog after successful save
                    // setShowPrintModal(true);
                  }
                }}
                className="w-full sm:flex-1"
                disabled={isSavingDc}
              >
                {isSavingDc ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving to Sheets...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Confirm & Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Print Modal */}
      < Dialog open={showPrintModal} onOpenChange={setShowPrintModal} >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader className="no-print">
            <DialogTitle>Print Preview</DialogTitle>
          </DialogHeader>
          <div data-print-content>
            <PrintPreview
              ref={printRef}
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
          <div className="flex gap-3 mt-4 no-print" data-no-print>
            <Button onClick={handlePrintPDF} className="flex-1"><Printer className="w-4 h-4 mr-2" />Print</Button>
            <Button onClick={handleSavePDF} variant="outline" className="flex-1"><Download className="w-4 h-4 mr-2" />Save PDF</Button>
          </div>
        </DialogContent>
      </Dialog >
    </div >
  );
}
