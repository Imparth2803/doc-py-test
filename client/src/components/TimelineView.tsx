import React, { useMemo, useState, useEffect } from 'react';
import { parseNormalizedDate } from '../utils/dateParser';
import { useApp } from '../context/AppContext';
import { Document } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  ChevronRight, 
  FileText, 
  User, 
  X, 
  Share2, 
  Clock,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  ChevronLeft,
  Lock,
  Unlock
} from 'lucide-react';
import { cn, isValidMetadata } from '../lib/utils';
import { TopNav } from './TopNav';
import { ShareModal } from './ShareModal';
import { decryptDocument, processDocument } from '../services/documentApi';
import { mapApiDocumentToDocument } from '../utils/documentMapper';


// Searchable Dropdown Component for filtering Types and Entities
const SearchableDropdown: React.FC<{ 
  options: string[], 
  value: string, 
  onChange: (val: string) => void, 
  counts: Record<string, number>,
  placeholder: string 
}> = ({ options, value, onChange, counts, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  return (
    <div className="relative w-full">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 outline-none transition-all text-left truncate"
      >
        <span className="truncate">{value}</span>
        <ChevronRight size={14} className={cn("transition-transform text-gray-400 shrink-0", isOpen ? "rotate-90" : "rotate-0")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[300px]"
            >
              <div className="p-3 border-b border-gray-50 bg-white sticky top-0 z-10">
                <input 
                  type="text" 
                  autoFocus
                  placeholder={placeholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 outline-none transition-all shadow-inner"
                />
              </div>
              <div className="overflow-y-auto p-1 flex-1 pr-1.5 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                {filteredOptions.length === 0 ? (
                   <div className="p-4 text-center text-xs font-medium text-gray-400">No results found</div>
                ) : (
                  filteredOptions.map(opt => (
                    <button 
                      key={opt}
                      onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-left group",
                        value === opt ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <span className="truncate flex-1 pr-2">{opt}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-md shrink-0",
                        value === opt ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-500"
                      )}>
                        {opt.startsWith('All ') ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[opt] || 0}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
const ActiveChip: React.FC<{ label: string, icon?: React.ReactNode, onRemove: () => void }> = ({ label, icon, onRemove }) => (
  <motion.span 
    initial={{ opacity: 0, scale: 0.8 }} 
    animate={{ opacity: 1, scale: 1 }} 
    exit={{ opacity: 0, scale: 0.8 }}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 shadow-sm text-xs font-semibold text-gray-700 rounded-lg hover:border-gray-300 transition-all pr-2"
  >
     {icon && <span className="text-gray-400">{icon}</span>}
     <span>{label}</span>
     <button onClick={onRemove} className="opacity-40 hover:opacity-100 hover:text-red-500 hover:bg-red-50 p-0.5 rounded-md transition-all ml-1"><X size={14}/></button>
  </motion.span>
);

export function TimelineView() {
  const { documents, fetchLiveDocuments } = useApp();
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [shareDoc, setShareDoc] = useState<Document | null>(null);

  useEffect(() => {
    if (!viewingDoc) return;
    const updated = documents.find(d => d._id === viewingDoc._id);
    if (updated) setViewingDoc(updated);
  }, [documents]);

  const [modalPassword, setModalPassword] = useState('');
  const [modalIsDecrypting, setModalIsDecrypting] = useState(false);
  const [modalIsProcessing, setModalIsProcessing] = useState(false);
  const [modalErrorMsg, setModalErrorMsg] = useState<string | null>(null);

  const handleModalDecrypt = async (docId: string) => {
    if (!modalPassword.trim()) return;
    setModalIsDecrypting(true);
    setModalErrorMsg(null);
    try {
      const updatedDoc = await decryptDocument(docId, modalPassword);
      setModalPassword('');
      const mapped = mapApiDocumentToDocument(updatedDoc);
      setViewingDoc(mapped);
      await fetchLiveDocuments();
    } catch (err: any) {
      console.error(err);
      setModalErrorMsg(err.message || 'Decryption failed');
    } finally {
      setModalIsDecrypting(false);
    }
  };

  const handleModalAnalyze = async (docId: string) => {
    setModalIsProcessing(true);
    setModalErrorMsg(null);
    try {
      const updatedDoc = await processDocument(docId);
      const mapped = mapApiDocumentToDocument(updatedDoc);
      setViewingDoc(mapped);
      await fetchLiveDocuments();
    } catch (err: any) {
      console.error(err);
      setModalErrorMsg(err.message || 'Analysis failed');
    } finally {
      setModalIsProcessing(false);
    }
  };
  
  // Filter & Grouping State
  const [selectedType, setSelectedType] = useState<string>('All Types');
  const [selectedEntity, setSelectedEntity] = useState<string>('All Entities');
  const [groupingMode, setGroupingMode] = useState<'month' | 'year'>('month');
  const [showFilters, setShowFilters] = useState(false);

  // Date Filtering State
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | '30days' | '90days' | 'thisYear' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const hasActiveFilters = selectedType !== 'All Types' || selectedEntity !== 'All Entities' || dateFilterMode !== 'all';

  const clearFilters = () => {
    setSelectedType('All Types');
    setSelectedEntity('All Entities');
    setDateFilterMode('all');
    setStartDate('');
    setEndDate('');
  };

  const getBestDate = (doc: Document): string => {
    const sFields = doc.metadata?.summaryFields || {};
    const priorityKeys = [
      'Bill Date', 
      'Invoice Date', 
      'Statement Date', 
      'Due Date', 
      'Issue Date',
      'Date'
    ];

    for (const key of priorityKeys) {
      if (sFields[key] && typeof sFields[key] === 'string') {
        return sFields[key];
      }
    }

    return doc.date; // Fallback to createdAt
  };

  // Helper to parse messy dates into MMMM YYYY or YYYY
  const getGroupKey = (dateStr: string, mode: 'month' | 'year'): string => {
    try {
      // Handle DD-MM-YYYY or similar
      const parts = dateStr.split(/[-/]/);
      let date: Date;
      
      if (parts.length === 3) {
        // Try to guess if parts[0] is day or year
        if (parts[0].length === 4) {
          date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      } else {
        date = new Date(dateStr);
      }

      if (isNaN(date.getTime())) return "Unknown Date";

      if (mode === 'year') return date.getFullYear().toString();
      
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    } catch {
      return "Unknown Date";
    }
  };

  // Derived filter options
  const allTypes = useMemo(() => {
    const types = new Set(documents.map(d => d.docType || 'Document'));
    return ['All Types', ...Array.from(types).sort()];
  }, [documents]);

  const allEntities = useMemo(() => {
    const entities = new Set(documents.flatMap(d => d.entities || []));
    return ['All Entities', ...Array.from(entities).sort()];
  }, [documents]);

  const allYears = useMemo(() => {
    const years = new Set(documents.map(d => {
      const dateStr = getBestDate(d);
      // Try to extract year from various formats
      const match = dateStr.match(/\d{4}/);
      if (match) return match[0];
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date.getFullYear().toString();
    }).filter(Boolean));
    return Array.from(years).sort((a, b) => (b as string).localeCompare(a as string));
  }, [documents]);

  // Calculate global facet counts for the filter UI
  const facetCounts = useMemo(() => {
    const counts = { types: {} as Record<string, number>, entities: {} as Record<string, number> };
    documents.forEach(doc => {
      const type = doc.docType || 'Document';
      counts.types[type] = (counts.types[type] || 0) + 1;
      
      const docEntities = doc.entities && doc.entities.length > 0 ? doc.entities : [];
      docEntities.forEach(ent => {
        counts.entities[ent] = (counts.entities[ent] || 0) + 1;
      });
    });
    return counts;
  }, [documents]);

  const filteredDocs = useMemo(() => {
    if (!documents.length) return [];
    
    return documents.filter(doc => {
      const typeMatch = selectedType === 'All Types' || (doc.docType || 'Document') === selectedType;
      const entityMatch = selectedEntity === 'All Entities' || (doc.entities || []).includes(selectedEntity);
      
      // Date Filtering
      let dateMatch = true;
      const dateStr = getBestDate(doc);
      
      if (dateFilterMode !== 'all') {
        const docDate = new Date(dateStr);
        let d = docDate;
        if (isNaN(d.getTime())) {
           const parts = dateStr.split(/[-/]/);
           if (parts.length === 3) {
             if (parts[0].length === 4) d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
             else d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
           }
        }

        if (!isNaN(d.getTime())) {
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

          if (dateFilterMode === 'today') {
            dateMatch = d >= startOfToday;
          } else if (dateFilterMode === '30days') {
            const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
            dateMatch = d >= thirtyDaysAgo;
          } else if (dateFilterMode === '90days') {
            const ninetyDaysAgo = new Date(startOfToday.getTime() - 90 * 24 * 60 * 60 * 1000);
            dateMatch = d >= ninetyDaysAgo;
          } else if (dateFilterMode === 'thisYear') {
            dateMatch = d.getFullYear() === now.getFullYear();
          } else if (dateFilterMode === 'custom') {
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (start) dateMatch = dateMatch && d >= start;
            if (end) dateMatch = dateMatch && d <= end;
          }
        } else {
           dateMatch = false;
        }
      }

      return typeMatch && entityMatch && dateMatch;
    });
  }, [documents, selectedType, selectedEntity, dateFilterMode, startDate, endDate]);

  const upcomingEvents = useMemo(() => {
    const events: Array<{ date: Date; label: string; doc: Document; type: string }> = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    filteredDocs.forEach(doc => {
      const sFields = doc.metadata?.summaryFields || {};
      const futureKeys = ['Due Date', 'Renewal Date', 'Expiry Date', 'Policy End Date', 'Valid Until'];
      
      for (const key of futureKeys) {
        if (sFields[key]) {
          const d = parseNormalizedDate(sFields[key]);
          if (d && d >= today) {
             events.push({ date: d, label: key, doc, type: doc.docType || 'Document' });
          }
        }
      }
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 4); // Top 4 upcoming
  }, [filteredDocs]);

  const timelineData = useMemo(() => {
    if (!filteredDocs.length) return [];

    // 2. Group by Year then by sub-key
    const yearGroups: Record<string, Record<string, Document[]>> = {};

    filteredDocs.forEach(doc => {
      const bestDate = getBestDate(doc);
      const year = getGroupKey(bestDate, 'year');
      const monthYear = getGroupKey(bestDate, 'month');

      if (!yearGroups[year]) yearGroups[year] = {};
      
      const subKey = groupingMode === 'month' ? monthYear : year;
      
      if (!yearGroups[year][subKey]) yearGroups[year][subKey] = [];
      yearGroups[year][subKey].push(doc);
    });

    // 3. Sort Year Groups (descending)
    return Object.entries(yearGroups)
      .sort(([yearA], [yearB]) => {
        if (yearA === "Unknown Date") return 1;
        if (yearB === "Unknown Date") return -1;
        return yearB.localeCompare(yearA);
      })
      .map(([year, subGroups]) => {
        // Sort SubGroups within Year (descending)
        const sortedSubGroups = Object.entries(subGroups).sort(([subA], [subB]) => {
           if (subA === "Unknown Date" || subA === year) return 1;
           if (subB === "Unknown Date" || subB === year) return -1;
           const dateA = new Date(subA);
           const dateB = new Date(subB);
           return dateB.getTime() - dateA.getTime();
        });
        
        // Calculate Insights
        let totalDocs = 0;
        let totalAmount = 0;
        let renewals = 0;
        
        Object.values(subGroups).flat().forEach(doc => {
           totalDocs++;
           const sFields = doc.metadata?.summaryFields || {};
           
           const amountKeys = ['Total Amount', 'Due Amount', 'Amount Upto Due Date', 'Amount', 'Amount Due'];
           for (const key of amountKeys) {
             if (sFields[key]) {
               const val = parseFloat(String(sFields[key]).replace(/[^0-9.]/g, ''));
               if (!isNaN(val)) totalAmount += val;
               break; // only count one amount per doc
             }
           }
           
           if (sFields['Renewal Date'] || sFields['Expiry Date']) renewals++;
        });

        return { year, subGroups: sortedSubGroups, insights: { totalDocs, totalAmount, renewals } };
      });
  }, [filteredDocs, groupingMode]);

  const dateRangeString = useMemo(() => {
    if (!filteredDocs.length) return 'N/A';
    
    const dates = filteredDocs.map(doc => {
      const dStr = getBestDate(doc);
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) return d;
      
      const parts = dStr.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
        return new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
      }
      return null;
    }).filter(d => d !== null && !isNaN(d.getTime())) as Date[];

    if (dates.length === 0) return 'Unknown Dates';
    
    dates.sort((a, b) => a.getTime() - b.getTime());
    
    const oldest = dates[0];
    const newest = dates[dates.length - 1];

    const format = (d: Date) => `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`;
    
    if (oldest.getFullYear() === newest.getFullYear() && oldest.getMonth() === newest.getMonth()) {
      return format(oldest);
    }
    
    return `${format(oldest)} → ${format(newest)}`;
  }, [filteredDocs]);

  return (
    <div className="min-h-screen bg-[#fafafc] text-gray-900 font-sans pb-24 relative flex flex-col items-center">
      <TopNav activeTab="timeline" />

      <main className="w-full max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-col gap-8 mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-gray-900 mb-2">Timeline</h1>
              <p className="text-gray-500 font-medium">Events and documents ordered by chronological significance.</p>
            </div>

            {/* Filter Toggle Button */}
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all font-bold text-sm shadow-sm",
                showFilters || hasActiveFilters 
                  ? "bg-white border-blue-200 text-blue-600 ring-4 ring-blue-500/5" 
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              <SlidersHorizontal size={18} />
              <span>{showFilters ? 'Hide Filters' : 'Filters'}</span>
              {hasActiveFilters && (
                <span className="ml-1 bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                  {(selectedType !== 'All Types' ? 1 : 0) + (selectedEntity !== 'All Entities' ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Collapsible Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                className="overflow-hidden"
              >
                <div className="bg-white border border-gray-100 rounded-[24px] p-6 shadow-[0_2px_12px_rgb(0,0,0,0.03)] space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Filter Options</h3>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-xs font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                        <Trash2 size={14} /> Clear All
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Type Filter */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Document Type</span>
                      <SearchableDropdown 
                         options={allTypes} 
                         value={selectedType} 
                         onChange={setSelectedType} 
                         counts={facetCounts.types} 
                         placeholder="Search Types..." 
                      />
                    </div>

                    {/* Entity Filter */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Entity</span>
                      <SearchableDropdown 
                         options={allEntities} 
                         value={selectedEntity} 
                         onChange={setSelectedEntity} 
                         counts={facetCounts.entities} 
                         placeholder="Search Entities..." 
                      />
                    </div>

                    {/* Grouping Toggle */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Time Grouping</span>
                      <div className="bg-gray-100 p-1 rounded-xl flex gap-1 h-[42px]">
                        <button 
                          onClick={() => setGroupingMode('month')}
                          className={cn(
                            "flex-1 rounded-lg text-xs font-bold transition-all",
                            groupingMode === 'month' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                          )}
                        >
                          Month
                        </button>
                        <button 
                          onClick={() => setGroupingMode('year')}
                          className={cn(
                            "flex-1 rounded-lg text-xs font-bold transition-all",
                            groupingMode === 'year' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                          )}
                        >
                          Year
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Date Filtering Panel */}
                  <div className="pt-6 border-t border-gray-100">
                    <div className="flex flex-col gap-4">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Date Filter</span>
                      <div className="flex flex-wrap items-center gap-3">
                        {(['all', 'today', '30days', '90days', 'thisYear', 'custom'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setDateFilterMode(mode)}
                            className={cn(
                              "px-4 py-2 rounded-full text-xs font-bold transition-all border",
                              dateFilterMode === mode 
                                ? "bg-blue-50 text-blue-700 border-blue-200" 
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            )}
                          >
                            {mode === 'all' ? 'All Time' : 
                             mode === 'today' ? 'Today' :
                             mode === '30days' ? 'Last 30 Days' :
                             mode === '90days' ? 'Last 90 Days' :
                             mode === 'thisYear' ? 'This Year' : 'Custom Range'}
                          </button>
                        ))}
                      </div>

                      <AnimatePresence>
                        {dateFilterMode === 'custom' && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="flex items-center gap-3 mt-2 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="flex-1 flex flex-col gap-1.5">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">From Date</span>
                                <input 
                                  type="date"
                                  value={startDate}
                                  onChange={(e) => setStartDate(e.target.value)}
                                  className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none transition-all shadow-sm"
                                />
                              </div>
                              <span className="text-gray-400 font-black text-xs uppercase mt-6">to</span>
                              <div className="flex-1 flex flex-col gap-1.5">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">To Date</span>
                                <input 
                                  type="date"
                                  value={endDate}
                                  onChange={(e) => setEndDate(e.target.value)}
                                  className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none transition-all shadow-sm"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Filter Chips */}
          {hasActiveFilters && !showFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Active:</span>
              <AnimatePresence mode="popLayout">
                {selectedType !== 'All Types' && (
                  <ActiveChip 
                    label={selectedType} 
                    icon={<FileText size={12} />} 
                    onRemove={() => setSelectedType('All Types')} 
                  />
                )}
                {selectedEntity !== 'All Entities' && (
                  <ActiveChip 
                    label={selectedEntity} 
                    icon={<User size={12} />} 
                    onRemove={() => setSelectedEntity('All Entities')} 
                  />
                )}
                {dateFilterMode !== 'all' && (
                  <ActiveChip 
                    label={
                      dateFilterMode === 'today' ? 'Today' :
                      dateFilterMode === '30days' ? 'Last 30 Days' :
                      dateFilterMode === '90days' ? 'Last 90 Days' :
                      dateFilterMode === 'thisYear' ? 'This Year' :
                      `Range: ${startDate || '?'} to ${endDate || '?'}`
                    }
                    icon={<Calendar size={12} />} 
                    onRemove={() => { setDateFilterMode('all'); setStartDate(''); setEndDate(''); }} 
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Upcoming Events Section */}
        {upcomingEvents.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-blue-500" /> Upcoming Events
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
               {upcomingEvents.map((ev, i) => (
                 <div 
                   key={i} 
                   onClick={() => setViewingDoc(ev.doc)}
                   className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl shadow-sm text-white cursor-pointer hover:-translate-y-1 transition-transform relative overflow-hidden group"
                 >
                   <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8 group-hover:scale-110 transition-transform"></div>
                   <div className="relative z-10">
                     <span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-1 block">
                       {ev.label}
                     </span>
                     <span className="text-lg font-black tracking-tight block mb-3">
                       {`${String(ev.date.getDate()).padStart(2, '0')} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][ev.date.getMonth()]} ${ev.date.getFullYear()}`}
                     </span>
                     <div className="flex items-center gap-2 text-xs font-medium text-blue-100 truncate">
                        <FileText size={12} className="shrink-0" />
                        <span className="truncate">{ev.doc.name}</span>
                     </div>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* Timeline Summary Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
           <div className="flex items-center gap-6">
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Documents</span>
                 <span className="text-xl font-black text-gray-900 leading-none">{documents.length}</span>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Visible</span>
                 <span className="text-xl font-black text-blue-600 leading-none">{filteredDocs.length}</span>
              </div>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Date Range</span>
              <span className="text-sm font-bold text-gray-700">{dateRangeString}</span>
           </div>
        </div>

        {timelineData.length === 0 ? (
          <div className="text-center py-32 bg-white border border-gray-100 rounded-[32px] shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
              <Clock size={32} />
            </div>
            {hasActiveFilters ? (
               <>
                 <p className="text-lg font-bold text-gray-900 mb-2">No documents match current filters</p>
                 <p className="text-gray-500 mb-6">Try adjusting your criteria or clearing all filters to see more results.</p>
                 <button 
                   onClick={clearFilters}
                   className="px-6 py-2.5 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-2"
                 >
                   <Trash2 size={16} /> Clear Filters
                 </button>
               </>
            ) : (
               <>
                 <p className="text-lg font-bold text-gray-900 mb-2">No documents available</p>
                 <p className="text-gray-500">Upload a document to see it in your timeline.</p>
               </>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-8 relative">
            {/* Sticky Year Navigation */}
            <aside className="hidden lg:flex flex-col gap-2 sticky top-32 w-24 shrink-0">
              {timelineData.map(({ year }) => (
                <button
                  key={`nav-${year}`}
                  onClick={() => {
                    const el = document.getElementById(`timeline-year-${year}`);
                    if (el) {
                      const y = el.getBoundingClientRect().top + window.scrollY - 100;
                      window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                  }}
                  className="text-left px-3 py-2 text-sm font-bold text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                >
                  {year}
                </button>
              ))}
            </aside>

            {/* Main Timeline View */}
            <div className="space-y-16 relative flex-1 min-w-0">
               {/* Main Year Level Timeline Line */}
               <div className="absolute left-[17px] top-4 bottom-4 w-0.5 bg-blue-100 hidden md:block" />

               {timelineData.map(({ year, subGroups, insights }) => (
                  <div key={year} id={`timeline-year-${year}`} className="relative scroll-mt-24">
                     {/* Year Header & Insights */}
                     <div className="flex flex-col gap-3 mb-12 relative z-10">
                        <div className="flex items-center gap-6">
                          <div className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 ring-4 ring-blue-50 shrink-0 transition-transform group-hover:scale-110">
                             <Calendar size={16} />
                          </div>
                          <h2 className="text-2xl font-black text-gray-900 tracking-tighter">
                             {year}
                          </h2>
                          <div className="h-px bg-blue-50 flex-1 hidden md:block" />
                        </div>
                        
                        {/* Timeline Insights */}
                        {(insights.totalDocs > 0 || insights.totalAmount > 0 || insights.renewals > 0) && year !== "Unknown Date" && (
                           <div className="ml-16 flex flex-wrap items-center gap-4">
                              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                                {insights.totalDocs} Documents
                              </span>
                              {insights.totalAmount > 0 && (
                                <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                                  ₹{insights.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Billed
                                </span>
                              )}
                              {insights.renewals > 0 && (
                                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-md border border-purple-200">
                                  {insights.renewals} Renewals
                                </span>
                              )}
                           </div>
                        )}
                     </div>

                     <div className="space-y-12">
                      {subGroups.map(([monthLabel, docs]) => (
                         <div key={monthLabel} className="relative pl-12 md:pl-16">
                            {/* Month Node */}
                            <div className="absolute left-[13px] md:left-[13px] top-1.5 w-2.5 h-2.5 bg-blue-600 rounded-full z-10 ring-4 ring-white shadow-md">
                               <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20"></div>
                            </div>
                            
                            {/* Connecting Line from Month to Doc (Horizontal Branch) */}
                            <div className="absolute left-[17px] top-[10px] w-8 h-0.5 bg-blue-100 hidden md:block" />

                            {groupingMode === 'month' && (
                               <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-6">
                                  {monthLabel.replace(` ${year}`, '')}
                               </h3>
                            )}

                            <div className="space-y-4">
                               {docs.map(doc => (
                                 <motion.div
                                   key={doc._id}
                                   initial={{ opacity: 0, x: -10 }}
                                   whileInView={{ opacity: 1, x: 0 }}
                                   viewport={{ once: true }}
                                   whileHover={{ x: 4 }}
                                   onClick={() => setViewingDoc(doc)}
                                   className="group bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer flex gap-5 items-start relative"
                                 >
                                   <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                                     {doc.mimeType?.startsWith('image/') && doc.previewUrl ? (
                                       <img src={doc.previewUrl} className="w-full h-full object-cover rounded-lg" alt="" />
                                     ) : (
                                       <FileText className="text-gray-400 group-hover:text-blue-500" size={24} />
                                     )}
                                   </div>

                                   <div className="flex-1 min-w-0">
                                     <div className="flex items-center justify-between mb-1">
                                       <h3 className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                         {doc.name}
                                       </h3>
                                       <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                     </div>
                                     
                                     <div className="flex items-center gap-3 text-xs font-bold mb-3">
                                       <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-tight">
                                         {doc.docType || 'Document'}
                                       </span>
                                       <span className="text-gray-400 flex items-center gap-1">
                                         <User size={12} />
                                         {(doc.entities || []).join(', ') || 'N/A'}
                                       </span>
                                     </div>

                                     {doc.metadata?.aiSummary && (
                                       <p className="text-sm text-gray-500 leading-relaxed line-clamp-1">
                                         {doc.metadata.aiSummary}
                                       </p>
                                     )}
                                   </div>
                                 </motion.div>
                               ))}
                            </div>
                         </div>
                      ))}
                   </div>
                   </div>
                   ))}
                   </div>
                   </div>
                   )}
                   </main>

                   {/* Reusing existing Modal UI from Archive/TreeView/EntityView */}
      <AnimatePresence>
        {viewingDoc && (
           <motion.div 
             initial={{ opacity: 0 }} 
             animate={{ opacity: 1 }} 
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
             onClick={() => setViewingDoc(null)}
           >
             <motion.div 
               initial={{ y: 20, scale: 0.95 }}
               animate={{ y: 0, scale: 1 }}
               exit={{ y: 20, scale: 0.95 }}
               onClick={(e) => e.stopPropagation()}
               className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-full overflow-hidden flex flex-col md:flex-row relative"
             >
               <button onClick={() => setViewingDoc(null)} className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-gray-800 hover:bg-white shadow-sm border border-gray-100 transition-colors">
                  <X size={20} />
               </button>
               <button onClick={() => setShareDoc(viewingDoc)} className="absolute top-4 right-16 z-10 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-gray-800 hover:bg-white shadow-sm border border-gray-100 transition-colors">
                  <Share2 size={18} />
               </button>

                <div className="w-full md:w-1/2 bg-gray-50 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 relative min-h-[300px] md:min-h-[500px]">
                  {viewingDoc.status === 'NEEDS_PASSWORD' || viewingDoc.status === 'UNLOCK_FAILED' ? (
                    <div className="flex flex-col items-center justify-center text-red-500 p-8 text-center">
                       <Lock size={48} className="mb-4 text-red-400" />
                       <p className="font-bold text-gray-700 text-sm">Document Encrypted</p>
                       <p className="text-xs text-gray-400 max-w-[220px] mt-1">Please enter password on the right to decrypt and view document.</p>
                    </div>
                  ) : viewingDoc.previewUrl && (!viewingDoc.mimeType || viewingDoc.mimeType.startsWith('image/')) ? (
                    <img src={viewingDoc.previewUrl} className="w-full h-full object-contain max-h-[70vh] p-4" alt="" />
                  ) : viewingDoc.previewUrl && viewingDoc.mimeType === 'application/pdf' ? (
                    <object data={viewingDoc.previewUrl} type="application/pdf" className="w-full h-full min-h-[500px] border-none">
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                         <FileText size={48} className="mb-4" />
                         <p className="text-sm">Cannot preview PDF in this browser. <a href={viewingDoc.previewUrl} download className="text-blue-500 underline">Download</a> to view.</p>
                      </div>
                    </object>
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                       <FileText size={48} className="mb-4" />
                       <p className="font-medium text-gray-600 truncate max-w-[200px]">{viewingDoc.name}</p>
                    </div>
                  )}
                </div>
                
                <div className="w-full md:w-1/2 p-8 md:p-10 overflow-y-auto max-h-[50vh] md:max-h-[80vh] break-words">
                   <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-6 pr-8 break-words">{viewingDoc.name}</h2>
                   
                   {/* Decryption/Analysis Actions inside Viewer Modal */}
                   {(viewingDoc.status === 'NEEDS_PASSWORD' || viewingDoc.status === 'UNLOCK_FAILED') && (
                     <div className="mb-6 p-4 bg-red-50/80 rounded-[16px] border border-red-100 flex flex-col gap-2">
                       <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                         <Lock size={12} className="text-red-500" />
                         <span>Password Protected PDF</span>
                       </div>
                       <p className="text-[11px] text-red-500 leading-normal">This document is encrypted. Decryption is required before preview or analysis.</p>
                       {modalErrorMsg && <p className="text-[11px] font-medium text-red-700">{modalErrorMsg}</p>}
                       <div className="flex gap-2">
                         <input 
                           type="password"
                           placeholder="Password..."
                           value={modalPassword}
                           onChange={e => setModalPassword(e.target.value)}
                           disabled={modalIsDecrypting}
                           className="flex-1 px-3 py-1.5 border border-red-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
                         />
                         <button 
                           onClick={() => handleModalDecrypt(viewingDoc._id)}
                           disabled={modalIsDecrypting || !modalPassword.trim()}
                           className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95 flex items-center gap-1"
                         >
                           {modalIsDecrypting ? 'Unlocking...' : 'Decrypt'}
                         </button>
                       </div>
                     </div>
                   )}

                   {viewingDoc.status === 'DECRYPTED' && (
                     <div className="mb-6 p-4 bg-blue-50/70 rounded-[16px] border border-blue-100/50 flex flex-col gap-2">
                       <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                         <Unlock size={12} className="text-blue-500" />
                         <span>Decrypted & Ready</span>
                       </div>
                       <p className="text-[11px] text-blue-500 leading-normal">Manual decryption succeeded. Verify preview on left, then start AI analysis.</p>
                       {modalErrorMsg && <p className="text-[11px] font-medium text-red-700">{modalErrorMsg}</p>}
                       <button 
                         onClick={() => handleModalAnalyze(viewingDoc._id)}
                         disabled={modalIsProcessing}
                         className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-blue-500/10"
                       >
                         {modalIsProcessing ? 'Analyzing...' : 'Analyze Document'}
                       </button>
                     </div>
                   )}

                   {viewingDoc.status === 'PROCESSING' && (
                     <div className="mb-6 p-4 bg-gray-50 rounded-[16px] border border-gray-100 flex items-center justify-between">
                       <div className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-wider animate-pulse">
                         <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
                         <span>Analyzing...</span>
                       </div>
                       <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                     </div>
                   )}
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Entity / Subject</span>
                        <span className="font-medium text-gray-900">{(viewingDoc.entities || []).join(', ') || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Document Type</span>
                        <span className="font-medium text-gray-900">{viewingDoc.docType || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Category</span>
                        <span className="font-medium text-gray-900">{viewingDoc.folder}</span>
                      </div>
                      <div>
                        <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Uploaded On</span>
                        <span className="font-medium text-gray-900">{viewingDoc.date}</span>
                      </div>
                    </div>

                    {viewingDoc.metadata?.aiSummary && (
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <span className="block text-sm font-bold text-gray-800 mb-2">AI Summary</span>
                        <p className="text-sm text-gray-600 leading-relaxed">{viewingDoc.metadata.aiSummary}</p>
                      </div>
                    )}

                    {viewingDoc.metadata && Object.keys(viewingDoc.metadata).length > 0 && Object.values(viewingDoc.metadata).some(isValidMetadata) && (
                      <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50">
                        <span className="block text-sm font-bold text-gray-800 mb-3">Extracted Details</span>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(viewingDoc.metadata).map(([key, val]) => (isValidMetadata(val) && !['summaryFields', 'aiSummary', 'aiCategory', 'aiTags', 'aiEntities', 'folder', 'processingDiagnostics', 'aiStatus', 'ocrStatus'].includes(key)) ? (
                             <div key={key}>
                                <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className="font-medium text-gray-900">{typeof val === 'object' ? JSON.stringify(val) : val}</span>
                             </div>
                          ) : null)}
                        </div>
                      </div>
                    )}

                    {viewingDoc.metadata?.summaryFields && Object.keys(viewingDoc.metadata.summaryFields).length > 0 && (
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <span className="block text-sm font-bold text-gray-800 mb-3">Summary Fields</span>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(viewingDoc.metadata.summaryFields).map(([key, val]) => (
                            <div key={key}>
                              <span className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{key}</span>
                              <span className="font-medium text-gray-900 block">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {viewingDoc.tags && viewingDoc.tags.length > 0 && (
                      <div>
                        <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Tags</span>
                        <div className="flex flex-wrap gap-2">
                           {viewingDoc.tags.map(t => (
                             <span key={t} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200">
                               #{t}
                             </span>
                           ))}
                        </div>
                      </div>
                    )}
                  </div>
               </div>
             </motion.div>
           </motion.div>
        )}
      </AnimatePresence>
      <ShareModal 
        isOpen={!!shareDoc} 
        onClose={() => setShareDoc(null)} 
        document={shareDoc} 
      />
    </div>
  );
}
