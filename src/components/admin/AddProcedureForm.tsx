import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Plus, X, Save, Upload, Copy, Edit, Trash2,
  Search, ArrowLeft, Layers, Boxes,
  Wrench, Package, Eye, Sparkles, MapPin,
  ExternalLink, ChevronUp, ChevronDown,
  Grid, List, CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProcedures } from '@/hooks/useProcedures';
import { Procedure } from '@/types/procedure';
import { procedureService } from '@/services/procedureService';

export interface ItemWithSizes {
  name: string;
  sizes: Array<{ size: string; qty: string }>;
  imageUrl: string;
  isFixed: boolean;
  fixedQty?: string;
  location?: { room: string; rack: string; box: string };
}

export interface Instrument {
  name: string;
  imageUrl: string;
  location?: { room: string; rack: string; box: string };
}

const SPECIALTY_OPTIONS = ['General', 'Orthopedic', 'Trauma', 'Spine', 'Surgery'];

// Quick orthopedic presets for bulk size generation
const PRESET_SIZE_OPTIONS = [
  {
    label: 'Standard Screws (10mm - 40mm)',
    sizes: '10mm, 12mm, 14mm, 16mm, 18mm, 20mm, 22mm, 24mm, 26mm, 28mm, 30mm, 32mm, 34mm, 36mm, 38mm, 40mm',
  },
  {
    label: 'Long Screws (42mm - 70mm)',
    sizes: '42mm, 44mm, 46mm, 48mm, 50mm, 55mm, 60mm, 65mm, 70mm',
  },
  {
    label: 'Diameters (2.7, 3.5, 4.0, 4.5, 5.0)',
    sizes: '2.7mm, 3.5mm, 4.0mm, 4.5mm, 5.0mm, 6.5mm',
  },
  {
    label: 'Plate Holes (4H - 14H)',
    sizes: '4 Hole, 5 Hole, 6 Hole, 7 Hole, 8 Hole, 9 Hole, 10 Hole, 12 Hole, 14 Hole',
  },
  {
    label: 'K-Wires (1.0mm - 3.0mm)',
    sizes: '1.0mm, 1.2mm, 1.5mm, 1.8mm, 2.0mm, 2.5mm, 3.0mm',
  },
  {
    label: 'Prosthetic Sizes (Small, Medium, Large)',
    sizes: 'Size 1, Size 2, Size 3, Size 4, Size 5, Size 6',
  },
];

const COMMON_INSTRUMENTS = [
  'General Orthopedic Tray',
  'Large Frag Instrument Set',
  'Small Frag Instrument Set',
  'Locking Plate Set',
  'Drill Bits & Tap Set',
  'Reduction Clamps Set',
  'Depth Gauge & Screwdrivers',
  'Bone Holding Forceps',
  'Femoral Reamer Set',
  'Tibial Extraction Set',
];

export function AddProcedureForm() {
  const { toast } = useToast();
  const { procedures, loading: proceduresLoading, fetchProcedures } = useProcedures();

  // Navigation mode: 'catalog' | 'editor'
  const [viewMode, setViewMode] = useState<'catalog' | 'editor'>('catalog');

  // Catalog search and filter state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState('All');
  const [catalogLayout, setCatalogLayout] = useState<'grid' | 'table'>('grid');

  // Editor state
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalProcedureName, setOriginalProcedureName] = useState('');
  const [originalDocId, setOriginalDocId] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [procedureType, setProcedureType] = useState('Orthopedic');
  const [items, setItems] = useState<ItemWithSizes[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemFilterTab, setItemFilterTab] = useState<'all' | 'selectable' | 'fixed'>('all');

  // Modals & Dialogs
  const [previewProcedure, setPreviewProcedure] = useState<Procedure | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [procedureToDelete, setProcedureToDelete] = useState<{ id: string; name: string } | null>(null);
  const [bulkSizeModalOpen, setBulkSizeModalOpen] = useState(false);
  const [activeItemIndexForBulkSizes, setActiveItemIndexForBulkSizes] = useState<number | null>(null);
  const [bulkSizeInput, setBulkSizeInput] = useState('');
  const [bulkDefaultQty, setBulkDefaultQty] = useState('1');

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleImageUpload = async (file: File, type: 'item' | 'instrument', index: number) => {
    if (!procedureName.trim()) {
      toast({
        title: "Procedure Name Required",
        description: "Please enter a procedure name before uploading an image.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const base64 = await fileToBase64(file);
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { driveService } = await import('@/services/driveService');
      const result = await driveService.uploadImage(base64, procedureName, fileName);

      if (result.success && (result.viewLink || result.url)) {
        const finalUrl = result.viewLink || result.url || '';
        toast({ title: "Upload Success", description: "Image linked successfully." });

        if (type === 'item') {
          updateItem(index, 'imageUrl', finalUrl);
        } else {
          updateInstrument(index, 'imageUrl', finalUrl);
        }
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload Failed", description: error.message || "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const parseItemString = (itemString: string): { name: string; sizes: Array<{ size: string; qty: string }> } => {
    const match = itemString.match(/^(.+?)\s*\{([^}]+)\}$/);
    if (match) {
      const name = match[1].trim();
      const sizeQtyStr = match[2];
      const sizes = sizeQtyStr.split(',').map(sq => {
        const [size, qty] = sq.split(':').map(s => s.trim());
        return { size: size || '', qty: qty || '1' };
      });
      return { name, sizes };
    }
    return { name: itemString.trim(), sizes: [] };
  };

  const startCreateNew = () => {
    setOriginalProcedureName('');
    setOriginalDocId('');
    setProcedureName('');
    setProcedureType('Orthopedic');
    setItems([]);
    setInstruments([]);
    setIsEditMode(false);
    setViewMode('editor');
  };

  const loadProcedureForEdit = (procedure: Procedure) => {
    setOriginalProcedureName(procedure.name);
    const storedDocId = procedure.docId || procedure.name.replace(/[^a-zA-Z0-9]/g, '_');
    setOriginalDocId(storedDocId);
    setProcedureName(procedure.name);
    setProcedureType(procedure.type || 'General');

    const fixedItemsData: ItemWithSizes[] = (procedure.fixedItems || []).map((fixedItem) => {
      const location = procedure.fixedItemLocationMapping?.[fixedItem.name]?.[0] || procedure.fixedItemLocationMapping?.[fixedItem.name];
      return {
        name: fixedItem.name,
        sizes: [],
        imageUrl: procedure.fixedItemImageMapping?.[fixedItem.name] || '',
        isFixed: true,
        fixedQty: fixedItem.qty || '1',
        location: location || { room: '', rack: '', box: '' },
      };
    });

    const selectableItemsData: ItemWithSizes[] = (procedure.items || []).map((itemString) => {
      const parsed = parseItemString(itemString);
      const location = procedure.itemLocationMapping?.[parsed.name]?.[0] || procedure.itemLocationMapping?.[parsed.name];
      return {
        name: parsed.name,
        sizes: parsed.sizes.length > 0 ? parsed.sizes : [{ size: '', qty: '1' }],
        imageUrl: procedure.itemImageMapping?.[parsed.name] || '',
        isFixed: false,
        location: location || { room: '', rack: '', box: '' },
      };
    });

    setItems([...fixedItemsData, ...selectableItemsData]);

    const instrumentsData: Instrument[] = (procedure.instruments || []).map((instName) => {
      const location = procedure.instrumentLocationMapping?.[instName]?.[0] || procedure.instrumentLocationMapping?.[instName];
      return {
        name: instName,
        imageUrl: procedure.instrumentImageMapping?.[instName] || '',
        location: location || { room: '', rack: '', box: '' },
      };
    });

    setInstruments(instrumentsData);
    setIsEditMode(true);
    setViewMode('editor');
  };

  const duplicateProcedure = (proc: Procedure) => {
    setOriginalProcedureName('');
    setOriginalDocId('');
    setProcedureName(`${proc.name} (Copy)`);
    setProcedureType(proc.type || 'Orthopedic');

    const fixedItemsData: ItemWithSizes[] = (proc.fixedItems || []).map((fixedItem) => {
      const location = proc.fixedItemLocationMapping?.[fixedItem.name]?.[0] || proc.fixedItemLocationMapping?.[fixedItem.name];
      return {
        name: fixedItem.name,
        sizes: [],
        imageUrl: proc.fixedItemImageMapping?.[fixedItem.name] || '',
        isFixed: true,
        fixedQty: fixedItem.qty || '1',
        location: location ? { ...location } : { room: '', rack: '', box: '' },
      };
    });

    const selectableItemsData: ItemWithSizes[] = (proc.items || []).map((itemString) => {
      const parsed = parseItemString(itemString);
      const location = proc.itemLocationMapping?.[parsed.name]?.[0] || proc.itemLocationMapping?.[parsed.name];
      return {
        name: parsed.name,
        sizes: parsed.sizes.length > 0 ? parsed.sizes.map(s => ({ ...s })) : [{ size: '', qty: '1' }],
        imageUrl: proc.itemImageMapping?.[parsed.name] || '',
        isFixed: false,
        location: location ? { ...location } : { room: '', rack: '', box: '' },
      };
    });

    setItems([...fixedItemsData, ...selectableItemsData]);

    const instrumentsData: Instrument[] = (proc.instruments || []).map((instName) => {
      const location = proc.instrumentLocationMapping?.[instName]?.[0] || proc.instrumentLocationMapping?.[instName];
      return {
        name: instName,
        imageUrl: proc.instrumentImageMapping?.[instName] || '',
        location: location ? { ...location } : { room: '', rack: '', box: '' },
      };
    });

    setInstruments(instrumentsData);
    setIsEditMode(false);
    setViewMode('editor');

    toast({
      title: "Procedure Cloned",
      description: `Created a copy of "${proc.name}". You can now customize and save it.`,
    });
  };

  // -------------------------------------------------------------
  // Item Operations
  // -------------------------------------------------------------
  const addItem = (isFixed: boolean = false) => {
    setItems(prev => [
      ...prev,
      {
        name: '',
        sizes: isFixed ? [] : [{ size: '', qty: '1' }],
        imageUrl: '',
        isFixed,
        fixedQty: isFixed ? '1' : undefined,
        location: { room: '', rack: '', box: '' }
      }
    ]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const duplicateItem = (index: number) => {
    const item = items[index];
    const clone: ItemWithSizes = {
      ...item,
      name: `${item.name} (Copy)`,
      sizes: item.sizes.map(s => ({ ...s })),
      location: item.location ? { ...item.location } : { room: '', rack: '', box: '' }
    };
    const updated = [...items];
    updated.splice(index + 1, 0, clone);
    setItems(updated);
    toast({ title: "Item Duplicated", description: `Duplicated "${item.name || 'Item'}"` });
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const updated = [...items];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setItems(updated);
  };

  const updateItem = (index: number, field: keyof ItemWithSizes, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addItemSize = (itemIndex: number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[itemIndex].sizes.push({ size: '', qty: '1' });
      return updated;
    });
  };

  const removeItemSize = (itemIndex: number, sizeIndex: number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[itemIndex].sizes = updated[itemIndex].sizes.filter((_, i) => i !== sizeIndex);
      return updated;
    });
  };

  const updateItemSize = (itemIndex: number, sizeIndex: number, field: 'size' | 'qty', value: string) => {
    setItems(prev => {
      const updated = [...prev];
      updated[itemIndex].sizes[sizeIndex][field] = value;
      return updated;
    });
  };

  const openBulkSizeModal = (itemIndex: number) => {
    setActiveItemIndexForBulkSizes(itemIndex);
    setBulkSizeInput('');
    setBulkDefaultQty('1');
    setBulkSizeModalOpen(true);
  };

  const applyBulkSizes = () => {
    if (activeItemIndexForBulkSizes === null) return;
    const rawTokens = bulkSizeInput
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (rawTokens.length === 0) {
      toast({ title: "No sizes entered", description: "Please enter sizes or pick a preset.", variant: "destructive" });
      return;
    }

    const newSizes = rawTokens.map(token => {
      // Check if user entered "size:qty" format
      if (token.includes(':')) {
        const [s, q] = token.split(':').map(x => x.trim());
        return { size: s, qty: q || bulkDefaultQty || '1' };
      }
      return { size: token, qty: bulkDefaultQty || '1' };
    });

    setItems(prev => {
      const updated = [...prev];
      const currentItem = updated[activeItemIndexForBulkSizes];
      // Filter out empty initial size if only one empty size existed
      const existing = currentItem.sizes.filter(s => s.size.trim() !== '');
      currentItem.sizes = [...existing, ...newSizes];
      return updated;
    });

    setBulkSizeModalOpen(false);
    toast({
      title: "Sizes Added",
      description: `Added ${newSizes.length} sizes to ${items[activeItemIndexForBulkSizes]?.name || 'Item'}.`
    });
  };

  // -------------------------------------------------------------
  // Instrument Operations
  // -------------------------------------------------------------
  const addInstrument = (name: string = '') => {
    setInstruments(prev => [
      ...prev,
      { name, imageUrl: '', location: { room: '', rack: '', box: '' } }
    ]);
  };

  const removeInstrument = (index: number) => {
    setInstruments(prev => prev.filter((_, i) => i !== index));
  };

  const duplicateInstrument = (index: number) => {
    const inst = instruments[index];
    const clone: Instrument = {
      ...inst,
      name: `${inst.name} (Copy)`,
      location: inst.location ? { ...inst.location } : { room: '', rack: '', box: '' }
    };
    const updated = [...instruments];
    updated.splice(index + 1, 0, clone);
    setInstruments(updated);
    toast({ title: "Instrument Duplicated", description: `Duplicated "${inst.name || 'Instrument'}"` });
  };

  const moveInstrument = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= instruments.length) return;
    const updated = [...instruments];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setInstruments(updated);
  };

  const updateInstrument = (index: number, field: keyof Instrument, value: any) => {
    setInstruments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // -------------------------------------------------------------
  // Save & Delete
  // -------------------------------------------------------------
  const formatItemForFirestore = (item: ItemWithSizes): string => {
    if (item.isFixed) return item.name;
    if (item.sizes.length > 0) {
      const validSizes = item.sizes.filter(s => s.size.trim() !== '');
      if (validSizes.length === 0) return item.name;
      const sizeQtyPairs = validSizes
        .map(sq => `${sq.size}:${sq.qty || '1'}`)
        .join(', ');
      return sizeQtyPairs ? `${item.name} {${sizeQtyPairs}}` : item.name;
    }
    return item.name;
  };

  const handleSave = async () => {
    if (!procedureName.trim()) {
      toast({ title: 'Error', description: 'Procedure name is required', variant: 'destructive' });
      return;
    }

    // Validate item names
    const emptyItem = items.find(it => !it.name.trim());
    if (emptyItem) {
      toast({
        title: 'Validation Error',
        description: 'All items must have a valid item name.',
        variant: 'destructive'
      });
      return;
    }

    // Validate instrument names
    const emptyInst = instruments.find(inst => !inst.name.trim());
    if (emptyInst) {
      toast({
        title: 'Validation Error',
        description: 'All instruments must have a valid name.',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      const fixedItemsList = items.filter(item => item.isFixed);
      const selectableItemsList = items.filter(item => !item.isFixed);

      const fixedItems = fixedItemsList.map(item => ({
        name: item.name.trim(),
        qty: item.fixedQty || '1'
      }));

      const procedureItems = selectableItemsList.map(formatItemForFirestore);
      const instrumentNames = instruments.map(i => i.name.trim());

      const instrumentImageMapping: Record<string, string> = {};
      const instrumentLocationMapping: Record<string, any> = {};
      instruments.forEach(inst => {
        if (inst.imageUrl) instrumentImageMapping[inst.name.trim()] = inst.imageUrl;
        if (inst.location && (inst.location.room || inst.location.rack || inst.location.box)) {
          instrumentLocationMapping[inst.name.trim()] = [inst.location];
        }
      });

      const fixedItemImageMapping: Record<string, string> = {};
      const fixedItemLocationMapping: Record<string, any> = {};
      fixedItemsList.forEach(item => {
        if (item.imageUrl) fixedItemImageMapping[item.name.trim()] = item.imageUrl;
        if (item.location && (item.location.room || item.location.rack || item.location.box)) {
          fixedItemLocationMapping[item.name.trim()] = [item.location];
        }
      });

      const itemImageMapping: Record<string, string> = {};
      const itemLocationMapping: Record<string, any> = {};
      selectableItemsList.forEach(item => {
        if (item.imageUrl) itemImageMapping[item.name.trim()] = item.imageUrl;
        if (item.location && (item.location.room || item.location.rack || item.location.box)) {
          itemLocationMapping[item.name.trim()] = [item.location];
        }
      });

      const procedureData: Procedure = {
        name: procedureName.trim(),
        type: procedureType,
        items: procedureItems,
        fixedItems: fixedItems,
        instruments: instrumentNames,
        instrumentImageMapping,
        fixedItemImageMapping,
        itemImageMapping,
        instrumentLocationMapping,
        fixedItemLocationMapping,
        itemLocationMapping
      };

      if (isEditMode) {
        const docIdToUpdate = originalDocId || originalProcedureName.replace(/[^a-zA-Z0-9]/g, '_');
        await procedureService.update(docIdToUpdate, procedureData);
        toast({
          title: 'Procedure Updated',
          description: `"${procedureName}" has been successfully saved.`,
        });
        localStorage.removeItem('srrortho:procedures_cache');
        fetchProcedures(true);
        setViewMode('catalog');
      } else {
        await procedureService.save(procedureData);
        toast({
          title: 'Procedure Created',
          description: `"${procedureName}" has been created successfully.`,
        });
        localStorage.removeItem('srrortho:procedures_cache');
        fetchProcedures(true);
        setViewMode('catalog');
      }
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: 'Save Failed',
        description: error.message || 'An error occurred while saving.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteProcedure = async () => {
    if (!procedureToDelete) return;
    setIsDeleting(true);
    try {
      await procedureService.deleteByDocId(procedureToDelete.id);
      toast({
        title: 'Procedure Deleted',
        description: `"${procedureToDelete.name}" has been removed.`,
      });
      localStorage.removeItem('srrortho:procedures_cache');
      fetchProcedures(true);
      if (viewMode === 'editor') {
        setViewMode('catalog');
      }
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete procedure.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setProcedureToDelete(null);
    }
  };

  // -------------------------------------------------------------
  // Filtered Procedures for Catalog
  // -------------------------------------------------------------
  const filteredProcedures = useMemo(() => {
    return procedures.filter(proc => {
      const matchesSpecialty = selectedSpecialtyFilter === 'All' || proc.type === selectedSpecialtyFilter;
      if (!matchesSpecialty) return false;

      if (!catalogSearch.trim()) return true;
      const query = catalogSearch.toLowerCase();
      const matchName = proc.name.toLowerCase().includes(query);
      const matchSpecialty = proc.type?.toLowerCase().includes(query);
      const matchItem = (proc.items || []).some(item => item.toLowerCase().includes(query));
      const matchFixed = (proc.fixedItems || []).some(fi => fi.name.toLowerCase().includes(query));
      const matchInst = (proc.instruments || []).some(inst => inst.toLowerCase().includes(query));

      return matchName || matchSpecialty || matchItem || matchFixed || matchInst;
    });
  }, [procedures, selectedSpecialtyFilter, catalogSearch]);

  // Filtered items in editor
  const filteredEditorItems = useMemo(() => {
    return items.filter((item, index) => {
      if (itemFilterTab === 'selectable' && item.isFixed) return false;
      if (itemFilterTab === 'fixed' && !item.isFixed) return false;
      if (!itemSearchQuery.trim()) return true;
      const q = itemSearchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSize = item.sizes.some(s => s.size.toLowerCase().includes(q));
      const matchLoc = item.location && (
        item.location.room?.toLowerCase().includes(q) ||
        item.location.rack?.toLowerCase().includes(q) ||
        item.location.box?.toLowerCase().includes(q)
      );
      return matchName || matchSize || matchLoc;
    });
  }, [items, itemFilterTab, itemSearchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = procedures.length;
    const specialtyCounts: Record<string, number> = {};
    let totalItems = 0;
    procedures.forEach(p => {
      specialtyCounts[p.type || 'General'] = (specialtyCounts[p.type || 'General'] || 0) + 1;
      totalItems += (p.items?.length || 0) + (p.fixedItems?.length || 0);
    });
    return {
      total,
      specialtyCounts,
      avgItems: total > 0 ? (totalItems / total).toFixed(1) : '0',
    };
  }, [procedures]);

  // =========================================================================
  // VIEW 1: CATALOG / HUB VIEW
  // =========================================================================
  if (viewMode === 'catalog') {
    return (
      <div className="space-y-6 w-full pb-16">
        {/* Top Header Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-indigo-500/20">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-8 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Procedure Master Management
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display text-white">
                Surgical Procedures Catalog
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Configure procedures, default surgical sets, implants, sizes, quantities, and inventory location maps for streamlined Delivery Challans.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => fetchProcedures(true)}
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${proceduresLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={startCreateNew}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30 font-semibold px-5 py-2 h-10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Procedure
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <span className="text-xs font-medium text-slate-400 block">Total Procedures</span>
              <span className="text-2xl font-bold text-white">{stats.total}</span>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <span className="text-xs font-medium text-slate-400 block">Orthopedic / Trauma</span>
              <span className="text-2xl font-bold text-indigo-300">
                {(stats.specialtyCounts['Orthopedic'] || 0) + (stats.specialtyCounts['Trauma'] || 0)}
              </span>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <span className="text-xs font-medium text-slate-400 block">Spine & Surgery</span>
              <span className="text-2xl font-bold text-teal-300">
                {(stats.specialtyCounts['Spine'] || 0) + (stats.specialtyCounts['Surgery'] || 0)}
              </span>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <span className="text-xs font-medium text-slate-400 block">Avg Implants / Proc</span>
              <span className="text-2xl font-bold text-amber-300">{stats.avgItems}</span>
            </div>
          </div>
        </div>

        {/* Search, Filter & View Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search procedures, implants, or instruments..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="pl-10 h-11 bg-white border-slate-200 rounded-xl shadow-xs focus-visible:ring-indigo-500"
            />
            {catalogSearch && (
              <button
                onClick={() => setCatalogSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['All', ...SPECIALTY_OPTIONS].map(type => {
              const count = type === 'All'
                ? procedures.length
                : procedures.filter(p => p.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedSpecialtyFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedSpecialtyFilter === type
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{type}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    selectedSpecialtyFilter === type ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setCatalogLayout('grid')}
                className={`p-1.5 rounded-md text-xs ${catalogLayout === 'grid' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                title="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCatalogLayout('table')}
                className={`p-1.5 rounded-md text-xs ${catalogLayout === 'table' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Procedures Grid / Table */}
        {filteredProcedures.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-bold text-slate-800">No procedures found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {catalogSearch || selectedSpecialtyFilter !== 'All'
                ? "Try clearing your search query or choosing a different specialty filter."
                : "Get started by adding your first surgical procedure template."}
            </p>
            <Button onClick={startCreateNew} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Procedure
            </Button>
          </div>
        ) : catalogLayout === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProcedures.map((proc, index) => {
              const selectableCount = proc.items?.length || 0;
              const fixedCount = proc.fixedItems?.length || 0;
              const instCount = proc.instruments?.length || 0;
              const totalImplants = selectableCount + fixedCount;

              return (
                <Card
                  key={proc.docId || proc.name || index}
                  className="group relative overflow-hidden border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all duration-200 bg-white rounded-2xl flex flex-col justify-between"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <Badge
                        variant="secondary"
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                          proc.type === 'Trauma' ? 'bg-amber-100 text-amber-800' :
                          proc.type === 'Spine' ? 'bg-purple-100 text-purple-800' :
                          proc.type === 'Orthopedic' ? 'bg-indigo-100 text-indigo-800' :
                          proc.type === 'Surgery' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {proc.type || 'General'}
                      </Badge>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Preview Procedure"
                          onClick={() => setPreviewProcedure(proc)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Duplicate Procedure"
                          onClick={() => duplicateProcedure(proc)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <CardTitle className="text-base font-bold text-slate-900 mt-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                      {proc.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {proc.items && proc.items.length > 0
                        ? proc.items.map(i => i.split('{')[0].trim()).join(', ')
                        : 'No implants configured'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 mt-auto">
                    <div className="grid grid-cols-2 gap-2 py-3 border-t border-b border-slate-100 my-3 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-600">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Implants</span>
                          <span className="font-bold text-slate-700">{totalImplants} items</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center text-purple-600">
                          <Wrench className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Instruments</span>
                          <span className="font-bold text-slate-700">{instCount} sets</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        onClick={() => loadProcedureForEdit(proc)}
                        className="flex-1 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-semibold h-9 rounded-xl transition-colors shadow-xs"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1.5" />
                        Edit Template
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          setProcedureToDelete({
                            id: proc.docId || proc.name.replace(/[^a-zA-Z0-9]/g, '_'),
                            name: proc.name,
                          });
                          setDeleteDialogOpen(true);
                        }}
                        className="h-9 w-9 border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-xl"
                        title="Delete Procedure"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Procedure Name</th>
                    <th className="py-3.5 px-4">Specialty</th>
                    <th className="py-3.5 px-4 text-center">Implants</th>
                    <th className="py-3.5 px-4 text-center">Fixed Items</th>
                    <th className="py-3.5 px-4 text-center">Instruments</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProcedures.map((proc, index) => (
                    <tr key={proc.docId || proc.name || index} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {proc.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {proc.type || 'General'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                        {proc.items?.length || 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                        {proc.fixedItems?.length || 0}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                        {proc.instruments?.length || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPreviewProcedure(proc)}
                            className="h-8 text-xs text-slate-600 hover:text-indigo-600"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => duplicateProcedure(proc)}
                            className="h-8 text-xs text-slate-600 hover:text-indigo-600 border-slate-200"
                          >
                            <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => loadProcedureForEdit(proc)}
                            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setProcedureToDelete({
                                id: proc.docId || proc.name.replace(/[^a-zA-Z0-9]/g, '_'),
                                name: proc.name,
                              });
                              setDeleteDialogOpen(true);
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <AlertDialogTitle>Delete Procedure?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <span className="font-bold text-slate-900">"{procedureToDelete?.name}"</span>? This action cannot be undone and will remove all default items and instrument mappings for this procedure.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteProcedure}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Procedure'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Live Preview Modal */}
        {previewProcedure && (
          <Dialog open={!!previewProcedure} onOpenChange={(open) => !open && setPreviewProcedure(null)}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{previewProcedure.type || 'General'}</Badge>
                  <span className="text-xs text-slate-400">Delivery Challan Simulation</span>
                </div>
                <DialogTitle className="text-xl font-bold text-slate-900">{previewProcedure.name}</DialogTitle>
                <DialogDescription>
                  This is how the procedure contents appear when selecting items during DC generation.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 pt-4">
                {/* Selectable Implants Preview */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    Selectable Implants ({previewProcedure.items?.length || 0})
                  </h4>
                  {previewProcedure.items && previewProcedure.items.length > 0 ? (
                    <div className="space-y-2">
                      {previewProcedure.items.map((itemStr, i) => {
                        const parsed = parseItemString(itemStr);
                        return (
                          <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                            <div className="font-bold text-sm text-slate-800">{parsed.name}</div>
                            {parsed.sizes.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {parsed.sizes.map((sz, szIdx) => (
                                  <Badge key={szIdx} variant="outline" className="bg-white text-xs font-medium border-slate-300">
                                    {sz.size} <span className="ml-1 text-slate-400">(Qty: {sz.qty})</span>
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 mt-1 italic">No specific sizes configured</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No selectable items</p>
                  )}
                </div>

                {/* Fixed Items Preview */}
                {previewProcedure.fixedItems && previewProcedure.fixedItems.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Always Included / Fixed Items ({previewProcedure.fixedItems.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {previewProcedure.fixedItems.map((fi, i) => (
                        <div key={i} className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/30 flex items-center justify-between text-xs">
                          <span className="font-semibold text-emerald-900">{fi.name}</span>
                          <Badge className="bg-emerald-600 text-white text-[10px]">Qty: {fi.qty}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instruments Preview */}
                {previewProcedure.instruments && previewProcedure.instruments.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-purple-600" />
                      Instruments & Trays ({previewProcedure.instruments.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {previewProcedure.instruments.map((inst, i) => (
                        <div key={i} className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/30 flex items-center justify-between text-xs">
                          <span className="font-semibold text-purple-900">{inst}</span>
                          <span className="text-[10px] text-purple-600">✓ Ready in Set</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setPreviewProcedure(null)}>Close</Button>
                <Button
                  onClick={() => {
                    const target = previewProcedure;
                    setPreviewProcedure(null);
                    loadProcedureForEdit(target);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Edit className="w-4 h-4 mr-2" /> Edit This Procedure
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: PROCEDURE EDITOR WORKSPACE
  // =========================================================================
  const fixedCount = items.filter(i => i.isFixed).length;
  const selectableCount = items.filter(i => !i.isFixed).length;

  return (
    <div className="space-y-6 w-full pb-24">
      {/* Top Breadcrumb / Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('catalog')}
            className="text-slate-600 hover:text-slate-900 -ml-1 gap-1.5 h-9"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-semibold">Catalog</span>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={isEditMode ? "default" : "secondary"} className="text-[10px] uppercase font-bold tracking-wider">
                {isEditMode ? "Edit Mode" : "New Procedure"}
              </Badge>
              <span className="text-xs text-slate-400">
                {items.length} items • {instruments.length} instruments
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 truncate">
              {procedureName.trim() || 'Untitled Procedure'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const currentProc: Procedure = {
                  name: procedureName,
                  type: procedureType,
                  items: items.filter(i => !i.isFixed).map(formatItemForFirestore),
                  fixedItems: items.filter(i => i.isFixed).map(i => ({ name: i.name, qty: i.fixedQty || '1' })),
                  instruments: instruments.map(i => i.name),
                };
                setPreviewProcedure(currentProc);
              }}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 h-9"
            >
              <Eye className="w-4 h-4 mr-1.5" /> Preview DC
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/20 h-9 px-4 gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : isEditMode ? 'Update Procedure' : 'Save Procedure'}
          </Button>
        </div>
      </div>

      {/* Procedure Basic Settings Card */}
      <Card className="border border-slate-200 bg-white rounded-2xl shadow-xs overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="md:col-span-2 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                Procedure Title <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Total Hip Replacement, PFN A2, Distal Radius ORIF..."
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                className="h-11 text-base font-semibold border-slate-200 focus-visible:ring-indigo-500 rounded-xl"
              />
              <p className="text-[11px] text-slate-400">
                A clear, recognizable name used by surgeons and delivery personnel on Delivery Challans.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Specialty Category
              </Label>
              <Select value={procedureType} onValueChange={setProcedureType}>
                <SelectTrigger className="h-11 border-slate-200 bg-white rounded-xl font-medium focus:ring-indigo-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {SPECIALTY_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt} className="font-medium">
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                Used for filtering and grouping in the DC creator.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs: Implants vs Instruments */}
      <Tabs defaultValue="items" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-11">
            <TabsTrigger value="items" className="rounded-lg text-xs sm:text-sm font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-xs">
              <Package className="w-4 h-4" />
              <span>Implants & Consumables</span>
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-slate-200 text-slate-700">
                {items.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="instruments" className="rounded-lg text-xs sm:text-sm font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-xs">
              <Wrench className="w-4 h-4" />
              <span>Instruments & Trays</span>
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-slate-200 text-slate-700">
                {instruments.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: IMPLANTS & CONSUMABLES */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="items" className="space-y-4 m-0 focus-visible:ring-0">
          {/* Action & Filter Toolbar for Items */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Filter items by name/size..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs bg-white border-slate-200 rounded-lg"
                />
              </div>

              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                <button
                  onClick={() => setItemFilterTab('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${itemFilterTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All ({items.length})
                </button>
                <button
                  onClick={() => setItemFilterTab('selectable')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${itemFilterTab === 'selectable' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Selectable ({selectableCount})
                </button>
                <button
                  onClick={() => setItemFilterTab('fixed')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${itemFilterTab === 'fixed' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Fixed ({fixedCount})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => addItem(false)}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-9 rounded-lg gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Selectable Item
              </Button>
              <Button
                onClick={() => addItem(true)}
                size="sm"
                variant="outline"
                className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold h-9 rounded-lg gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Fixed Item
              </Button>
            </div>
          </div>

          {/* Items List */}
          {items.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white">
              <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <h3 className="text-base font-bold text-slate-800">No implants configured yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Add implants that should be part of this procedure. You can configure selectable sizes or fixed items always dispatched.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <Button onClick={() => addItem(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Selectable Item
                </Button>
                <Button onClick={() => addItem(true)} variant="outline" className="text-indigo-600 border-indigo-200 text-xs font-semibold">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Fixed Item
                </Button>
              </div>
            </div>
          ) : filteredEditorItems.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-500">
              No items match the filter query "{itemSearchQuery}".
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEditorItems.map((item, displayedIdx) => {
                // Find true index in master items array
                const actualIndex = items.indexOf(item);

                return (
                  <Card
                    key={actualIndex}
                    className={`border transition-all duration-200 rounded-2xl overflow-hidden shadow-xs ${
                      item.isFixed ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Item Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Reorder Buttons & Index */}
                          <div className="flex items-center gap-1">
                            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600">
                              {actualIndex + 1}
                            </div>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={actualIndex === 0}
                                onClick={() => moveItem(actualIndex, 'up')}
                                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-0.5"
                                title="Move up"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={actualIndex === items.length - 1}
                                onClick={() => moveItem(actualIndex, 'down')}
                                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-0.5"
                                title="Move down"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Item Name Input */}
                          <div className="flex-1 min-w-0">
                            <Input
                              placeholder="e.g. Locking Compression Plate, Cortical Screw, Bone Cement..."
                              value={item.name}
                              onChange={(e) => updateItem(actualIndex, 'name', e.target.value)}
                              className="font-bold text-sm h-10 border-slate-200 focus-visible:ring-indigo-500 rounded-xl bg-white"
                            />
                          </div>
                        </div>

                        {/* Item Type Toggle & Quick Actions */}
                        <div className="flex items-center gap-2 justify-between sm:justify-end">
                          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                updateItem(actualIndex, 'isFixed', false);
                                if (!item.sizes || item.sizes.length === 0) {
                                  updateItem(actualIndex, 'sizes', [{ size: '', qty: '1' }]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                !item.isFixed ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              📋 Selectable
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(actualIndex, 'isFixed', true)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                item.isFixed ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              📌 Fixed Qty
                            </button>
                          </div>

                          {item.isFixed && (
                            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                              <span className="text-[11px] font-bold text-amber-900">Qty:</span>
                              <Input
                                type="number"
                                min="1"
                                value={item.fixedQty || '1'}
                                onChange={(e) => updateItem(actualIndex, 'fixedQty', e.target.value)}
                                className="w-14 h-7 text-xs text-center font-bold border-amber-300 bg-white rounded-md p-1"
                              />
                            </div>
                          )}

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => duplicateItem(actualIndex)}
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="Duplicate Item"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(actualIndex)}
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Remove Item"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Sizes Section (For Selectable Items) */}
                      {!item.isFixed && (
                        <div className="bg-slate-50/80 rounded-xl p-3 sm:p-4 border border-slate-200/80 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-indigo-600" />
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Available Sizes & Default Quantities ({item.sizes.length})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openBulkSizeModal(actualIndex)}
                                className="h-7 text-xs bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-semibold rounded-md gap-1"
                              >
                                <Sparkles className="w-3 h-3" /> Quick Add Preset
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => addItemSize(actualIndex)}
                                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add Size
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {item.sizes.map((sizeQty, sizeIdx) => (
                              <div
                                key={sizeIdx}
                                className="inline-flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs hover:border-indigo-400 transition-colors"
                              >
                                <Input
                                  placeholder="Size (e.g. 3.5mm / 10 Hole)"
                                  value={sizeQty.size}
                                  onChange={(e) => updateItemSize(actualIndex, sizeIdx, 'size', e.target.value)}
                                  className="w-28 sm:w-32 h-8 text-xs font-semibold border-0 rounded-none focus-visible:ring-0 px-2.5"
                                />
                                <div className="h-4 w-px bg-slate-200" />
                                <div className="px-1.5 py-1 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                                  Qty
                                </div>
                                <Input
                                  type="number"
                                  min="1"
                                  value={sizeQty.qty}
                                  onChange={(e) => updateItemSize(actualIndex, sizeIdx, 'qty', e.target.value)}
                                  className="w-12 h-8 text-xs font-bold text-center border-0 rounded-none focus-visible:ring-0 px-1 bg-indigo-50/50 text-indigo-900"
                                />
                                {item.sizes.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeItemSize(actualIndex, sizeIdx)}
                                    className="h-8 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50 border-l border-slate-200 transition-colors"
                                    title="Remove size"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Location & Media Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                        {/* Storage Location Popover */}
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-8 text-xs rounded-lg gap-1.5 font-medium border-slate-200 ${
                                  item.location?.room || item.location?.rack || item.location?.box
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-white text-slate-600'
                                }`}
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                {item.location?.room || item.location?.rack || item.location?.box ? (
                                  <span>
                                    Loc: {item.location?.room || '-'}/{item.location?.rack || '-'}/{item.location?.box || '-'}
                                  </span>
                                ) : (
                                  <span>Set Inventory Location</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-3 space-y-2 rounded-xl" align="start">
                              <span className="text-xs font-bold text-slate-800 block">Inventory Storage Location</span>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-[10px] text-slate-500 font-bold uppercase">Room</Label>
                                  <Input
                                    placeholder="A1"
                                    value={item.location?.room || ''}
                                    onChange={(e) => updateItem(actualIndex, 'location', { ...item.location, room: e.target.value })}
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-slate-500 font-bold uppercase">Rack</Label>
                                  <Input
                                    placeholder="R2"
                                    value={item.location?.rack || ''}
                                    onChange={(e) => updateItem(actualIndex, 'location', { ...item.location, rack: e.target.value })}
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-slate-500 font-bold uppercase">Box</Label>
                                  <Input
                                    placeholder="B3"
                                    value={item.location?.box || ''}
                                    onChange={(e) => updateItem(actualIndex, 'location', { ...item.location, box: e.target.value })}
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>

                          {/* Image Link & Drive Upload */}
                          <div className="flex items-center gap-1.5">
                            <Input
                              placeholder="Image Drive Link..."
                              value={item.imageUrl || ''}
                              onChange={(e) => updateItem(actualIndex, 'imageUrl', e.target.value)}
                              className="h-8 text-xs w-44 sm:w-56 bg-white border-slate-200 rounded-lg"
                            />
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                id={`file-upload-item-${actualIndex}`}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleImageUpload(file, 'item', actualIndex);
                                    e.target.value = '';
                                  }
                                }}
                                disabled={isUploading}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg"
                                title="Upload to Drive"
                                disabled={isUploading}
                              >
                                {isUploading ? <span className="animate-spin text-xs">⏳</span> : <Upload className="w-3.5 h-3.5" />}
                              </Button>
                            </div>

                            {item.imageUrl && (
                              <a
                                href={item.imageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md"
                                title="View Image"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: INSTRUMENTS & TRAYS */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="instruments" className="space-y-4 m-0 focus-visible:ring-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                Instrument Trays & Specialized Sets ({instruments.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Instruments packed and checked during dispatch for this surgical procedure.
              </p>
            </div>

            <Button
              onClick={() => addInstrument('')}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-9 rounded-lg gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Instrument Set
            </Button>
          </div>

          {/* Quick Suggestions for Instruments */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              ⚡ Quick Suggestions (Click to Add):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_INSTRUMENTS.map((instName) => (
                <button
                  key={instName}
                  type="button"
                  onClick={() => addInstrument(instName)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-slate-400" />
                  {instName}
                </button>
              ))}
            </div>
          </div>

          {/* Instruments List */}
          {instruments.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white">
              <Wrench className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <h3 className="text-base font-bold text-slate-800">No instruments added yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Add instruments, surgical trays, or drills associated with this procedure.
              </p>
              <Button onClick={() => addInstrument('')} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Instrument Set
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {instruments.map((instrument, instIdx) => (
                <Card key={instIdx} className="border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-xs">
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Reorder Buttons & Index */}
                        <div className="flex items-center gap-1">
                          <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center text-[11px] font-bold text-purple-700">
                            {instIdx + 1}
                          </div>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              disabled={instIdx === 0}
                              onClick={() => moveInstrument(instIdx, 'up')}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-0.5"
                              title="Move up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={instIdx === instruments.length - 1}
                              onClick={() => moveInstrument(instIdx, 'down')}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-0.5"
                              title="Move down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Name Input */}
                        <div className="flex-1 min-w-0">
                          <Input
                            placeholder="e.g. Large Fragment Instrument Set, Reamer Box..."
                            value={instrument.name}
                            onChange={(e) => updateInstrument(instIdx, 'name', e.target.value)}
                            className="font-bold text-sm h-10 border-slate-200 focus-visible:ring-indigo-500 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => duplicateInstrument(instIdx)}
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Duplicate Instrument"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeInstrument(instIdx)}
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Remove Instrument"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Instrument Location & Media */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-8 text-xs rounded-lg gap-1.5 font-medium border-slate-200 ${
                              instrument.location?.room || instrument.location?.rack || instrument.location?.box
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-white text-slate-600'
                            }`}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            {instrument.location?.room || instrument.location?.rack || instrument.location?.box ? (
                              <span>
                                Loc: {instrument.location?.room || '-'}/{instrument.location?.rack || '-'}/{instrument.location?.box || '-'}
                              </span>
                            ) : (
                              <span>Set Inventory Location</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 space-y-2 rounded-xl" align="start">
                          <span className="text-xs font-bold text-slate-800 block">Instrument Storage Location</span>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px] text-slate-500 font-bold uppercase">Room</Label>
                              <Input
                                placeholder="A1"
                                value={instrument.location?.room || ''}
                                onChange={(e) => updateInstrument(instIdx, 'location', { ...instrument.location, room: e.target.value })}
                                className="h-8 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-slate-500 font-bold uppercase">Rack</Label>
                              <Input
                                placeholder="R2"
                                value={instrument.location?.rack || ''}
                                onChange={(e) => updateInstrument(instIdx, 'location', { ...instrument.location, rack: e.target.value })}
                                className="h-8 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-slate-500 font-bold uppercase">Box</Label>
                              <Input
                                placeholder="B3"
                                value={instrument.location?.box || ''}
                                onChange={(e) => updateInstrument(instIdx, 'location', { ...instrument.location, box: e.target.value })}
                                className="h-8 text-xs mt-1"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <div className="flex items-center gap-1.5">
                        <Input
                          placeholder="Image Link..."
                          value={instrument.imageUrl || ''}
                          onChange={(e) => updateInstrument(instIdx, 'imageUrl', e.target.value)}
                          className="h-8 text-xs w-44 sm:w-56 bg-white border-slate-200 rounded-lg"
                        />
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            id={`file-upload-inst-${instIdx}`}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleImageUpload(file, 'instrument', instIdx);
                                e.target.value = '';
                              }
                            }}
                            disabled={isUploading}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg"
                            title="Upload to Drive"
                            disabled={isUploading}
                          >
                            {isUploading ? <span className="animate-spin text-xs">⏳</span> : <Upload className="w-3.5 h-3.5" />}
                          </Button>
                        </div>

                        {instrument.imageUrl && (
                          <a
                            href={instrument.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md"
                            title="View Image"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bulk Size Generation Modal */}
      <Dialog open={bulkSizeModalOpen} onOpenChange={setBulkSizeModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Sparkles className="w-4 h-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Bulk Add / Generate Sizes
              </DialogTitle>
            </div>
            <DialogDescription>
              Quickly generate all sizes for <span className="font-bold text-slate-800">{activeItemIndexForBulkSizes !== null ? items[activeItemIndexForBulkSizes]?.name || 'this item' : ''}</span> without typing them one by one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Quick Orthopedic Presets
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_SIZE_OPTIONS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setBulkSizeInput(preset.sizes)}
                    className="text-left p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-indigo-50/60 hover:border-indigo-300 transition-colors text-xs"
                  >
                    <span className="font-bold text-slate-800 block truncate">{preset.label}</span>
                    <span className="text-[10px] text-slate-500 block truncate mt-0.5">{preset.sizes}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Custom Comma-Separated Sizes
                </Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">Default Qty:</span>
                  <Input
                    type="number"
                    min="1"
                    value={bulkDefaultQty}
                    onChange={(e) => setBulkDefaultQty(e.target.value)}
                    className="w-14 h-7 text-xs text-center font-bold"
                  />
                </div>
              </div>
              <textarea
                rows={3}
                placeholder="e.g. 10mm, 12mm, 14mm, 16mm, 18mm, 20mm, 22mm, 24mm (or 10mm:2, 12mm:2 for custom quantities)"
                value={bulkSizeInput}
                onChange={(e) => setBulkSizeInput(e.target.value)}
                className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBulkSizeModalOpen(false)}>Cancel</Button>
            <Button onClick={applyBulkSizes} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
              Apply Sizes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Bottom Action Bar in Editor */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-3 sm:py-4 px-4 sm:px-8 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setViewMode('catalog')}
              className="border-slate-300 text-slate-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Catalog
            </Button>
            {isEditMode && (
              <Button
                variant="ghost"
                onClick={() => {
                  setProcedureToDelete({
                    id: originalDocId || originalProcedureName.replace(/[^a-zA-Z0-9]/g, '_'),
                    name: procedureName,
                  });
                  setDeleteDialogOpen(true);
                }}
                disabled={isDeleting || isSaving}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Delete Procedure</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-600/25 px-6 font-semibold"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : isEditMode ? 'Update Procedure' : 'Save Procedure'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
