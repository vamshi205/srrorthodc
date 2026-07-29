import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Procedure } from '@/types/procedure';

interface ProcedureSelectorProps {
  procedures: Procedure[];
  procedureTypes: string[];
  activeProcedureNames: string[];
  onSelectProcedure: (procedure: Procedure) => void;
  searchProcedures: (query: string, type?: string) => Procedure[];
  initialFilterType?: string;
}

export function ProcedureSelector({
  procedures,
  procedureTypes,
  activeProcedureNames,
  onSelectProcedure,
  searchProcedures,
  initialFilterType,
}: ProcedureSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState(initialFilterType || 'All');

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input on mount so it is active immediately
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset filter when initialFilterType changes
  useEffect(() => {
    if (initialFilterType) {
      setSelectedType(initialFilterType);
    }
  }, [initialFilterType]);

  const filteredProcedures = useMemo(() => {
    return searchProcedures(searchQuery, selectedType);
  }, [searchQuery, selectedType, searchProcedures]);

  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      {/* Search Input */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400 z-10 animate-pulse" />
        <Input
          ref={inputRef}
          placeholder="Search procedures..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 sm:pl-11 h-11 sm:h-12 text-sm sm:text-base w-full bg-white dark:bg-slate-900 border-2 border-teal-500 ring-4 ring-teal-500/20 shadow-lg shadow-teal-500/15 rounded-xl font-medium placeholder:text-muted-foreground/70"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 border-b border-border">
        {procedureTypes.filter((t) => t !== 'None' && t !== 'none').map((type) => {
          const typeCount = type === 'All'
            ? procedures.length
            : procedures.filter(p => p.type === type).length;
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                selectedType === type
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{type}</span>
              <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-semibold ${
                selectedType === type ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {typeCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Procedures List Container */}
      <div className="flex-1 min-h-[400px] max-h-[calc(100vh-230px)] sm:max-h-[calc(100vh-210px)] overflow-y-auto pr-1 space-y-4">
        {(() => {
          // Group procedures by type for organized display
          const grouped = filteredProcedures.reduce((acc, proc) => {
            const cat = proc.type || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(proc);
            return acc;
          }, {} as Record<string, Procedure[]>);

          const categoryKeys = Object.keys(grouped);

          if (categoryKeys.length === 0) {
            return (
              <div className="text-center py-12 text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Search className="w-10 h-10 mx-auto mb-2 opacity-30 text-teal-600" />
                <p className="font-semibold text-slate-700">No procedures found</p>
                <p className="text-xs text-muted-foreground mt-0.5">Try adjusting your search query or filter</p>
              </div>
            );
          }

          return categoryKeys.map((category) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200/60">
                  {category} ({grouped[category].length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {grouped[category].map((procedure) => {
                  const isActive = activeProcedureNames.includes(procedure.name);
                  const itemCount = procedure.items.length + (procedure.fixedItems?.length || 0);
                  const instCount = procedure.instruments.length;

                  return (
                    <button
                      key={procedure.name}
                      onClick={() => onSelectProcedure(procedure)}
                      className={`text-left p-3 rounded-xl border-2 transition-all duration-200 flex items-center justify-between gap-2 shadow-xs ${
                        isActive
                          ? 'bg-teal-50/90 border-teal-500 shadow-md ring-2 ring-teal-500/20'
                          : 'bg-white border-slate-200 hover:border-teal-400 hover:bg-teal-50/30'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-slate-900 truncate leading-snug">
                          {procedure.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] font-medium text-slate-500">
                          <span>📦 {itemCount} items</span>
                          <span>•</span>
                          <span>🔧 {instCount} insts</span>
                        </div>
                      </div>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-transform ${
                          isActive
                            ? 'bg-teal-600 text-white shadow-sm scale-105'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-700'
                        }`}
                      >
                        {isActive ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
