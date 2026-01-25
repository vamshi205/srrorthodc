import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, X, Save, Upload, Edit, PlusCircle, Trash2,
  Settings, Layers, Boxes, LayoutGrid, Info, Search,
  ClipboardList, Wrench
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProcedures } from '@/hooks/useProcedures';
import { Procedure } from '@/types/procedure';
import { procedureService } from '@/services/procedureService';

interface ItemWithSizes {
  name: string;
  sizes: Array<{ size: string; qty: string }>;
  imageUrl: string;
  isFixed: boolean;
  fixedQty?: string;
  location?: { room: string; rack: string; box: string };
}

interface Instrument {
  name: string;
  imageUrl: string;
  location?: { room: string; rack: string; box: string };
}

export function AddProcedureForm() {
  const { toast } = useToast();
  const { procedures, loading: proceduresLoading, fetchProcedures } = useProcedures();
  const [selectedProcedureToEdit, setSelectedProcedureToEdit] = useState<string>('__NEW__');
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalProcedureName, setOriginalProcedureName] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [procedureType, setProcedureType] = useState('General');
  const [items, setItems] = useState<ItemWithSizes[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<'save' | 'delete' | null>(null);

  const addItem = () => {
    setItems([...items, { name: '', sizes: [{ size: '', qty: '1' }], imageUrl: '', isFixed: false, location: { room: '', rack: '', box: '' } }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemWithSizes, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const addItemSize = (itemIndex: number) => {
    const updated = [...items];
    updated[itemIndex].sizes.push({ size: '', qty: '1' });
    setItems(updated);
  };

  const removeItemSize = (itemIndex: number, sizeIndex: number) => {
    const updated = [...items];
    updated[itemIndex].sizes = updated[itemIndex].sizes.filter((_, i) => i !== sizeIndex);
    setItems(updated);
  };

  const updateItemSize = (itemIndex: number, sizeIndex: number, field: 'size' | 'qty', value: string) => {
    const updated = [...items];
    updated[itemIndex].sizes[sizeIndex][field] = value;
    setItems(updated);
  };

  const addInstrument = () => {
    setInstruments([...instruments, { name: '', imageUrl: '', location: { room: '', rack: '', box: '' } }]);
  };

  const removeInstrument = (index: number) => {
    setInstruments(instruments.filter((_, i) => i !== index));
  };

  const updateInstrument = (index: number, field: keyof Instrument, value: any) => {
    const updated = [...instruments];
    updated[index] = { ...updated[index], [field]: value };
    setInstruments(updated);
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

  const loadProcedureForEdit = (procedure: Procedure) => {
    setOriginalProcedureName(procedure.name);
    setProcedureName(procedure.name);
    setProcedureType(procedure.type || 'General');

    const fixedItemsData: ItemWithSizes[] = (procedure.fixedItems || []).map((fixedItem) => {
      const location = procedure.fixedItemLocationMapping?.[fixedItem.name]?.[0];
      return {
        name: fixedItem.name,
        sizes: [],
        imageUrl: procedure.fixedItemImageMapping?.[fixedItem.name] || '',
        isFixed: true,
        fixedQty: fixedItem.qty,
        location: location || { room: '', rack: '', box: '' },
      };
    });

    const selectableItemsData: ItemWithSizes[] = (procedure.items || []).map((itemString) => {
      const parsed = parseItemString(itemString);
      const location = procedure.itemLocationMapping?.[parsed.name]?.[0];
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
      const location = procedure.instrumentLocationMapping?.[instName]?.[0];
      return {
        name: instName,
        imageUrl: procedure.instrumentImageMapping?.[instName] || '',
        location: location || { room: '', rack: '', box: '' },
      };
    });

    setInstruments(instrumentsData);
    setIsEditMode(true);
  };

  useEffect(() => {
    if (selectedProcedureToEdit && selectedProcedureToEdit !== '__NEW__') {
      const procedure = procedures.find(p => p.name === selectedProcedureToEdit);
      if (procedure) {
        loadProcedureForEdit(procedure);
      }
    } else if (selectedProcedureToEdit === '__NEW__') {
      resetForm();
    }
  }, [selectedProcedureToEdit, procedures]);

  const resetForm = () => {
    setProcedureName('');
    setProcedureType('General');
    setItems([]);
    setInstruments([]);
    setIsEditMode(false);
    setOriginalProcedureName('');
  };

  const formatItemForFirestore = (item: ItemWithSizes): string => {
    if (item.isFixed) return item.name;
    if (item.sizes.length > 0) {
      const validSizes = item.sizes.filter(s => s.size.trim() !== '');
      if (validSizes.length === 0) return item.name;
      if (validSizes.length === 1 && validSizes[0].size.trim() === '') return item.name;
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
    setPendingAction('save');
    setPasswordDialogOpen(true);
  };

  const executeSave = async () => {
    setIsSaving(true);
    setPasswordDialogOpen(false);
    setEnteredPassword('');

    try {
      const fixedItemsList = items.filter(item => item.isFixed);
      const selectableItemsList = items.filter(item => !item.isFixed);

      const fixedItems = fixedItemsList.map(item => ({
        name: item.name,
        qty: item.fixedQty || '1'
      }));

      const procedureItems = selectableItemsList.map(formatItemForFirestore);
      const instrumentNames = instruments.map(i => i.name);

      const instrumentImageMapping: Record<string, string> = {};
      const instrumentLocationMapping: Record<string, any> = {};
      instruments.forEach(inst => {
        if (inst.imageUrl) instrumentImageMapping[inst.name] = inst.imageUrl;
        if (inst.location && (inst.location.room || inst.location.rack || inst.location.box)) {
          instrumentLocationMapping[inst.name] = [inst.location];
        }
      });

      const fixedItemImageMapping: Record<string, string> = {};
      const fixedItemLocationMapping: Record<string, any> = {};
      fixedItemsList.forEach(item => {
        if (item.imageUrl) fixedItemImageMapping[item.name] = item.imageUrl;
        if (item.location && (item.location.room || item.location.rack || item.location.box)) {
          fixedItemLocationMapping[item.name] = [item.location];
        }
      });

      const itemImageMapping: Record<string, string> = {};
      const itemLocationMapping: Record<string, any> = {};
      selectableItemsList.forEach(item => {
        if (item.imageUrl) itemImageMapping[item.name] = item.imageUrl;
        if (item.location && (item.location.room || item.location.rack || item.location.box)) {
          itemLocationMapping[item.name] = [item.location];
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

      if (isEditMode && originalProcedureName !== procedureName.trim()) {
        await procedureService.delete(originalProcedureName);
      }

      await procedureService.save(procedureData);

      toast({
        title: 'Success',
        description: `Procedure "${procedureName}" saved successfully`,
      });

      resetForm();
      setSelectedProcedureToEdit('__NEW__');
      fetchProcedures();

    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: 'Error',
        description: 'Failed to save procedure: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setPendingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !originalProcedureName) return;
    setPendingAction('delete');
    setPasswordDialogOpen(true);
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    setPasswordDialogOpen(false);
    setEnteredPassword('');
    try {
      await procedureService.delete(originalProcedureName);
      toast({ title: 'Deleted', description: `Procedure "${originalProcedureName}" deleted.` });
      resetForm();
      setSelectedProcedureToEdit('__NEW__');
      fetchProcedures();
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to delete: ' + error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setPendingAction(null);
    }
  };

  const handleConfirmPassword = () => {
    if (enteredPassword.trim() !== "srrortho") {
      toast({ title: "Incorrect password", variant: "destructive" });
      return;
    }

    if (pendingAction === 'save') {
      executeSave();
    } else if (pendingAction === 'delete') {
      executeDelete();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* 1. Selection & Mode Toggle */}
      <Card className="border-2 border-slate-200 shadow-sm overflow-hidden bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
        <CardHeader className="pb-3 border-b border-white/50 bg-white/30 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Settings className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <CardTitle className="text-lg">Procedure Management</CardTitle>
                <CardDescription>Select a procedure to edit or create a new one</CardDescription>
              </div>
            </div>
            {isEditMode && (
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-blue-50 border-blue-200 text-blue-700"
                onClick={() => {
                  resetForm();
                  setSelectedProcedureToEdit('__NEW__');
                }}
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                New Procedure
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Target Procedure</Label>
              <Select
                value={selectedProcedureToEdit}
                onValueChange={(value) => setSelectedProcedureToEdit(value)}
              >
                <SelectTrigger className="bg-white border-slate-300 h-10 shadow-sm focus:ring-blue-500/20">
                  <SelectValue placeholder={proceduresLoading ? "Loading procedures..." : "Choose procedure..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NEW__" className="font-medium text-blue-700">＋ Create New Procedure</SelectItem>
                  {procedures.map((proc) => (
                    <SelectItem key={proc.name} value={proc.name}>
                      {proc.name} <span className="text-slate-400 ml-2">({proc.type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProcedureToEdit !== '__NEW__' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetForm();
                  setSelectedProcedureToEdit('__NEW__');
                }}
                className="text-slate-500 mb-0.5 h-10"
              >
                Clear Selection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Main Form Area */}
      <Tabs defaultValue="items" className="space-y-4">
        <Card className="border-2 border-slate-200 shadow-md">
          <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 leading-none">Procedure Name</Label>
                <Input
                  placeholder="e.g. Total Knee Replacement"
                  value={procedureName}
                  onChange={(e) => setProcedureName(e.target.value)}
                  disabled={isEditMode}
                  className={`text-lg font-bold bg-transparent border-0 border-b-2 rounded-none px-0 h-auto focus-visible:ring-0 focus-visible:border-blue-500 transition-all ${isEditMode ? 'opacity-70 border-slate-300' : 'border-blue-200'}`}
                />
                {isEditMode && <p className="text-[10px] text-slate-500 italic">Rename not permitted in edit mode</p>}
              </div>

              <div className="w-full md:w-56 space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 leading-none">Specialty Type</Label>
                <Select value={procedureType} onValueChange={setProcedureType}>
                  <SelectTrigger className="bg-white border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['General', 'Surgery', 'Trauma', 'Spine', 'Orthopedic'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-6">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100/80 p-1 h-12">
                <TabsTrigger value="items" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm text-sm">
                  <ClipboardList className="w-4 h-4" /> Implants & Consumables
                </TabsTrigger>
                <TabsTrigger value="instruments" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm text-sm">
                  <Wrench className="w-4 h-4" /> Instruments & Sets
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <TabsContent value="items" className="m-0 focus-visible:ring-0">
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-600">Configured Implants</div>
                  <Button onClick={addItem} size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-sm gap-2">
                    <Plus className="w-4 h-4" /> Add Item
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {items.map((item, itemIndex) => (
                    <div key={itemIndex} className={`group relative rounded-xl border-2 p-4 transition-all duration-200 ${item.isFixed ? 'border-indigo-100 bg-indigo-50/20' : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'}`}>
                      <div className="flex flex-col md:flex-row gap-4">
                        {/* Type Indicator */}
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                          <Badge variant={item.isFixed ? "default" : "secondary"} className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 ${item.isFixed ? 'bg-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
                            {item.isFixed ? 'Fixed' : 'Selectable'}
                          </Badge>
                          <Button
                            type="button"
                            onClick={() => removeItem(itemIndex)}
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex-1 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs uppercase text-slate-500 font-bold">Item Name</Label>
                              <Input
                                placeholder="Enter item name..."
                                value={item.name}
                                onChange={(e) => updateItem(itemIndex, 'name', e.target.value)}
                                className="border-slate-300 h-9"
                              />
                            </div>
                            <div className="space-y-1.5 pt-px">
                              <Label className="text-xs uppercase text-slate-500 font-bold">Configuration</Label>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={item.isFixed ? 'fixed' : 'selectable'}
                                  onValueChange={(value) => updateItem(itemIndex, 'isFixed', value === 'fixed')}
                                >
                                  <SelectTrigger className="bg-white border-slate-300 h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="selectable">User Picks Size</SelectItem>
                                    <SelectItem value="fixed">Always Included</SelectItem>
                                  </SelectContent>
                                </Select>
                                {item.isFixed && (
                                  <Input
                                    type="number"
                                    min="1"
                                    placeholder="Qty"
                                    value={item.fixedQty || '1'}
                                    onChange={(e) => updateItem(itemIndex, 'fixedQty', e.target.value)}
                                    className="w-16 h-9 border-indigo-300 focus:ring-indigo-500"
                                  />
                                )}
                              </div>
                            </div>
                          </div>

                          {!item.isFixed && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-slate-600">Available Sizes & Quantities</Label>
                                <Button
                                  type="button"
                                  onClick={() => addItemSize(itemIndex)}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] bg-white border-slate-300"
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Add Size
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {item.sizes.map((sizeQty, sizeIndex) => (
                                  <div key={sizeIndex} className="flex items-center bg-white border border-slate-300 rounded shadow-sm overflow-hidden group/size">
                                    <Input
                                      placeholder="Size"
                                      value={sizeQty.size}
                                      onChange={(e) => updateItemSize(itemIndex, sizeIndex, 'size', e.target.value)}
                                      className="w-20 border-0 focus-visible:ring-0 h-8 text-[11px] font-medium border-r rounded-none px-2"
                                    />
                                    <Input
                                      type="number"
                                      min="1"
                                      value={sizeQty.qty}
                                      onChange={(e) => updateItemSize(itemIndex, sizeIndex, 'qty', e.target.value)}
                                      className="w-10 border-0 focus-visible:ring-0 h-8 text-[11px] font-bold rounded-none px-1 text-center bg-blue-50/30"
                                    />
                                    {item.sizes.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeItemSize(itemIndex, sizeIndex)}
                                        className="h-8 px-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 border-l transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] uppercase text-slate-400 font-bold">Storage Location</Label>
                              <div className="grid grid-cols-3 gap-2">
                                <Input placeholder="Rm" value={item.location?.room} onChange={(e) => updateItem(itemIndex, 'location', { ...item.location, room: e.target.value })} className="h-8 text-[10px] border-slate-200" />
                                <Input placeholder="Rk" value={item.location?.rack} onChange={(e) => updateItem(itemIndex, 'location', { ...item.location, rack: e.target.value })} className="h-8 text-[10px] border-slate-200" />
                                <Input placeholder="Bx" value={item.location?.box} onChange={(e) => updateItem(itemIndex, 'location', { ...item.location, box: e.target.value })} className="h-8 text-[10px] border-slate-200" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] uppercase text-slate-400 font-bold">Image Link</Label>
                              <Input
                                placeholder="Google Drive URL"
                                value={item.imageUrl}
                                onChange={(e) => updateItem(itemIndex, 'imageUrl', e.target.value)}
                                className="h-8 text-[10px] border-slate-200"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                      <p className="text-slate-500 text-sm">No items configured yet for this procedure.</p>
                      <Button onClick={addItem} variant="ghost" className="mt-2 text-blue-600">Start by adding an implant</Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="instruments" className="m-0 focus-visible:ring-0">
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-600">Instrument Inventory</div>
                  <Button onClick={addInstrument} size="sm" className="bg-indigo-600 hover:bg-indigo-700 shadow-sm gap-2">
                    <Plus className="w-4 h-4" /> Add Instrument
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {instruments.map((instrument, instIdx) => (
                    <div key={instIdx} className="group relative rounded-xl border border-slate-200 p-4 bg-white hover:border-blue-200 transition-all shadow-sm">
                      <div className="absolute top-4 right-4 group-hover:block transition-all">
                        <Button
                          type="button"
                          onClick={() => removeInstrument(instIdx)}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase text-slate-500 font-bold">Instrument/Set Name</Label>
                            <Input
                              placeholder="e.g. Femoral Reamer Set"
                              value={instrument.name}
                              onChange={(e) => updateInstrument(instIdx, 'name', e.target.value)}
                              className="border-slate-300 h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase text-slate-500 font-bold">Image URL</Label>
                            <Input
                              placeholder="Google Drive URL"
                              value={instrument.imageUrl}
                              onChange={(e) => updateInstrument(instIdx, 'imageUrl', e.target.value)}
                              className="border-slate-300 h-9"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Inventory Location</Label>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            <div className="col-span-1 space-y-1 text-center">
                              <span className="text-[9px] font-bold text-slate-400 block px-2">ROOM</span>
                              <Input value={instrument.location?.room} onChange={(e) => updateInstrument(instIdx, 'location', { ...instrument.location, room: e.target.value })} className="h-8 text-xs text-center border-slate-200" />
                            </div>
                            <div className="col-span-1 space-y-1 text-center">
                              <span className="text-[9px] font-bold text-slate-400 block px-2">RACK</span>
                              <Input value={instrument.location?.rack} onChange={(e) => updateInstrument(instIdx, 'location', { ...instrument.location, rack: e.target.value })} className="h-8 text-xs text-center border-slate-200" />
                            </div>
                            <div className="col-span-1 space-y-1 text-center">
                              <span className="text-[9px] font-bold text-slate-400 block px-2">BOX</span>
                              <Input value={instrument.location?.box} onChange={(e) => updateInstrument(instIdx, 'location', { ...instrument.location, box: e.target.value })} className="h-8 text-xs text-center border-slate-200" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {instruments.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                      <p className="text-slate-500 text-sm">No instruments added for this procedure.</p>
                      <Button onClick={addInstrument} variant="ghost" className="mt-2 text-indigo-600">Add instruments or sets</Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-4 px-6 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            {isEditMode && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="gap-2 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete Procedure</span>
                <span className="sm:hidden">Delete</span>
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => resetForm()} variant="outline" disabled={isSaving} className="border-slate-300">
              Discard Changes
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-700 hover:bg-blue-800 text-white shadow-lg shadow-blue-700/20 gap-2 min-w-[140px]">
              {isEditMode ? (
                <>
                  <Edit className="w-4 h-4" />
                  {isSaving ? 'Updating...' : 'Update Procedure'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Procedure'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              Please enter password to {pendingAction === 'delete' ? 'delete' : 'save/update'} this procedure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                placeholder="Enter password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmPassword();
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={pendingAction === 'delete' ? "destructive" : "default"}
                onClick={handleConfirmPassword}
              >
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
