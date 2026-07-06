import React, {
  useState,
  useMemo,
  useEffect,
} from 'react';
import { useApp } from '../context/AppContext';
import { Document } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, FolderOpen, FileText, Calendar, Search, LogOut, Tag as TagIcon, X, User, Check, SlidersHorizontal, Trash2, Share2, LayoutGrid, List, Sparkles, Lock, Unlock } from 'lucide-react';
import { cn, isValidMetadata } from '../lib/utils';
import { TopNav } from './TopNav';
import { ShareModal } from './ShareModal';
import { DocumentCard } from './DocumentCard';
import { decryptDocument, processDocument } from '../services/documentApi';
import { mapApiDocumentToDocument } from '../utils/documentMapper';
import { RECOMMENDED_DOCS } from '../constants';

export function Archive() {
  const {
    documents,
    goToUpload,
    logout,
    fetchLiveDocuments,
    targetArchiveDocId,
    targetArchiveDocType,
    clearArchiveContext
  } = useApp();
  
  // Facet State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [selectedDocTypes, setSelectedDocTypes] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Viewer state
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

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

  // Share Modal State
  const [shareDoc, setShareDoc] = useState<Document | null>(null);

  // Mobile sidebar toggle - NOW USED FOR DESKTOP TOO (hidden by default)
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    fetchLiveDocuments();
  }, []);

  // Helper for recommendation matching
  const matchesRecommendation = (doc: Document, tagsMatch: string[]) => {
    const nameText = (doc.name || '').toLowerCase();
    const origText = (doc.originalName || '').toLowerCase();
    const docTypeText = (doc.docType || '').toLowerCase();
    const vaultCatText = (doc.vaultCategory || '').toLowerCase();
    const tagsText = (doc.tags || []).map(t => t.toLowerCase()).join(' ');
    const combinedText = `${nameText} ${origText} ${docTypeText} ${vaultCatText} ${tagsText}`;

    return tagsMatch.some(tm => combinedText.includes(tm.toLowerCase()));
  };

  // Support contextual navigation for specific document ID (Phase 1)
  useEffect(() => {
    if (targetArchiveDocId) {
      const doc = documents.find(d => d._id === targetArchiveDocId);
      if (doc) {
        // Expand card details
        setExpandedDocId(targetArchiveDocId);
        
        // Scroll card smoothly into center viewport
        setTimeout(() => {
          const element = document.getElementById(`doc-card-${targetArchiveDocId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-2', 'ring-blue-500/50', 'bg-blue-50/30');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-blue-500/50', 'bg-blue-50/30');
            }, 2500);
          }
        }, 200);
      }
      clearArchiveContext();
    }
  }, [targetArchiveDocId, documents]);

  // Support contextual navigation for recommended doc types (Phase 2 / Phase 5)
  useEffect(() => {
    if (targetArchiveDocType) {
      const recommended = RECOMMENDED_DOCS.find(r => r.id === targetArchiveDocType);
      if (recommended) {
        const matches = documents.filter(doc => matchesRecommendation(doc, recommended.tagsMatch));
        
        // If exactly 1 matching document exists, expand and scroll to it
        if (matches.length === 1) {
          const targetDocId = matches[0]._id;
          setExpandedDocId(targetDocId);
          
          setTimeout(() => {
            const element = document.getElementById(`doc-card-${targetDocId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.classList.add('ring-2', 'ring-blue-500/50', 'bg-blue-50/30');
              setTimeout(() => {
                element.classList.remove('ring-2', 'ring-blue-500/50', 'bg-blue-50/30');
              }, 2500);
            }
          }, 200);
        }
      }
      clearArchiveContext();
    }
  }, [targetArchiveDocType, documents]);

  // Omnisearch logic
  const searchedDocs = useMemo(() => {
    let sourceDocs = documents;

    // Apply contextual recommendation filter if requested (Phase 2 Uploaded Shortcut)
    if (targetArchiveDocType) {
      const recommended = RECOMMENDED_DOCS.find(r => r.id === targetArchiveDocType);
      if (recommended) {
        sourceDocs = documents.filter(doc => matchesRecommendation(doc, recommended.tagsMatch));
      }
    }

    if (!searchQuery.trim()) return sourceDocs;

    const tokens = searchQuery.toLowerCase().split(' ').filter(t => t.trim().length > 0);
    return sourceDocs.filter(doc => {
      const docText = `${doc.name} ${doc.folder} ${(doc.entities || []).join(' ')} ${doc.docType || ''} ${(doc.tags || []).join(' ')} ${doc.extractedText || ''}`.toLowerCase();
      // Returns true if EVERY search token is found
      return tokens.every(token => docText.includes(token));
    });
  }, [documents, searchQuery, targetArchiveDocType]);

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
    documents.forEach(d => {
    (d.tags || []).forEach(t => s.add(t));
    });
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
                  <AnimatePresence mode="sync">
                    {filteredDocs.map(doc => (
                      <motion.div key={doc._id} id={`doc-card-${doc._id}`} className="transition-all duration-300 rounded-[28px]" layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}>
                        <DocumentCard
                          doc={doc}
                          isExpanded={!!doc._id && expandedDocId === doc._id}
                          onToggleExpand={() => {
                            console.log("CARD CLICK", doc._id);
                            doc._id && setExpandedDocId(expandedDocId === doc._id ? null : doc._id);
                          }}
                          onTagClick={(t) => toggleSet(setSelectedTags, t, true)}
                          onEntityClick={(e) => toggleSet(setSelectedEntities, e, true)}
                          onFolderClick={(f) => toggleSet(setSelectedFolders, f as string, true)}
                          onView={() => {
                          console.log("CLICKED DOC", doc);
                          setViewingDoc(doc);
                          }}
                          onShare={setShareDoc}
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

                    {viewingDoc.metadata && Object.keys(viewingDoc.metadata).length > 0 && Object.values(viewingDoc.metadata).some(isValidMetadata) && (
                      <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50">
                        <span className="block text-sm font-bold text-gray-800 mb-3">Extracted Details</span>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(viewingDoc.metadata).map(([key, val]) => (isValidMetadata(val) && key !== 'summaryFields') ? (
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
