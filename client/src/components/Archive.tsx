import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Document } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, FolderOpen, FileText, Calendar, Search, LogOut, Tag as TagIcon, X, User, Check, SlidersHorizontal, Trash2, Share2, LayoutGrid, List } from 'lucide-react';
import { cn, isValidMetadata } from '../lib/utils';
import { TopNav } from './TopNav';
import { shareDocument } from '../lib/shareUtils';

export function Archive() {
  const { documents, goToUpload, logout } = useApp();
  
  // Facet State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [selectedDocTypes, setSelectedDocTypes] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Viewer state
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  // Mobile sidebar toggle - NOW USED FOR DESKTOP TOO (hidden by default)
  const [showFilters, setShowFilters] = useState(false);

  // Omnisearch logic
  const searchedDocs = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    
    const tokens = searchQuery.toLowerCase().split(' ').filter(t => t.trim().length > 0);
    return documents.filter(doc => {
      const docText = `${doc.name} ${doc.folder} ${(doc.entities || []).join(' ')} ${doc.docType || ''} ${(doc.tags || []).join(' ')}`.toLowerCase();
      // Returns true if EVERY search token is found
      return tokens.every(token => docText.includes(token));
    });
  }, [documents, searchQuery]);

  // Faceted filtering
  const filteredDocs = useMemo(() => {
    return searchedDocs.filter(doc => {
      let folderMatch = selectedFolders.size === 0 || selectedFolders.has(doc.folder);
      let docEntities = doc.entities && doc.entities.length > 0 ? doc.entities : ['General'];
      let entityMatch = selectedEntities.size === 0 || docEntities.some(e => selectedEntities.has(e));
      let typeMatch = selectedDocTypes.size === 0 || selectedDocTypes.has(doc.docType || 'Document');
      let tagsMatch = selectedTags.size === 0 || (doc.tags || []).some(t => selectedTags.has(t));
      
      return folderMatch && entityMatch && typeMatch && tagsMatch;
    });
  }, [searchedDocs, selectedFolders, selectedEntities, selectedDocTypes, selectedTags]);

  // Base list of terms for UI
  const allEntities = useMemo(() => Array.from(new Set(documents.flatMap(d => d.entities && d.entities.length > 0 ? d.entities : ['General']))).sort(), [documents]);
  const allFolders = useMemo(() => Array.from(new Set(documents.map(d => d.folder))).sort(), [documents]);
  const allDocTypes = useMemo(() => Array.from(new Set(documents.map(d => d.docType || 'Document'))).sort(), [documents]);
  const allTags = useMemo(() => {
    const s = new Set<string>();
    documents.forEach(d => d.tags.forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [documents]);

  // Facet Counters (how many docs have this attribute inside current searched space)
  const facetCounts = useMemo(() => {
    const counts = { folders: {} as Record<string, number>, entities: {} as Record<string, number>, docTypes: {} as Record<string, number>, tags: {} as Record<string, number> };
    searchedDocs.forEach(doc => {
      counts.folders[doc.folder] = (counts.folders[doc.folder] || 0) + 1;
      let docEntities = doc.entities && doc.entities.length > 0 ? doc.entities : ['General'];
      docEntities.forEach(ent => {
        counts.entities[ent] = (counts.entities[ent] || 0) + 1;
      });
      const type = doc.docType || 'Document';
      counts.docTypes[type] = (counts.docTypes[type] || 0) + 1;
      (doc.tags || []).forEach(t => {
        counts.tags[t] = (counts.tags[t] || 0) + 1;
      });
    });
    return counts;
  }, [searchedDocs]);

  // Master toggler
  function toggleSet<T>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T, forceAdd = false) {
      setter(prev => {
        const next = new Set(prev);
        if (forceAdd) {
           next.add(value);
        } else {
           if (next.has(value)) next.delete(value);
           else next.add(value);
        }
        return next;
      });
  }

  const clearAllFilters = () => {
    setSelectedFolders(new Set());
    setSelectedEntities(new Set());
    setSelectedDocTypes(new Set());
    setSelectedTags(new Set());
    setSearchQuery('');
  };

  const hasActiveFilters = selectedFolders.size > 0 || selectedEntities.size > 0 || selectedDocTypes.size > 0 || selectedTags.size > 0 || searchQuery !== '';

  return (
    <div className="min-h-screen bg-[#fafafc] text-gray-900 font-sans pb-24 relative flex flex-col items-center">
      <TopNav activeTab="archive" />

      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row gap-8 items-start">
         
         {/* Filter Toggle */}
         {!showFilters && (
           <div 
             className="w-full max-w-4xl mx-auto md:w-auto md:absolute md:left-4 md:top-24 flex md:flex-col items-center justify-between md:justify-center bg-white p-4 md:p-3 rounded-[16px] border border-gray-200 shadow-sm cursor-pointer z-40" 
             onClick={() => setShowFilters(true)}
           >
             <div className="flex md:flex-col items-center gap-2 text-gray-600">
               <SlidersHorizontal size={18}/> 
               <span className="font-semibold md:hidden">Search & Filters</span>
               <span className="font-bold text-[10px] uppercase tracking-wider hidden md:block rotate-180" style={{ writingMode: 'vertical-rl' }}>Filters</span>
             </div>
             {hasActiveFilters && <span className="bg-blue-600 text-white px-2 py-0.5 md:mt-3 rounded-full text-xs font-bold">{selectedFolders.size + selectedEntities.size + selectedDocTypes.size + selectedTags.size + (searchQuery ? 1 : 0)}</span>}
           </div>
         )}

         {/* Left Sidebar Facets */}
         <aside className={cn("w-full md:w-64 xl:w-72 shrink-0 space-y-8 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide box-border pr-2", showFilters ? "block" : "hidden")}>
            <div className="space-y-6 bg-white p-5 rounded-[20px] border border-gray-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] relative">
               <button 
                 onClick={() => setShowFilters(false)} 
                 className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 md:hidden"
               >
                 <X size={18} />
               </button>
               <div className="flex items-center justify-between mb-2">
                 <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-900 hidden md:block">
                      <ChevronLeft size={20} className="-ml-2" />
                    </button>
                    Filters
                 </h2>
                 {hasActiveFilters && (
                   <button onClick={clearAllFilters} className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                     <Trash2 size={12}/> Clear
                   </button>
                 )}
               </div>

               {/* Entities */}
               <CollapsibleSection title="Entities & People">
                 {allEntities.map(ent => {
                   const count = facetCounts.entities[ent] || 0;
                   if (count === 0 && !selectedEntities.has(ent)) return null;
                   return (
                     <FacetCheckbox 
                       key={ent} 
                       label={ent} 
                       count={count} 
                       checked={selectedEntities.has(ent)} 
                       onChange={() => toggleSet(setSelectedEntities, ent)} 
                     />
                   )
                 })}
               </CollapsibleSection>

               <hr className="border-gray-100" />

               {/* Folders/Categories */}
               <CollapsibleSection title="Categories">
                 {allFolders.map(cat => {
                   const count = facetCounts.folders[cat] || 0;
                   if (count === 0 && !selectedFolders.has(cat)) return null;
                   return (
                     <FacetCheckbox 
                       key={cat} 
                       label={cat} 
                       count={count} 
                       checked={selectedFolders.has(cat)} 
                       onChange={() => toggleSet(setSelectedFolders, cat)} 
                     />
                   )
                 })}
               </CollapsibleSection>

               <hr className="border-gray-100" />

               {/* Document Types */}
               {allDocTypes.length > 0 && (
                 <>
                   <CollapsibleSection title="Document Type">
                     {allDocTypes.map(type => {
                       const count = facetCounts.docTypes[type] || 0;
                       if (count === 0 && !selectedDocTypes.has(type)) return null;
                       return (
                         <FacetCheckbox 
                           key={type} 
                           label={type} 
                           count={count} 
                           checked={selectedDocTypes.has(type)} 
                           onChange={() => toggleSet(setSelectedDocTypes, type)} 
                         />
                       )
                     })}
                   </CollapsibleSection>
                   <hr className="border-gray-100" />
                 </>
               )}

               {/* Tags */}
               <CollapsibleSection title="Tags">
                 {allTags.map(tag => {
                   const count = facetCounts.tags[tag] || 0;
                   if (count === 0 && !selectedTags.has(tag)) return null;
                   return (
                     <FacetCheckbox 
                       key={tag} 
                       label={`#${tag}`} 
                       count={count} 
                       checked={selectedTags.has(tag)} 
                       onChange={() => toggleSet(setSelectedTags, tag)} 
                     />
                   )
                 })}
               </CollapsibleSection>

            </div>
         </aside>

         {/* Main Content Grid */}
         <div className={cn("flex-1 w-full min-w-0 flex flex-col mt-4 md:mt-0 transition-all duration-300", showFilters ? "md:max-w-[calc(100%-18rem)]" : "md:ml-16 max-w-5xl mx-auto")}>
            {/* Context/Search Bar */}
            <div className="mb-8 relative z-20">
              <div className="relative flex items-center w-full max-w-4xl mx-auto md:mx-0 group">
                <Search size={22} className="absolute left-6 text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                <input 
                   type="text" 
                   placeholder="Search globally across all clusters..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full bg-white border border-gray-100 hover:border-gray-200 rounded-[24px] py-5 pl-16 pr-12 text-lg font-medium focus:outline-none focus:ring-[6px] focus:ring-blue-500/5 focus:border-blue-500 transition-all text-gray-900 shadow-sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-6 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-1.5 rounded-full transition-all">
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
               <div className="flex flex-wrap items-center gap-2 mb-6 p-4 bg-gray-100/50 rounded-[16px] border border-gray-100 border-dashed">
                 <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mr-2 flex items-center gap-1.5"><SlidersHorizontal size={14}/> Active</span>
                 
                 <AnimatePresence>
                   {Array.from<string>(selectedEntities).map(val => (
                     <ActiveChip key={`ent-${val}`} label={val} icon={<User size={12}/>} onRemove={() => toggleSet(setSelectedEntities, val)} />
                   ))}
                   {Array.from<string>(selectedFolders).map(val => (
                     <ActiveChip key={`fol-${val}`} label={val} icon={<FolderOpen size={12}/>} onRemove={() => toggleSet(setSelectedFolders, val)} />
                   ))}
                   {Array.from<string>(selectedDocTypes).map(val => (
                     <ActiveChip key={`typ-${val}`} label={val} icon={<FileText size={12}/>} onRemove={() => toggleSet(setSelectedDocTypes, val)} />
                   ))}
                   {Array.from<string>(selectedTags).map(val => (
                     <ActiveChip key={`tag-${val}`} label={`#${val}`} onRemove={() => toggleSet(setSelectedTags, val)} />
                   ))}
                 </AnimatePresence>
               </div>
            )}

            {/* Header Data */}
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-xl font-bold tracking-tight text-gray-800">
                  Search & Discovery — {filteredDocs.length} Results
               </h3>
               <span className="text-sm font-medium text-gray-400">Sorted by Auto-Relevance</span>
            </div>

            {/* Main Grid */}
            {filteredDocs.length === 0 ? (
                <div className="text-center py-32 flex flex-col items-center flex-1 bg-white border border-gray-100 rounded-[24px]">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                      <Search size={32} />
                    </div>
                    <p className="text-lg font-medium text-gray-900 mb-2">No exact matches found</p>
                    <p className="text-gray-500">Try adjusting your filters or expanding your search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                  <AnimatePresence>
                    {filteredDocs.map(doc => (
                      <motion.div key={doc.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}>
                        <DocCard 
                          doc={doc} 
                          onTagClick={(t) => toggleSet(setSelectedTags, t, true)}
                          onEntityClick={(e) => toggleSet(setSelectedEntities, e, true)}
                          onFolderClick={(f) => toggleSet(setSelectedFolders, f as string, true)}
                          onView={() => setViewingDoc(doc)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
            )}
         </div>

      </main>

      {/* Floating Action Button */}
      <button 
         onClick={goToUpload}
         className="fixed bottom-8 right-8 w-16 h-16 bg-gray-900 hover:bg-black text-white rounded-2xl shadow-xl hover:shadow-2xl flex items-center justify-center transition-all active:scale-95 z-50 group border border-gray-700 hover:border-gray-600"
      >
        <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>

      {/* Document Viewer Modal */}
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
               <button onClick={() => shareDocument(viewingDoc)} className="absolute top-4 right-16 z-10 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-gray-800 hover:bg-white shadow-sm border border-gray-100 transition-colors">
                  <Share2 size={18} />
               </button>

               <div className="w-full md:w-1/2 bg-gray-50 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 relative min-h-[300px] md:min-h-[500px]">
                 {viewingDoc.previewUrl && (!viewingDoc.mimeType || viewingDoc.mimeType.startsWith('image/')) ? (
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
               
               <div className="w-full md:w-1/2 p-8 md:p-10 overflow-y-auto max-h-[50vh] md:max-h-[80vh]">
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-6 pr-8">{viewingDoc.name}</h2>
                  
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

                    {viewingDoc.metadata && Object.keys(viewingDoc.metadata).length > 0 && Object.values(viewingDoc.metadata).some(isValidMetadata) && (
                      <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50">
                        <span className="block text-sm font-bold text-gray-800 mb-3">Extracted Details</span>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(viewingDoc.metadata).map(([key, val]) => isValidMetadata(val) ? (
                             <div key={key}>
                                <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className="font-medium text-gray-900">{val}</span>
                             </div>
                          ) : null)}
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
    </div>
  );
}

// Collapsible Section
const CollapsibleSection: React.FC<{ title: string, children: React.ReactNode, defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3">
      <h3 
        className="text-xs font-bold uppercase tracking-wider text-gray-400 flex justify-between items-center cursor-pointer select-none group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <ChevronRight size={14} className={cn("transition-transform group-hover:text-gray-600", isOpen ? "rotate-90" : "rotate-0")} />
      </h3>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-1 max-h-48 overflow-y-auto pt-1 pb-2 scrollbar-hide">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Facet Checkbox Item
const FacetCheckbox: React.FC<{ label: string, count: number, checked: boolean, onChange: () => void }> = ({ label, count, checked, onChange }) => (
  <div onClick={onChange} className="flex items-center justify-between group cursor-pointer py-1.5 pr-2">
     <div className="flex items-center gap-3">
       <div className={cn("w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0", checked ? "bg-black border-black text-white" : "border-gray-300 group-hover:border-gray-500 bg-white")}>
         {checked && <Check size={12} strokeWidth={4} />}
       </div>
       <span className={cn("text-[13px] font-medium transition-colors truncate max-w-[140px]", checked ? "text-gray-900" : "text-gray-600 group-hover:text-gray-900")}>{label}</span>
     </div>
     <span className="text-[11px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded">{count}</span>
  </div>
);

// Active Chip
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

// Reusable Document Card Component
const DocCard: React.FC<{ 
  doc: Document, 
  onTagClick: (tag: string) => void,
  onEntityClick: (entity: string) => void,
  onFolderClick: (folder: string) => void,
  onView: () => void
}> = ({ doc, onTagClick, onEntityClick, onFolderClick, onView }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-[20px] shadow-[0_2px_8px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgb(0,0,0,0.06)] hover:border-gray-300 transition-all group flex flex-col justify-between p-5 h-full cursor-pointer relative" onClick={onView}>
      
      {/* Share Button Overlay */}
      <button 
        onClick={(e) => { e.stopPropagation(); shareDocument(doc); }}
        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-gray-100 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-50 text-gray-500 hover:text-gray-800"
      >
        <Share2 size={14} />
      </button>

      {/* Top Section */}
      <div className="flex items-start gap-4 mb-4">
        {doc.previewUrl && (!doc.mimeType || doc.mimeType.startsWith('image/')) ? (
           <div className="w-14 h-14 bg-gray-50 rounded-[14px] overflow-hidden shrink-0 border border-gray-100 shadow-sm">
             <img src={doc.previewUrl} className="w-full h-full object-cover" alt="" />
           </div>
        ) : doc.previewUrl && doc.mimeType === 'application/pdf' ? (
           <div className="w-14 h-14 bg-gray-50 rounded-[14px] overflow-hidden shrink-0 border border-gray-100 shadow-sm relative pointer-events-none">
             <object data={doc.previewUrl + '#toolbar=0&navpanes=0&scrollbar=0'} type="application/pdf" className="w-[400px] h-[400px] absolute top-[-100px] left-[-100px] origin-[30%_30%] scale-[0.15]">
               <div className="w-full h-full flex items-center justify-center text-red-500">
                 <FileText size={24} />
               </div>
             </object>
             <span className="absolute bottom-1 right-1 text-[8px] font-black uppercase text-red-600 bg-white/90 border border-red-100 rounded px-1">PDF</span>
           </div>
        ) : (
           <div className="w-14 h-14 rounded-[14px] flex items-center justify-center text-gray-500 shrink-0 bg-gray-50 border border-gray-100 shadow-sm">
              <FileText size={24} />
           </div>
        )}
        <div className="flex-1 min-w-0 pt-0.5">
           <h4 className="font-bold text-gray-900 text-[15px] truncate group-hover:text-blue-600 transition-colors mb-2">{doc.name}</h4>
           
           <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
             <div className="flex items-center gap-2">
               {doc.entities && doc.entities.map(ent => (
                 <button key={ent} onClick={() => onEntityClick(ent)} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100 hover:scale-105 transition-all">
                    <User size={10} strokeWidth={2.5}/> {ent}
                 </button>
               ))}
               <button onClick={() => onFolderClick(doc.folder)} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 hover:scale-105 transition-all">
                  <FolderOpen size={10} strokeWidth={2.5} /> {doc.folder}
               </button>
             </div>
             
             <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium pl-1 mt-1">
               <Calendar size={12} className="text-gray-300" /> Uploaded {doc.date}
             </span>
           </div>
        </div>
      </div>
      
      {/* Metadata Section */}
      {doc.metadata && Object.keys(doc.metadata).length > 0 && Object.values(doc.metadata).some(isValidMetadata) && (
        <div className="bg-gray-50 rounded-xl p-3 mb-4 grid grid-cols-2 gap-2 mt-auto">
           {Object.entries(doc.metadata).map(([key, val]) => isValidMetadata(val) ? (
             <div key={key}>
               <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
               <span className="block text-[11px] font-semibold text-gray-700 truncate">{val}</span>
             </div>
           ) : null)}
        </div>
      )}

      {/* Tags Section */}
      {doc.tags && doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-100 mt-auto" onClick={e => e.stopPropagation()}>
          {doc.tags.map(tag => {
            const isUrgent = tag.toLowerCase().includes('expire') || tag.toLowerCase().includes('renew') || tag.toLowerCase().includes('due');
            return (
              <button 
                key={tag} 
                onClick={() => onTagClick(tag)}
                className={cn(
                  "px-2 py-1 rounded-[6px] font-semibold hover:scale-[1.03] transition-all flex items-center gap-1",
                  "text-[10px]",
                  isUrgent 
                    ? "bg-red-50/80 text-red-600 border border-red-100 hover:bg-red-100" 
                    : "bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <TagIcon size={10} /> {tag}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
