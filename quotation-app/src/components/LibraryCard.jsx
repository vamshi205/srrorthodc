import React from 'react';
import { Edit2, Trash2, ArrowRight, Copy, Pin } from 'lucide-react';

export default function LibraryCard({ template, onEdit, onDelete, onUse, onDuplicate, onTogglePin, showAdminTools }) {
  return (
    <div className="apple-card p-6 flex flex-col justify-between group">
      {/* Top: name + description */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-[19px] font-semibold text-[var(--apple-black)] leading-tight tracking-tight">{template.name}</h3>
          {showAdminTools ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(template.id);
              }}
              className={`transition-all ${template.isPinned ? 'text-[var(--coral)]' : 'text-[var(--apple-gray-3)] hover:text-[var(--apple-gray-5)] opacity-0 group-hover:opacity-100'}`}
              title={template.isPinned ? "Unpin template" : "Pin template"}
            >
              <Pin size={16} fill={template.isPinned ? "currentColor" : "none"} />
            </button>
          ) : template.isPinned && (
            <div className="text-[var(--coral)]" title="Pinned template">
              <Pin size={16} fill="currentColor" />
            </div>
          )}
        </div>
        <p className="text-[15px] text-[var(--apple-gray-5)] leading-relaxed line-clamp-2">{template.description}</p>
      </div>

      {/* Bottom: actions */}
      <div className="flex items-center justify-between mt-6 pt-5 border-t border-[var(--apple-gray-2)]">
        <button
          onClick={() => onUse(template)}
          className="flex items-center gap-1.5 text-[14px] font-semibold tracking-tight transition-all"
          style={{ color: 'var(--emerald)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--emerald-dark)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--emerald)'}
        >
          Use Template <ArrowRight size={16} />
        </button>
        
        {showAdminTools && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(template)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--apple-gray-4)] hover:text-[var(--apple-black)] hover:bg-[var(--apple-gray-1)] transition-all"
              title="Edit template"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => onDuplicate(template)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--apple-gray-4)] hover:text-[var(--apple-black)] hover:bg-[var(--apple-gray-1)] transition-all"
              title="Duplicate template"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={() => onDelete(template.id)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--apple-gray-4)] hover:text-red-500 hover:bg-red-50 transition-all"
              title="Delete template"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
