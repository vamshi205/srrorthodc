import React from 'react';
import { Plus, Database } from 'lucide-react';
import LibraryCard from './LibraryCard';

const LibraryView = ({ templates, useTemplate, setEditingTemplate, setView, setTemplates }) => {
  return (
    <div className="h-full overflow-y-auto px-8 py-12 md:px-16 md:py-16">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <h1 className="apple-title-1">Templates</h1>
            <p className="apple-subtitle">Select a template to generate a quotation, or create a new one.</p>
          </div>
          <button 
            onClick={() => {
              setEditingTemplate({
                id: Date.now().toString(),
                name: 'New Template',
                description: '',
                requiresPriceList: false,
                subject: '',
                defaultMake: '',
                defaultDelivery: '',
                defaultDiscount: '',
                defaultGst: '',
                defaultPayment: '',
                defaultValidity: '',
                content: []
              });
              setView('builder');
            }} 
            className="btn-primary"
          >
            <Plus size={18} /> New Template
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(t => (
            <LibraryCard 
              key={t.id} 
              template={t} 
              onUse={useTemplate} 
              onEdit={(template) => { setEditingTemplate(JSON.parse(JSON.stringify(template))); setView('builder'); }} 
              onDelete={(id) => {
                if (window.confirm('Are you sure you want to delete this template?')) {
                  setTemplates(templates.filter(temp => temp.id !== id));
                }
              }} 
            />
          ))}
          {templates.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center border border-dashed border-[var(--apple-gray-3)] rounded-3xl">
              <Database size={48} className="text-[var(--apple-gray-4)] mb-4" />
              <p className="text-[17px] font-medium text-[var(--apple-gray-5)]">No templates found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(LibraryView);
