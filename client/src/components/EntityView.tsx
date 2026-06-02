import React, { useMemo, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { TopNav } from './TopNav';
import { Document, FOLDER_TEMPLATES, ALL_FOLDERS } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Folder, User, FileText, Calendar, X, Share2, Plus, Sparkles } from 'lucide-react';
import { cn, isValidMetadata } from '../lib/utils';
import { uploadDocument, processDocument } from '../services/documentApi';
import { shareDocument } from '../lib/shareUtils';

export function EntityView() {
  const { documents, customFolders, goToUpload, setPendingDocument, fetchLiveDocuments } = useApp();

  // state to track expanded categories and entities
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetEntityAndFolder, setTargetEntityAndFolder] = useState<{entity: string, folder: string} | null>(null);

  const handleAddDirect = (entity: string, folder: string) => {
     setTargetEntityAndFolder({ entity, folder });
     if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset input
        fileInputRef.current.click();
     }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && targetEntityAndFolder) {
      const reader = new FileReader();
      reader.onloadend = async () => {
         const base64Data = reader.result as string;
         setIsAnalyzing(true);
         try {
           // 1. Upload
           const uploadedDoc = await uploadDocument(file);
           
           // 2. Process
           const aiResult = await processDocument(uploadedDoc._id);
           
           // Refresh list
           await fetchLiveDocuments();

           setPendingDocument({
              file,
              base64Data,
              mimeType: file.type,
              aiResult: {
                ...aiResult,
                docType: targetEntityAndFolder.folder,
                entities: [targetEntityAndFolder.entity]
              }
           });
         } catch (error) {
           console.error("Analysis failed", error);
           // Fallback to manual entry
           setPendingDocument({
              file,
              base64Data,
              mimeType: file.type,
              aiResult: {
                 _id: '',
                 originalName: file.name,
                 mimeType: file.type,
                 status: 'FAILED',
                 entities: [targetEntityAndFolder.entity],
                 docType: targetEntityAndFolder.folder,
                 tags: [],
                 confidence: 'LOW',
                 metadata: {}
              } as any
           });
           goToUpload();
         } finally {
           setIsAnalyzing(false);
         }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleEntity = (ent: string) => {
    setExpandedEntities(prev => {
      const copy = new Set(prev);
      if(copy.has(ent)) copy.delete(ent);
      else copy.add(ent);
      return copy;
    });
  };

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders(prev => {
      const copy = new Set(prev);
      if(copy.has(folderKey)) copy.delete(folderKey);
      else copy.add(folderKey);
      return copy;
    });
  };

  const treeData = useMemo(() => {
    const rootMap = new Map<string, Map<string, Document[]>>();

  documents.forEach(doc => {
    const entities =
      doc.entities?.length
        ? doc.entities
        : ['General'];

    const folder =
      doc.folder ||
      doc.vaultFolder ||
      'Unsorted';

    entities.forEach(entity => {
      if (!rootMap.has(entity)) {
        rootMap.set(entity, new Map());
      }

      const entityMap = rootMap.get(entity)!;

      if (!entityMap.has(folder)) {
        entityMap.set(folder, []);
      }

      entityMap.get(folder)!.push(doc);
    });
  });

  return rootMap;
  }, [documents, customFolders]);

  return (
    <div className="min-h-screen bg-[#fafafc] flex flex-col font-sans relative pb-24">
      {isAnalyzing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <motion.div
             animate={{ rotate: 360 }}
             transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
             className="mb-6"
          >
             <Sparkles size={48} className="text-blue-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Analyzing Document</h2>
          <p className="text-gray-500 text-lg">Extracting details and adding to {targetEntityAndFolder?.folder}...</p>
        </div>
      )}
      <TopNav activeTab="entity" />
      
      <main className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10 space-y-8">
         <div className="mb-4">
           <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Entity Map</h1>
           <p className="text-gray-500">Cross-reference map strictly grouped by Entity, then Folder.</p>
         </div>

         <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".pdf,image/*" />

            {treeData.size === 0 && (
               <div className="py-20 text-center text-gray-400 font-medium">No documents organized yet.</div>
            )}
            {Array.from(treeData.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([ent, foldersMap]) => {
                const isEntExpanded = expandedEntities.has(ent);
                const totalDocsInEnt = Array.from(foldersMap.values()).reduce((sum: number, docs: Document[]) => sum + docs.length, 0);

                return (
                  <div key={ent} className="mb-2">
                     <div 
                       className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors"
                       onClick={() => toggleEntity(ent)}
                     >
                       <ChevronRight className={cn("text-gray-400 transition-transform", isEntExpanded && "rotate-90")} size={20} />
                       <User className={cn(isEntExpanded ? "text-purple-600 fill-purple-100" : "text-gray-400")} size={22} />
                       <span className="font-semibold text-gray-800 text-lg">{ent}</span>
                       <span className="ml-auto text-sm font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{totalDocsInEnt}</span>
                     </div>

                     <AnimatePresence>
                        {isEntExpanded && (
                           <motion.div 
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: 'auto', opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="overflow-hidden pl-7 sm:pl-11 border-l-2 border-gray-100 ml-5 sm:ml-7 my-1 space-y-1"
                           >
                              {Array.from(foldersMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([folder, docs]) => {
                                 const folderKey = `${ent}-${folder}`;
                                 const isFolderExpanded = expandedFolders.has(folderKey);
                                 const isEmpty = docs.length === 0;

                                 return (
                                   <div key={folder} className="mb-1">
                                      <div 
                                        className={cn("flex items-center gap-3 p-2 rounded-lg transition-colors group", isEmpty ? "cursor-default" : "cursor-pointer hover:bg-gray-50")}
                                        onClick={() => !isEmpty && toggleFolder(folderKey)}
                                      >
                                        <ChevronRight className={cn("text-gray-400 transition-transform", isFolderExpanded && "rotate-90", isEmpty && "opacity-0")} size={16} />
                                        <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center shrink-0">
                                            <Folder className="text-blue-600" size={12} strokeWidth={3} />
                                        </div>
                                        <span className={cn("font-semibold text-[15px]", isEmpty ? "text-gray-400" : "text-gray-700")}>{folder}</span>
                                        <div className="ml-auto flex items-center gap-2">
                                           <button
                                              onClick={(e) => { e.stopPropagation(); handleAddDirect(ent, folder); }}
                                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white hover:bg-gray-100 rounded text-gray-500 shadow-sm border border-gray-200"
                                              title={`Add document to ${folder} for ${ent}`}
                                           >
                                              <Plus size={14} />
                                           </button>
                                           <span className="text-xs font-bold text-gray-400 group-hover:text-gray-500 w-12 text-right">{docs.length} docs</span>
                                        </div>
                                      </div>

                                      <AnimatePresence>
                                          {isFolderExpanded && !isEmpty && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden pl-7 sm:pl-9 border-l border-gray-100 ml-4 my-1 space-y-1"
                                            >
                                               {docs.map(doc => (
                                                 <div 
                                                    key={doc.id} 
                                                    onClick={() => setViewingDoc(doc)}
                                                    className="flex items-center justify-between p-2 hover:bg-purple-50/50 rounded-lg transition-colors group cursor-pointer"
                                                 >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                       {doc.previewUrl && (!doc.mimeType || doc.mimeType.startsWith('image/')) ? (
                                                          <img src={doc.previewUrl} className="w-5 h-5 rounded object-cover border border-gray-200" />
                                                       ) : doc.previewUrl && doc.mimeType === 'application/pdf' ? (
                                                          <div className="w-5 h-5 rounded border border-gray-200 shrink-0 overflow-hidden relative pointer-events-none bg-white">
                                                             <object data={doc.previewUrl + '#toolbar=0&navpanes=0&scrollbar=0'} type="application/pdf" className="absolute w-[80px] h-[80px] top-[-25px] left-[-25px] scale-[0.25]" />
                                                          </div>
                                                       ) : (
                                                          <FileText className="text-purple-500 shrink-0" size={16} />
                                                       )}
                                                       <span className="font-medium text-gray-800 text-sm truncate group-hover:text-purple-700">{doc.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 shrink-0 mt-2 sm:mt-0">
                                                        {doc.tags && doc.tags.slice(0, 2).map((tag, i) => (
                                                          <span key={i} className="hidden sm:inline-block text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                                                            #{tag}
                                                          </span>
                                                        ))}
                                                        <span className="text-xs text-gray-400 flex items-center gap-1 min-w-[80px] justify-end">
                                                            <Calendar size={12} /> {doc.date}
                                                        </span>
                                                    </div>
                                                 </div>
                                               ))}
                                            </motion.div>
                                          )}
                                      </AnimatePresence>
                                   </div>
                                 );
                              })}
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>
                );
            })}
         </div>
      </main>

      {/* Document Viewer Modal implies same as tree view...*/}
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
