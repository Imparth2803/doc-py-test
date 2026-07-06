import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, FileText, User, FolderOpen, ChevronRight, Calendar, X, Info, Pin, Lock, Unlock, FileSpreadsheet } from 'lucide-react';
import { Document } from '../types';
import { cn, isValidMetadata } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { decryptDocument, processDocument } from '../services/documentApi';

export const DocumentCard: React.FC<{ 
  doc: Document; 
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onTagClick: (tag: string) => void;
  onEntityClick: (entity: string) => void;
  onFolderClick: (folder: string) => void;
  onView: () => void;
  onShare: (doc: Document) => void;
}> = ({ doc, isExpanded, onToggleExpand, onTagClick, onEntityClick, onFolderClick, onView, onShare }) => {

  const [expandedEntities, setExpandedEntities] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [password, setPassword] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { fetchLiveDocuments, goToTables } = useApp();

  const handleDecrypt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!password.trim()) return;
    setIsDecrypting(true);
    setErrorMsg(null);
    try {
      await decryptDocument(doc._id, password);
      setPassword('');
      await fetchLiveDocuments();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Decryption failed');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await processDocument(doc._id);
      await fetchLiveDocuments();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Analysis failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const summary = doc.metadata?.aiSummary;

  const summaryFields = doc.metadata?.summaryFields || {};
  const pinnedKeys = doc.pinnedFields || [];

  let fieldsToDisplay: [string, any][] = [];
  if (pinnedKeys.length > 0) {
    // Filter summaryFields to display ONLY the key-value pairs whose keys exist in the pinnedFields array
    fieldsToDisplay = Object.entries(summaryFields).filter(([key]) => pinnedKeys.includes(key));
  } else {
    // Fall back to displaying the first 3 default key-value pairs from summaryFields
    fieldsToDisplay = Object.entries(summaryFields).slice(0, 3);
  }

  return (
    <div 
      className={cn(
        "bg-white border rounded-[20px] shadow-[0_2px_8px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgb(0,0,0,0.06)] transition-all group flex flex-col p-5 cursor-pointer relative",
        isExpanded ? "border-blue-500 ring-2 ring-blue-500/10 z-10" : "border-gray-100 hover:border-gray-300",
        !showPopover && "overflow-hidden"
      )} 
      onClick={onToggleExpand}
    >
      
      {/* Action Buttons Overlay (More Info & Share) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            setShowPopover(!showPopover); 
          }}
          className={cn(
            "w-8 h-8 rounded-full border shadow-sm flex items-center justify-center transition-all",
            showPopover 
              ? "bg-blue-50 border-blue-200 text-blue-600 opacity-100"
              : "bg-white/80 backdrop-blur-sm border-gray-100 text-gray-500 hover:text-blue-600 opacity-100 md:opacity-0 md:group-hover:opacity-100"
          )}
          title="More Info"
        >
          <Info size={14} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onShare(doc); }}
          className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-gray-100 shadow-sm flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-gray-50 text-gray-500 hover:text-gray-800"
          title="Share Document"
        >
          <Share2 size={14} />
        </button>
      </div>

      {/* Info Popover / Dropdown container */}
      <AnimatePresence>
        {showPopover && (
          <motion.div 
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-14 right-4 z-20 bg-white border border-gray-100 shadow-2xl rounded-2xl p-4 w-64 text-left cursor-default border-l-4 border-l-blue-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Pin size={10} className="text-blue-500 rotate-45" /> Key Summary Details
              </span>
              <button 
                onClick={() => setShowPopover(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded-md hover:bg-gray-50"
              >
                <X size={12} />
              </button>
            </div>
            
            {fieldsToDisplay.length > 0 ? (
              <div className="space-y-2.5">
                {fieldsToDisplay.map(([key, val]) => {
                  const isPinned = pinnedKeys.includes(key);
                  return (
                    <div 
                      key={key} 
                      className={cn(
                        "p-2 rounded-xl transition-colors border",
                        isPinned 
                          ? "bg-blue-50/70 border-blue-100/50 shadow-sm" 
                          : "bg-gray-50/50 border-gray-100"
                      )}
                    >
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                        <span>{key}</span>
                        {isPinned && (
                          <span className="text-[8px] font-bold bg-blue-100 text-blue-600 px-1 rounded uppercase tracking-tighter">
                            Pinned
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-gray-800 text-[11px] block truncate" title={String(val)}>
                        {String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic text-center py-2">No summary fields available.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Section */}
      <div className="flex items-start gap-4 mb-2">
        {doc.previewUrl && (!doc.mimeType || doc.mimeType.startsWith('image/')) ? (
           <div 
             className="w-14 h-14 bg-gray-50 rounded-[14px] overflow-hidden shrink-0 border border-gray-100 shadow-sm cursor-zoom-in"
             onClick={(e) => { e.stopPropagation(); onView(); }}
           >
             <img src={doc.previewUrl} className="w-full h-full object-cover" alt="" />
           </div>
        ) : doc.previewUrl && doc.mimeType === 'application/pdf' ? (
           <div 
             className="w-14 h-14 bg-gray-50 rounded-[14px] overflow-hidden shrink-0 border border-gray-100 shadow-sm relative pointer-events-none cursor-zoom-in"
             onClick={(e) => { e.stopPropagation(); onView(); }}
           >
             <object data={doc.previewUrl + '#toolbar=0&navpanes=0&scrollbar=0'} type="application/pdf" className="w-[400px] h-[400px] absolute top-[-100px] left-[-100px] origin-[30%_30%] scale-[0.15]">
               <div className="w-full h-full flex items-center justify-center text-red-500">
                 <FileText size={24} />
               </div>
             </object>
             <span className="absolute bottom-1 right-1 text-[8px] font-black uppercase text-red-600 bg-white/90 border border-red-100 rounded px-1">PDF</span>
           </div>
        ) : (
           <div 
             className="w-14 h-14 rounded-[14px] flex items-center justify-center text-gray-500 shrink-0 bg-gray-50 border border-gray-100 shadow-sm cursor-zoom-in"
             onClick={(e) => { e.stopPropagation(); onView(); }}
           >
              <FileText size={24} />
           </div>
        )}
        <div className="flex-1 min-w-0 pt-0.5">
           <h4 className={cn("font-bold text-gray-900 text-[15px] truncate transition-colors mb-2 pr-12", isExpanded ? "text-blue-600" : "group-hover:text-blue-600")}>{doc.name}</h4>
           
           <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
             <div className="flex items-center gap-2 flex-wrap">
               {doc.entities && doc.entities.slice(0, 2).map((ent, index) => (
                 <button 
                    key={`${ent}-${index}`} 
                    onClick={() => onEntityClick(ent)} 
                    title={ent}
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100 hover:scale-105 transition-all max-w-[100px] sm:max-w-[130px]"
                 >
                    <User size={10} strokeWidth={2.5} className="shrink-0"/> 
                    <span className="truncate">{ent}</span>
                 </button>
               ))}
               {!isExpanded && !expandedEntities && doc.entities && doc.entities.length > 2 && (
                 <button 
                    onClick={(e) => { e.stopPropagation(); setExpandedEntities(true); }}
                    className="text-[10px] font-bold text-gray-400 px-1 hover:text-gray-600 transition-colors"
                 >
                   +{doc.entities.length - 2} more
                 </button>
               )}
             </div>

             <AnimatePresence>
               {expandedEntities && (
                 <motion.div 
                   initial={{ height: 0, opacity: 0 }}
                   animate={{ height: 'auto', opacity: 1 }}
                   exit={{ height: 0, opacity: 0 }}
                   className="overflow-hidden"
                 >
                   <div className="flex items-center gap-2 flex-wrap pt-1">
                      {doc.entities?.slice(2).map((ent, index) => (
                        <button 
                           key={`${ent}-${index + 2}`} 
                           onClick={() => onEntityClick(ent)} 
                           title={ent}
                           className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100 hover:scale-105 transition-all max-w-[100px] sm:max-w-[130px]"
                        >
                           <User size={10} strokeWidth={2.5} className="shrink-0"/> 
                           <span className="truncate">{ent}</span>
                        </button>
                      ))}
                      <button 
                         onClick={(e) => { e.stopPropagation(); setExpandedEntities(false); }}
                         className="text-[10px] font-bold text-gray-400 px-1 hover:text-gray-600 transition-colors"
                      >
                         Show less
                      </button>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>

             <div className="flex items-center justify-between">
               <button onClick={() => onFolderClick(doc.folder)} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 hover:scale-105 transition-all">
                  <FolderOpen size={10} strokeWidth={2.5} /> {doc.folder}
               </button>
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{doc.docType}</span>
             </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-5 space-y-6 border-t border-gray-100 mt-2" onClick={e => e.stopPropagation()}>
              
              {/* Summary */}
              {summary && typeof summary === 'string' && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Summary</span>
                  <p className="text-[13px] text-gray-600 leading-relaxed line-clamp-3">
                    {summary}
                  </p>
                </div>
              )}

              {/* Tags */}
              {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.tags.map((tag, idx) => typeof tag === 'string' && (
                      <span key={`${tag}-${idx}`} className="px-2 py-1 bg-gray-50 text-gray-500 text-[10px] font-bold rounded-md border border-gray-100">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Entities */}
              {Array.isArray(doc.entities) && doc.entities.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.entities.map((ent, idx) => (
                      <button 
                        key={`${ent}-${idx}`} 
                        onClick={(e) => {
                          e.stopPropagation();
                          onEntityClick(ent);
                        }}
                        className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md bg-gray-50 text-gray-700 font-bold border border-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <User size={10} strokeWidth={3} className="text-gray-400" />
                        <span>{ent}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Link */}
              <div className="pt-2 flex justify-between items-center border-t border-gray-100">
                {(() => {
                  const hasTables = doc.tables && (
                    (Array.isArray(doc.tables) && doc.tables.length > 0) ||
                    (doc.tables.previewAvailable && doc.tables.totalTables > 0)
                  );
                  const tablesCount = doc.tables
                    ? (Array.isArray(doc.tables) ? doc.tables.length : (doc.tables.totalTables || 0))
                    : 0;
                  const showTablesButton = hasTables && doc.status !== 'PROCESSING';
                  
                  if (!showTablesButton) return <div />;
                  
                  return (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        goToTables(doc._id); 
                      }}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 hover:bg-emerald-100/50 hover:scale-102 transition-all active:scale-95"
                      title="View extracted tables"
                    >
                      <FileSpreadsheet size={12} className="text-emerald-500" />
                      <span>Tables ({tablesCount})</span>
                    </button>
                  );
                })()}
                <button 
                  onClick={(e) => { e.stopPropagation(); onView(); }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Open Original <ChevronRight size={14} />
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isExpanded && (
        <div className="mt-2 flex items-center justify-between">
           <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
             <Calendar size={12} className="text-gray-300" /> {doc.date}
           </span>
           <div className="flex gap-1">
              {doc.tags && doc.tags.slice(0, 2).map(t => (
                <span key={t} className="w-1.5 h-1.5 rounded-full bg-gray-200"></span>
              ))}
           </div>
        </div>
      )}

      {/* Encryption / Decryption status and triggers */}
      {(doc.status === 'NEEDS_PASSWORD' || doc.status === 'UNLOCK_FAILED') && (
        <div className="mt-3 p-4 bg-red-50/80 rounded-[16px] border border-red-100 flex flex-col gap-2 relative z-10" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
            <Lock size={12} className="text-red-500" />
            <span>Password Protected</span>
          </div>
          <p className="text-[11px] text-red-500 leading-normal">This document is encrypted. Decryption is required before preview or analysis.</p>
          {errorMsg && <p className="text-[11px] font-medium text-red-700">{errorMsg}</p>}
          <div className="flex gap-2">
            <input 
              type="password"
              placeholder="Password..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isDecrypting}
              className="flex-1 px-3 py-1.5 border border-red-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            <button 
              onClick={handleDecrypt}
              disabled={isDecrypting || !password.trim()}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95 flex items-center gap-1"
            >
              {isDecrypting ? 'Unlocking...' : 'Decrypt'}
            </button>
          </div>
        </div>
      )}

      {doc.status === 'DECRYPTED' && (
        <div className="mt-3 p-4 bg-blue-50/70 rounded-[16px] border border-blue-100/50 flex flex-col gap-2 relative z-10" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
            <Unlock size={12} className="text-blue-500" />
            <span>Decrypted & Ready</span>
          </div>
          <p className="text-[11px] text-blue-500 leading-normal">Manual decryption succeeded. Verify preview, then start AI analysis.</p>
          {errorMsg && <p className="text-[11px] font-medium text-red-700">{errorMsg}</p>}
          <button 
            onClick={handleAnalyze}
            disabled={isProcessing}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-blue-500/10"
          >
            {isProcessing ? 'Analyzing...' : 'Analyze Document'}
          </button>
        </div>
      )}

      {doc.status === 'PROCESSING' && (
        <div className="mt-3 p-4 bg-gray-50 rounded-[16px] border border-gray-100 flex items-center justify-between relative z-10" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-wider animate-pulse">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
            <span>Analyzing...</span>
          </div>
          <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};
