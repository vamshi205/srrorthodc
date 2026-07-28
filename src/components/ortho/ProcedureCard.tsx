import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
  Package,
  Wrench,
  X,
  Plus,
  Info,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActiveProcedure, SizeQty } from '@/types/procedure';
import { InstrumentImageModal } from './InstrumentImageModal';

interface ProcedureCardProps {
  procedure: ActiveProcedure;
  index?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onRemove: () => void;
  onRefresh: () => void;
  onMaterialTypeChange: (materialType: string) => void;
  onItemToggle: (itemName: string, checked: boolean) => void;
  onSizeQtyChange: (itemName: string, sizeQty: SizeQty[]) => void;
  onFixedItemToggle: (itemName: string, checked: boolean) => void;
  onFixedQtyChange: (itemName: string, qty: string) => void;
  onAddInstrument: (instrument: string) => void;
  onRemoveInstrument: (instrument: string) => void;
  onAddItem: (itemName: string) => void;
  onSearchItems: (query: string) => string[];
  instrumentSuggestions: string[];
  onSearchInstruments: (query: string) => Array<{ instrument: string; procedureName: string }>;
  onRemoveFixedItemPart: (itemName: string, partToRemove: string) => void;
  onRemoveSelectableItemPart: (itemName: string, partToRemove: string) => void;
  onAddBox: (boxNumber: string) => void;
  onRemoveBox: (index: number) => void;
}

function parseSizeQtyFromItem(item: string): { name: string; sizeQty: SizeQty[] } {
  const match = item.match(/^(.+?)\s*\{(.+)\}$/);
  if (!match) {
    return { name: item.trim(), sizeQty: [] };
  }

  const name = match[1].trim();
  const pairs = match[2].split(',').map((pair) => {
    const [size, qty] = pair.split(':').map((s) => s.trim());
    return { size: size || '', qty: qty || '1' };
  });

  return { name, sizeQty: pairs };
}

function splitItemNameByComma(itemName: string): { parts: string[]; hasCommas: boolean } {
  if (!itemName || !itemName.includes(',')) {
    return { parts: [itemName], hasCommas: false };
  }
  const parts = itemName.split(',').map(part => part.trim()).filter(Boolean);
  return { parts, hasCommas: parts.length > 1 };
}

export function ProcedureCard({
  procedure,
  index,
  isCollapsed,
  onToggleCollapse,
  onRemove,
  onRefresh,
  onMaterialTypeChange,
  onItemToggle,
  onSizeQtyChange,
  onFixedItemToggle,
  onFixedQtyChange,
  onAddInstrument,
  onRemoveInstrument,
  onAddItem,
  onSearchItems,
  onSearchInstruments,
  onRemoveFixedItemPart,
  onRemoveSelectableItemPart,
  onAddBox,
  onRemoveBox,
}: ProcedureCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newInstrument, setNewInstrument] = useState('');
  const [newBoxNumber, setNewBoxNumber] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ instrument: string; procedureName: string }>>([]);
  const [instrumentSuggestionActiveIndex, setInstrumentSuggestionActiveIndex] = useState(-1);
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set());
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    name: string;
    url: string | null;
    fallbackUrls?: {
      thumbnail: string;
      preview: string;
      uc: string;
      original: string;
    } | null;
  } | null>(null);
  const [allImages, setAllImages] = useState<Array<{
    name: string;
    url: string;
    fallbackUrls?: {
      thumbnail: string;
      preview: string;
      uc: string;
      original: string;
    } | null;
  }>>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [newItem, setNewItem] = useState('');
  const [itemSuggestions, setItemSuggestions] = useState<string[]>([]);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [itemSuggestionActiveIndex, setItemSuggestionActiveIndex] = useState(-1);
  const instrumentInputRef = useRef<HTMLDivElement>(null);
  const itemInputRef = useRef<HTMLDivElement>(null);
  const [instrumentDropdownPos, setInstrumentDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [itemDropdownPos, setItemDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  
  // Auto-show details when item is selected
  useEffect(() => {
    const selectedItemNames = Array.from(procedure.selectedItems.keys());
    setShowDetails((prev) => {
      const next = new Set(prev);
      selectedItemNames.forEach((name) => {
        next.add(name);
      });
      return next;
    });
  }, [procedure.selectedItems]);

  // Update dropdown positions on scroll/resize
  useEffect(() => {
    const updatePositions = () => {
      if (suggestions.length > 0 && instrumentInputRef.current) {
        try {
          const rect = instrumentInputRef.current.getBoundingClientRect();
          setInstrumentDropdownPos({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: rect.width,
          });
        } catch (e) {
          // Silently fail if ref is not ready
        }
      }
      if (showItemSuggestions && itemSuggestions.length > 0 && itemInputRef.current) {
        try {
          const rect = itemInputRef.current.getBoundingClientRect();
          setItemDropdownPos({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: rect.width,
          });
        } catch (e) {
          // Silently fail if ref is not ready
        }
      }
    };

    if (suggestions.length > 0 || showItemSuggestions) {
      // Use setTimeout to ensure refs are ready
      const timeoutId = setTimeout(() => {
        updatePositions();
      }, 0);
      
      window.addEventListener('scroll', updatePositions, true);
      window.addEventListener('resize', updatePositions);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('scroll', updatePositions, true);
        window.removeEventListener('resize', updatePositions);
      };
    }
  }, [suggestions.length, showItemSuggestions, itemSuggestions.length]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const handleClickOutside = (event: MouseEvent) => {
      try {
        const target = event.target as Node;
        if (suggestions.length > 0 && instrumentInputRef.current && !instrumentInputRef.current.contains(target)) {
          // Check if click is on portal dropdown
          const portalDropdown = document.querySelector('[data-instrument-dropdown]');
          if (!portalDropdown?.contains(target)) {
            setSuggestions([]);
            setInstrumentDropdownPos(null);
          }
        }
        if (showItemSuggestions && itemInputRef.current && !itemInputRef.current.contains(target)) {
          // Check if click is on portal dropdown
          const portalDropdown = document.querySelector('[data-item-dropdown]');
          if (!portalDropdown?.contains(target)) {
            setShowItemSuggestions(false);
            setItemDropdownPos(null);
          }
        }
      } catch (e) {
        // Silently fail if there's an error
      }
    };

    if (suggestions.length > 0 || showItemSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [suggestions.length, showItemSuggestions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const handleInstrumentInput = (value: string) => {
    setNewInstrument(value);
    if (value.length >= 2) {
      const results = onSearchInstruments(value);
      const available = results.filter((r) => !procedure.instruments.includes(r.instrument));
      const sliced = available.slice(0, 5);
      setSuggestions(sliced);
      setInstrumentSuggestionActiveIndex(sliced.length > 0 ? 0 : -1);
      // Calculate position for portal
      if (instrumentInputRef.current) {
        const rect = instrumentInputRef.current.getBoundingClientRect();
        setInstrumentDropdownPos({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    } else {
      setSuggestions([]);
      setInstrumentSuggestionActiveIndex(-1);
      setInstrumentDropdownPos(null);
    }
  };

  const handleAddInstrument = (instrument: string) => {
    if (instrument.trim() && !procedure.instruments.includes(instrument.trim())) {
      onAddInstrument(instrument.trim());
    }
    setNewInstrument('');
    setSuggestions([]);
    setInstrumentSuggestionActiveIndex(-1);
    setInstrumentDropdownPos(null);
  };

  const handleItemInput = (value: string) => {
    setNewItem(value);
    if (value.length >= 2) {
      const results = onSearchItems(value);
      const available = results.filter((r) => !procedure.items.includes(r));
      const sliced = available.slice(0, 5);
      setItemSuggestions(sliced);
      setShowItemSuggestions(sliced.length > 0);
      setItemSuggestionActiveIndex(sliced.length > 0 ? 0 : -1);
      // Calculate position for portal
      if (itemInputRef.current) {
        const rect = itemInputRef.current.getBoundingClientRect();
        setItemDropdownPos({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    } else {
      setItemSuggestions([]);
      setShowItemSuggestions(false);
      setItemSuggestionActiveIndex(-1);
      setItemDropdownPos(null);
    }
  };

  const handleAddItem = (itemName?: string) => {
    const itemToAdd = itemName || newItem.trim();
    if (itemToAdd && !procedure.items.includes(itemToAdd)) {
      onAddItem(itemToAdd);
      setNewItem('');
      setItemSuggestions([]);
      setShowItemSuggestions(false);
      setItemSuggestionActiveIndex(-1);
      setItemDropdownPos(null);
    }
  };

  const toggleItemDetails = (itemName: string) => {
    setShowDetails((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      return next;
    });
  };

  // Convert Google Drive URL to working format
  const convertGoogleDriveUrl = (url: string | null): {
    thumbnail: string;
    preview: string;
    uc: string;
    original: string;
  } | null => {
    if (!url) return null;
    
    // Extract file ID from various Google Drive URL formats
    let fileId: string | null = null;
    
    // Format 1: https://drive.google.com/uc?export=view&id=FILE_ID
    const ucMatch = url.match(/[?&]id=([^&]+)/);
    if (ucMatch) {
      fileId = ucMatch[1];
    }
    
    // Format 2: https://drive.google.com/file/d/FILE_ID/view or /preview
    const fileMatch = url.match(/\/file\/d\/([^\/\?]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    }
    
    // Format 3: https://drive.google.com/open?id=FILE_ID
    const openMatch = url.match(/open[?&]id=([^&]+)/);
    if (openMatch) {
      fileId = openMatch[1];
    }
    
    // Format 4: Direct thumbnail URL - extract ID
    const thumbnailMatch = url.match(/thumbnail[?&]id=([^&]+)/);
    if (thumbnailMatch) {
      fileId = thumbnailMatch[1];
    }
    
    // Format 5: Already a direct image URL (ends with image extension)
    if (url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
      // It's already a direct image URL, return it as all formats
      return {
        thumbnail: url,
        preview: url,
        uc: url,
        original: url
      };
    }
    
    if (!fileId) {
      // If we can't extract file ID, return the original URL as all formats
      return {
        thumbnail: url,
        preview: url,
        uc: url,
        original: url
      };
    }
    
    // Return multiple working formats
    return {
      thumbnail: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
      preview: `https://drive.google.com/file/d/${fileId}/preview`,
      uc: `https://drive.google.com/uc?export=view&id=${fileId}`,
      original: url
    };
  };

  const handleShowImage = (
    itemName: string,
    imageMapping: Record<string, string | null> | undefined,
    allItems: string[]
  ) => {
    // Get all items with images
    const itemsWithImages = allItems
      .filter((item) => imageMapping?.[item])
      .map((item) => {
        const imageUrl = imageMapping?.[item] || null;
        const urlOptions = convertGoogleDriveUrl(imageUrl);
        const workingUrl = urlOptions ? urlOptions.thumbnail : imageUrl;
        return {
          name: item,
          url: workingUrl,
          fallbackUrls: urlOptions
        };
      });

    if (itemsWithImages.length > 0) {
      setAllImages(itemsWithImages);
      const index = itemsWithImages.findIndex((img) => img.name === itemName);
      setCurrentImageIndex(index >= 0 ? index : 0);
      
      const selected = itemsWithImages[index >= 0 ? index : 0];
      setSelectedImage({
        name: selected.name,
        url: selected.url,
        fallbackUrls: selected.fallbackUrls
      });
      setShowImageModal(true);
    }
  };

  const handleShowInstrumentImage = (instrumentName: string) => {
    handleShowImage(instrumentName, procedure.instrumentImageMapping, procedure.instruments);
  };

  const handleShowFixedItemImage = (itemName: string) => {
    const fixedItemNames = procedure.fixedItems.map(item => item.name);
    handleShowImage(itemName, procedure.fixedItemImageMapping, fixedItemNames);
  };

  const handleShowSelectableItemImage = (itemName: string) => {
    // Extract item names from items (remove size/qty patterns)
    const itemNames = procedure.items.map(item => {
      const parsed = parseSizeQtyFromItem(item);
      return parsed.name;
    });
    handleShowImage(itemName, procedure.itemImageMapping, itemNames);
  };

  const handleNavigateImage = (newIndex: number) => {
    if (allImages.length > 0 && newIndex >= 0 && newIndex < allImages.length) {
      setCurrentImageIndex(newIndex);
      const selected = allImages[newIndex];
      setSelectedImage({
        name: selected.name,
        url: selected.url,
        fallbackUrls: selected.fallbackUrls
      });
    }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden animate-fade-in border-2 border-teal-500/30 shadow-lg bg-white mb-6">
      {/* Premium Active Procedure Header */}
      <div className="flex flex-col items-stretch gap-1.5 border-b-2 border-teal-500/20 bg-gradient-to-r from-teal-50 via-slate-50 to-teal-50/40 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4">
        <button
          onClick={onToggleCollapse}
          className="flex w-full min-w-0 items-center gap-2.5 text-left sm:flex-1"
        >
          <div className="w-8 h-8 rounded-lg bg-teal-600/10 border border-teal-500/30 flex items-center justify-center text-teal-700 shrink-0">
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronUp className="w-5 h-5" />
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {typeof index === 'number' && (
              <Badge className="shrink-0 bg-teal-700 px-2 py-0.5 text-xs font-extrabold text-white shadow-sm">
                <span className="sm:hidden">P{index + 1}</span>
                <span className="hidden sm:inline">Procedure #{index + 1}</span>
              </Badge>
            )}
            <h3 className="break-words font-display text-base font-extrabold leading-tight tracking-tight text-slate-900 sm:text-lg sm:truncate">{procedure.name}</h3>
            <Badge variant="outline" className="hidden shrink-0 border-teal-300 bg-teal-100/60 text-xs font-semibold text-teal-700 sm:inline-flex">
              {procedure.type}
            </Badge>
          </div>
        </button>
        <div className="flex items-center gap-2 self-end sm:shrink-0 sm:self-auto sm:gap-2.5">
          <div className="rounded-lg border border-slate-300 bg-white px-1.5 py-0.5 shadow-xs sm:flex sm:items-center sm:gap-1.5 sm:px-2 sm:py-1">
            <span className="hidden text-[11px] font-bold uppercase tracking-wider text-slate-600 sm:inline">Material:</span>
            <Select value={procedure.materialType} onValueChange={onMaterialTypeChange}>
              <SelectTrigger aria-label="Material type" className="h-7 w-[92px] border-none bg-white p-0 text-xs font-bold text-teal-800 shadow-none focus:ring-0 sm:w-[105px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SS">SS</SelectItem>
                <SelectItem value="Titanium">Titanium</SelectItem>
                <SelectItem value="None">No Prefix</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 text-slate-600 hover:text-teal-700 hover:bg-teal-100/50 rounded-lg"
            title="Reset Procedure Items"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
            title="Remove Procedure"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4 space-y-6 overflow-visible">
          {/* 1. Fixed Items Section */}
          {procedure.fixedItems.length > 0 && (
            <div className="rounded-xl border-2 border-emerald-300/80 bg-emerald-50/40 p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-emerald-600 text-white shadow-2xs">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-emerald-950">Fixed Items ({procedure.fixedItems.length})</h4>
                    <p className="text-[11px] font-semibold text-emerald-700">Pre-defined essential implants with quantities</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {procedure.fixedItems.map((fixedItem, fixedIndex) => {
                  const isSelected = procedure.selectedFixedItems.get(fixedItem.name) ?? true;
                  const editedQty = procedure.fixedQtyEdits.get(fixedItem.name) ?? fixedItem.qty;
                  return (
                    <div 
                      key={`${procedure.name}-fixed-${fixedIndex}-${fixedItem.name}`} 
                      className={`flex flex-wrap sm:flex-nowrap items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                        isSelected 
                          ? 'bg-white border-2 border-emerald-500 shadow-2xs' 
                          : 'bg-slate-100/80 border border-slate-200 opacity-60'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          onFixedItemToggle(fixedItem.name, checked as boolean)
                        }
                        className="w-5 h-5 rounded-md border-2 border-slate-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 shrink-0 cursor-pointer"
                      />
                      <div className="flex-1 flex items-center gap-1.5 min-w-0 flex-wrap">
                        {(() => {
                          const { parts, hasCommas } = splitItemNameByComma(fixedItem.name);
                          if (hasCommas) {
                            return (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {parts.map((part, idx) => (
                                  <span key={`${procedure.name}-${fixedItem.name}-${idx}-${part}`} className="inline-flex items-baseline gap-0.5">
                                    <span className={`text-sm ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                                      {part}
                                    </span>
                                    <sup className="inline-block">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          onRemoveFixedItemPart(fixedItem.name, part);
                                        }}
                                        className="hover:bg-rose-100 rounded-full p-0.5 text-rose-600 flex-shrink-0 ml-0.5"
                                        title={`Remove ${part}`}
                                        type="button"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </sup>
                                    {idx < parts.length - 1 && (
                                      <span className="text-slate-400 font-bold">,</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            );
                          }
                          return (
                            <span className={`text-sm ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-600'} min-w-0 break-words`}>
                              {fixedItem.name}
                            </span>
                          );
                        })()}
                        {procedure.fixedItemImageMapping?.[fixedItem.name] && (
                          <button
                            onClick={() => handleShowFixedItemImage(fixedItem.name)}
                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-full p-1 transition-colors shrink-0 border border-emerald-300"
                            title={`View image of ${fixedItem.name}`}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {procedure.fixedItemLocationMapping?.[fixedItem.name] && (
                          <span 
                            className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300"
                            title={`Room: ${procedure.fixedItemLocationMapping[fixedItem.name]?.room || '-'}, Rack: ${procedure.fixedItemLocationMapping[fixedItem.name]?.rack || '-'}, Box: ${procedure.fixedItemLocationMapping[fixedItem.name]?.box || '-'}`}
                          >
                            <MapPin className="w-2.5 h-2.5 inline mr-0.5 text-emerald-600" />
                            {procedure.fixedItemLocationMapping[fixedItem.name]?.room || '-'}/{procedure.fixedItemLocationMapping[fixedItem.name]?.rack || '-'}/{procedure.fixedItemLocationMapping[fixedItem.name]?.box || '-'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-emerald-950">Qty:</span>
                        <Input
                          type="number"
                          min="1"
                          value={editedQty}
                          onChange={(e) => onFixedQtyChange(fixedItem.name, e.target.value)}
                          className="w-16 h-8 text-center font-extrabold border-2 border-emerald-400 bg-white text-slate-900 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Selectable Items Section */}
          <div className="rounded-xl border-2 border-blue-300/80 bg-blue-50/40 p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-blue-600 text-white shadow-2xs">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-blue-950">Selectable Items ({procedure.items.length})</h4>
                  <p className="text-[11px] font-semibold text-blue-700">Choose optional implants and configure sizes/quantities</p>
                </div>
              </div>
            </div>
            {procedure.items.length > 0 ? (
              <div className="space-y-2.5">
                {procedure.items.map((item, itemIndex) => {
                  const parsed = parseSizeQtyFromItem(item);
                  const selectedItem = procedure.selectedItems.get(parsed.name);
                  const isSelected = !!selectedItem;
                  const sizeQty = selectedItem?.sizeQty || parsed.sizeQty;
                  const showItemDetails = isSelected ? (showDetails.has(parsed.name) || sizeQty.length > 0) : false;

                  return (
                    <div key={`${procedure.name}-item-${itemIndex}-${item}`} className="space-y-2">
                      <div className={`flex flex-wrap sm:flex-nowrap items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                        isSelected 
                          ? 'bg-white border-2 border-blue-500 shadow-2xs' 
                          : 'bg-slate-100/80 border border-slate-200 opacity-60'
                      }`}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            onItemToggle(parsed.name, checked as boolean);
                            setShowDetails((prev) => {
                              const next = new Set(prev);
                              if (checked) {
                                next.add(parsed.name);
                              } else {
                                next.delete(parsed.name);
                              }
                              return next;
                            });
                            if (checked) {
                              if (parsed.sizeQty.length > 0) {
                                onSizeQtyChange(parsed.name, parsed.sizeQty);
                              } else {
                                onSizeQtyChange(parsed.name, [{ size: '', qty: '1' }]);
                              }
                            }
                          }}
                          className="w-5 h-5 rounded border-2 border-slate-500 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 shrink-0 cursor-pointer"
                        />
                        <div className="flex-1 flex items-center gap-1.5 min-w-0 flex-wrap">
                          {(() => {
                            const { parts, hasCommas } = splitItemNameByComma(parsed.name);
                            if (hasCommas) {
                              return (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {parts.map((part, idx) => (
                                    <span key={`${procedure.name}-${parsed.name}-${idx}-${part}`} className="inline-flex items-baseline gap-0.5">
                                      <span className={`text-sm ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                                        {part}
                                      </span>
                                      <sup className="inline-block">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            onRemoveSelectableItemPart(parsed.name, part);
                                          }}
                                          className="hover:bg-rose-100 rounded-full p-0.5 text-rose-600 flex-shrink-0 ml-0.5"
                                          title={`Remove ${part}`}
                                          type="button"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </sup>
                                      {idx < parts.length - 1 && (
                                        <span className="text-slate-400 font-bold">,</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <span className={`text-sm ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-600'} min-w-0 break-words`}>
                                {parsed.name}
                              </span>
                            );
                          })()}
                          {procedure.itemImageMapping?.[parsed.name] && (
                            <button
                              onClick={() => handleShowSelectableItemImage(parsed.name)}
                              className="bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full p-1 transition-colors shrink-0 border border-blue-300"
                              title={`View image of ${parsed.name}`}
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {procedure.itemLocationMapping?.[parsed.name] && (
                            <span 
                              className="text-[10px] font-bold text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded border border-blue-300"
                              title={`Room: ${procedure.itemLocationMapping[parsed.name]?.room || '-'}, Rack: ${procedure.itemLocationMapping[parsed.name]?.rack || '-'}, Box: ${procedure.itemLocationMapping[parsed.name]?.box || '-'}`}
                            >
                              <MapPin className="w-2.5 h-2.5 inline mr-0.5 text-blue-600" />
                              {procedure.itemLocationMapping[parsed.name]?.room || '-'}/{procedure.itemLocationMapping[parsed.name]?.rack || '-'}/{procedure.itemLocationMapping[parsed.name]?.box || '-'}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-bold text-blue-950">Qty:</span>
                            <Input
                              type="number"
                              min="1"
                              value={sizeQty[0]?.qty || '1'}
                              onChange={(e) => {
                                const currentSize = sizeQty[0]?.size || '';
                                onSizeQtyChange(parsed.name, [{ size: currentSize, qty: e.target.value }]);
                              }}
                              className="w-16 h-8 text-center font-extrabold border-2 border-blue-400 bg-white text-slate-900 rounded-lg text-xs"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleItemDetails(parsed.name)}
                              className="h-8 text-xs font-bold text-blue-800 border-blue-300 hover:bg-blue-100 px-2.5 rounded-lg"
                            >
                              <span>{showItemDetails ? 'Hide Sizes' : 'Sizes'}</span>
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Size/Qty Rows */}
                      {isSelected && showItemDetails && (
                        <div className="ml-6 sm:ml-8 space-y-2 p-3 bg-white rounded-xl border-2 border-blue-300/80 shadow-xs">
                          {sizeQty.map((sq, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                placeholder="Size (e.g., 6.0mm x 34,36)"
                                value={sq.size}
                                onChange={(e) => {
                                  const updated = [...sizeQty];
                                  updated[index] = { ...sq, size: e.target.value };
                                  onSizeQtyChange(parsed.name, updated);
                                }}
                                className="flex-1 h-8 text-xs sm:text-sm font-semibold border-2 border-blue-300 focus:border-blue-500 bg-white rounded-lg"
                              />
                              <Input
                                type="number"
                                placeholder="Qty"
                                min="1"
                                value={sq.qty}
                                onChange={(e) => {
                                  const updated = [...sizeQty];
                                  updated[index] = { ...sq, qty: e.target.value };
                                  onSizeQtyChange(parsed.name, updated);
                                }}
                                className="w-16 sm:w-20 h-8 text-xs sm:text-sm text-center font-extrabold border-2 border-blue-300 focus:border-blue-500 bg-white rounded-lg"
                              />
                              {sizeQty.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg"
                                  onClick={() => {
                                    const updated = sizeQty.filter((_, i) => i !== index);
                                    onSizeQtyChange(parsed.name, updated);
                                  }}
                                  title="Remove"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {index === sizeQty.length - 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    onSizeQtyChange(parsed.name, [
                                      ...sizeQty,
                                      { size: '', qty: '1' },
                                    ]);
                                  }}
                                  className="h-8 w-8 text-blue-600 hover:bg-blue-100 rounded-lg"
                                  title="Add Size Row"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-2.5 text-center text-xs font-semibold text-slate-500 bg-white rounded-lg border border-slate-200">
                No optional items configured. Add a custom item below.
              </div>
            )}

            {/* Add Custom Item */}
            <div className="pt-1">
              <div ref={itemInputRef} className="flex gap-2">
                <Input
                  placeholder="Type custom item name..."
                  value={newItem}
                  onChange={(e) => handleItemInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (showItemSuggestions && itemSuggestions.length > 0) {
                        const idx = itemSuggestionActiveIndex >= 0 ? itemSuggestionActiveIndex : 0;
                        handleAddItem(itemSuggestions[idx]);
                      } else {
                        handleAddItem();
                      }
                    }
                  }}
                  className="flex-1 h-9 border-2 border-blue-400 focus:border-blue-600 bg-white text-xs sm:text-sm font-semibold rounded-lg"
                />
                <Button
                  size="sm"
                  onClick={() => handleAddItem()}
                  disabled={!newItem.trim()}
                  className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm"
                  title="Add item to list"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>
            </div>
          </div>

          {/* 3. Instruments Section */}
          <div className="rounded-xl border-2 border-amber-300/80 bg-amber-50/40 p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-amber-500 text-slate-950 shadow-2xs">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-amber-950">Instruments ({procedure.instruments.length})</h4>
                  <p className="text-[11px] font-semibold text-amber-800">Surgical instrument sets & tools required</p>
                </div>
              </div>
            </div>
            {procedure.instruments.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {procedure.instruments.map((instrument, instIndex) => {
                  const hasImage = procedure.instrumentImageMapping?.[instrument] || null;
                  return (
                    <div key={`${procedure.name}-instrument-${instIndex}-${instrument}`} className="flex items-center gap-1.5 bg-white border-2 border-amber-300/90 px-3 py-1.5 rounded-xl shadow-2xs">
                      <span className="text-xs font-bold text-slate-900">{instrument}</span>
                      {hasImage && (
                        <button
                          onClick={() => handleShowInstrumentImage(instrument)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-full p-1 transition-colors border border-amber-300"
                          title={`View image of ${instrument}`}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveInstrument(instrument)}
                        className="hover:bg-rose-100 rounded-full p-1 text-rose-600 ml-0.5 transition-colors"
                        title="Remove instrument"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-2.5 text-center text-xs font-semibold text-slate-500 bg-white rounded-lg border border-slate-200">
                No instruments added for this procedure.
              </div>
            )}

            {/* Add Instrument */}
            <div className="pt-1">
              <div ref={instrumentInputRef} className="flex gap-2">
                <Input
                  placeholder="Type instrument name..."
                  value={newInstrument}
                  onChange={(e) => handleInstrumentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (suggestions.length > 0) {
                        const idx = instrumentSuggestionActiveIndex >= 0 ? instrumentSuggestionActiveIndex : 0;
                        const v = suggestions[idx]?.instrument;
                        if (v) {
                          e.preventDefault();
                          handleAddInstrument(v);
                          return;
                        }
                      }
                      handleAddInstrument(newInstrument);
                    }
                  }}
                  className="flex-1 h-9 border-2 border-amber-400 focus:border-amber-600 bg-white text-xs sm:text-sm font-semibold rounded-lg"
                />
                <Button
                  size="sm"
                  onClick={() => handleAddInstrument(newInstrument)}
                  disabled={!newInstrument.trim()}
                  className="h-9 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shadow-sm"
                  title="Add instrument to list"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Instrument
                </Button>
              </div>
            </div>
          </div>

          {/* 4. Box Details Section */}
          <div className="rounded-xl border-2 border-teal-300/80 bg-teal-50/40 p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-teal-200">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-teal-600 text-white shadow-2xs">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-teal-950">Box Details ({procedure.boxNumbers?.length || 0})</h4>
                  <p className="text-[11px] font-semibold text-teal-800">Assigned container box numbers</p>
                </div>
              </div>
            </div>
            {procedure.boxNumbers && procedure.boxNumbers.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {procedure.boxNumbers.map((boxNumber, index) => (
                  <Badge
                    key={index}
                    className="pl-3 pr-1.5 py-1 flex items-center gap-1.5 bg-white border-2 border-teal-400 text-slate-900 font-bold shadow-2xs"
                  >
                    <span className="text-xs">{boxNumber}</span>
                    <button
                      onClick={() => onRemoveBox(index)}
                      className="hover:bg-rose-100 rounded-full p-0.5 text-rose-600 transition-colors"
                      title="Remove box number"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="py-2.5 text-center text-xs font-semibold text-slate-500 bg-white rounded-lg border border-slate-200">
                No box numbers added. Add box numbers below.
              </div>
            )}

            {/* Add Box Number */}
            <div className="pt-1">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter box number..."
                  value={newBoxNumber}
                  onChange={(e) => setNewBoxNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (newBoxNumber.trim()) {
                        onAddBox(newBoxNumber.trim());
                        setNewBoxNumber('');
                      }
                    }
                  }}
                  className="flex-1 h-9 border-2 border-teal-400 focus:border-teal-600 bg-white text-xs sm:text-sm font-semibold rounded-lg"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (newBoxNumber.trim()) {
                      onAddBox(newBoxNumber.trim());
                      setNewBoxNumber('');
                    }
                  }}
                  disabled={!newBoxNumber.trim()}
                  className="h-9 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Box
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal (for instruments, fixed items, and selectable items) */}
      {selectedImage && (
        <InstrumentImageModal
          isOpen={showImageModal}
          onClose={() => {
            setShowImageModal(false);
            setSelectedImage(null);
            setAllImages([]);
            setCurrentImageIndex(0);
          }}
          instrumentName={selectedImage.name}
          imageUrl={selectedImage.url}
          fallbackUrls={selectedImage.fallbackUrls || null}
          allInstruments={allImages}
          currentIndex={currentImageIndex}
          onNavigate={handleNavigateImage}
        />
      )}

      {/* Instrument Suggestions Portal */}
      {suggestions.length > 0 && instrumentDropdownPos && typeof document !== 'undefined' && document.body && createPortal(
        <div
          data-instrument-dropdown
          style={{
            position: 'absolute',
            top: `${instrumentDropdownPos.top}px`,
            left: `${instrumentDropdownPos.left}px`,
            width: `${instrumentDropdownPos.width}px`,
            zIndex: 9999,
          }}
          className="mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.instrument}-${index}`}
              aria-selected={index === instrumentSuggestionActiveIndex}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                index === instrumentSuggestionActiveIndex ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
              }`}
              onClick={() => handleAddInstrument(suggestion.instrument)}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setInstrumentSuggestionActiveIndex(index)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-1.5 w-1.5 rounded-full ${index === instrumentSuggestionActiveIndex ? 'bg-white' : 'bg-blue-300'}`} />
                  <span className="font-medium truncate">{suggestion.instrument}</span>
                </div>
                <span className={`text-xs shrink-0 ${index === instrumentSuggestionActiveIndex ? 'text-white/90' : 'text-primary/70'}`}>
                  ({suggestion.procedureName})
                </span>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Item Suggestions Portal */}
      {showItemSuggestions && itemSuggestions.length > 0 && itemDropdownPos && typeof document !== 'undefined' && document.body && createPortal(
        <div
          data-item-dropdown
          style={{
            position: 'absolute',
            top: `${itemDropdownPos.top}px`,
            left: `${itemDropdownPos.left}px`,
            width: `${itemDropdownPos.width}px`,
            zIndex: 9999,
          }}
          className="mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
        >
          {itemSuggestions.map((suggestion, idx) => (
            <button
              key={suggestion}
              aria-selected={idx === itemSuggestionActiveIndex}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                idx === itemSuggestionActiveIndex ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
              }`}
              onClick={() => handleAddItem(suggestion)}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setItemSuggestionActiveIndex(idx)}
            >
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${idx === itemSuggestionActiveIndex ? 'bg-white' : 'bg-blue-300'}`} />
                <span className="truncate">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
