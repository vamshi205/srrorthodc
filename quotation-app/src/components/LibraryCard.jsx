import React from 'react';
import { Edit2, Trash2, ArrowRight, Copy, Pin, FileText } from 'lucide-react';

export default function LibraryCard({ template, priceLists = [], onEdit, onDelete, onUse, onDuplicate, onTogglePin, showAdminTools }) {
  const configuredPriceList = template.defaultPriceListId 
    ? priceLists.find(pl => pl.id === template.defaultPriceListId) 
    : null;

  return (
    <div className="bg-white border border-slate-200 hover:border-teal-500 rounded-2xl p-5 flex flex-col justify-between group relative transition-all duration-200 shadow-2xs hover:shadow-lg">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-[16.5px] font-bold text-slate-900 leading-tight tracking-tight group-hover:text-teal-700 transition-colors">
            {template.name}
          </h3>
          {showAdminTools ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(template.id);
              }}
              className={`transition-all ${template.isPinned ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100'}`}
              title={template.isPinned ? "Unpin template" : "Pin template"}
            >
              <Pin size={15} fill={template.isPinned ? "currentColor" : "none"} />
            </button>
          ) : template.isPinned && (
            <div className="text-teal-600" title="Pinned template">
              <Pin size={15} fill="currentColor" />
            </div>
          )}
        </div>

        {template.description && (
          <p className="text-[13px] text-slate-600 leading-relaxed line-clamp-2 mt-1 mb-2">
            {template.description}
          </p>
        )}

        {/* Configured Price List Badge */}
        {configuredPriceList ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-semibold mt-1">
            <FileText size={12} className="text-teal-600 shrink-0" />
            <span className="truncate max-w-[200px]" title={configuredPriceList.label}>
              Price List: {configuredPriceList.label}
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-medium mt-1">
            <FileText size={12} className="text-slate-400 shrink-0" />
            <span>No default price list</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-slate-100">
        <button
          onClick={() => onUse(template)}
          className="bg-teal-600 hover:bg-teal-700 text-white !py-1.5 !px-3.5 text-[12.5px] flex items-center gap-1.5 font-bold rounded-xl shadow-2xs hover:shadow-sm transition-all"
        >
          Use Template <ArrowRight size={14} />
        </button>
        
        {showAdminTools && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(template)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              title="Edit template"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => onDuplicate(template)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              title="Duplicate template"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => onDelete(template.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Delete template"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
