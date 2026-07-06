import React from 'react';
import { Search, X } from 'lucide-react';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';

interface GlobalSearchWidgetProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

export function GlobalSearchWidget({ 
  searchQuery, 
  setSearchQuery, 
  searchInputRef 
}: GlobalSearchWidgetProps) {
  const searchSuggestions = [
    "Bank Statement",
    "Invoice",
    "Identity",
    "Utility Bill"
  ];

  return (
    <DashboardWidget colSpan="col-span-12" className="p-5 border-blue-50 bg-blue-50/10">
      <div className="relative w-full flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder='Search vault by name, entity, metadata tag... (Press "/" to focus)'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3.5 bg-white border border-gray-150 rounded-2xl text-sm font-semibold placeholder-gray-400 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 transition-all shadow-sm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Try searching:</span>
        {searchSuggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setSearchQuery(suggestion)}
            className="text-xs font-semibold text-blue-600 bg-blue-50/50 hover:bg-blue-50 px-3 py-1 rounded-lg border border-blue-100/50 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </DashboardWidget>
  );
}
