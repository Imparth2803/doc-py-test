import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FOLDER_TEMPLATES, ALL_FOLDERS } from '../types';
import { motion } from 'motion/react';
import { FileText, X, Plus, Save, ChevronLeft, Sparkles, FolderOpen } from 'lucide-react';
import { cn, isValidMetadata } from '../lib/utils';

export function Review() {
  const { pendingDoc, saveDocument, setPendingDocument, customFolders, addFolder, aiUnits, setPricingOpen } = useApp();
  
  const [docName, setDocName] = useState('');
  const [folder, setFolder] = useState('');
  const [entitiesStr, setEntitiesStr] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [metadata, setMetadata] = useState<Record<string, string | undefined>>({});

  const [customFolder, setCustomFolder] = useState('');
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  
  const documents = useApp().documents;
  const existingEntities = Array.from(new Set(documents.flatMap(d => (d.entities || []) as string[])));

  useEffect(() => {
    if (pendingDoc?.aiResult) {
      setDocName(pendingDoc.aiResult.docName || pendingDoc.file.name);
      
      const { entities: resEnt, folder: resFold } = pendingDoc.aiResult;
      
      if ((resEnt && resEnt.length > 0 && resEnt[0] === 'UNKNOWN') || resFold === 'UNKNOWN') {
         setIsCreatingNewFolder(true);
         setEntitiesStr('');
         setFolder('');
      } else {
         setEntitiesStr(resEnt ? resEnt.join(', ') : '');
         setFolder(resFold || '');
      }
      
      setTags(pendingDoc.aiResult.tags || []);
      setMetadata(pendingDoc.aiResult.metadata || {});
    } else if (pendingDoc) {
      setDocName(pendingDoc.file.name);
      setEntitiesStr('');
      setFolder(ALL_FOLDERS[0] || '');
      setMetadata({});
    }
  }, [pendingDoc]);

  if (!pendingDoc) return null;

  const metrics = pendingDoc.aiResult?.metrics;
  
  // Dynamic Cost Calculation
  let unitsUsed = 5;
  if (metrics?.languages && metrics.languages.length > 1) unitsUsed += 2;
  if (metrics?.pages && metrics.pages > 1) unitsUsed += (metrics.pages - 1);
  if (metrics?.ocrPerformed) unitsUsed += 1;
  if (metrics?.complexity === 'HIGH') unitsUsed += 2;
  
  const creditCost = unitsUsed * 0.30; // ₹0.30 per unit

  const handleSave = () => {
    let finalFolder = folder;
    if (isCreatingNewFolder && customFolder.trim()) {
       finalFolder = customFolder.trim();
       addFolder(finalFolder);
    }
    const finalEntities = entitiesStr.split(',').map(s => s.trim()).filter(Boolean);
    saveDocument(docName || pendingDoc.file.name, finalFolder, tags, pendingDoc.base64Data, finalEntities, 'Document', metadata, unitsUsed, creditCost, pendingDoc.mimeType);
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags(tags.filter((_, i) => i !== indexToRemove));
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (!tags.includes(newTag.trim())) {
         setTags([...tags, newTag.trim()]);
      }
      setNewTag('');
    }
  };

  const isImage = pendingDoc.mimeType.startsWith('image/');
  const displayFolder = isCreatingNewFolder ? (customFolder || 'New Folder') : folder;

  return (
    <div className="min-h-screen bg-[#f7f7f9] flex flex-col font-sans">
       <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 w-full">
         <div className="flex items-center gap-4">
          <button 
            onClick={() => setPendingDocument(null)}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-500"
          >
            <ChevronLeft size={24} />
          </button>
          <span className="font-semibold tracking-tight text-lg">Review AI Extraction</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 flex flex-col items-center">
        <div className="w-full bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col lg:flex-row border border-gray-100">
           
           {/* Left side: Preview */}
           <div className="w-full lg:w-1/2 bg-gray-50 p-8 flex items-center justify-center border-b lg:border-b-0 lg:border-r border-gray-100 min-h-[400px]">
              {isImage ? (
                 <img src={pendingDoc.base64Data} alt="Document Preview" className="max-w-full max-h-[600px] object-contain rounded-xl shadow-sm border border-gray-200" />
              ) : pendingDoc.mimeType === 'application/pdf' ? (
                 <object data={pendingDoc.base64Data} type="application/pdf" className="w-full h-full min-h-[500px] rounded-xl shadow-sm border border-gray-200">
                    <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                      <FileText size={64} className="mb-4" />
                      <p className="text-sm mt-1">Preview not available in this browser. File saved successfully.</p>
                    </div>
                 </object>
              ) : (
                 <div className="flex flex-col items-center text-gray-400">
                     <FileText size={64} className="mb-4" />
                     <p className="font-medium text-gray-600 truncate max-w-xs">{pendingDoc.file.name}</p>
                     <p className="text-sm mt-1">File Preview</p>
                 </div>
              )}
           </div>

            {/* Right side: AI Results & Edit */}
            <div className="w-full lg:w-1/2 p-8 lg:p-12 flex flex-col overflow-y-auto max-h-[calc(100vh-80px)]">
               <div className="flex flex-col gap-4 mb-8">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full text-sm font-medium">
                        <Sparkles size={16} /> AI Analyzed {pendingDoc.aiResult?.confidence === 'LOW' ? '(Low Confidence)' : ''}
                     </div>
                     <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Processing Cost</span>
                        <span className="text-sm font-bold text-gray-700 mt-1">{unitsUsed} Units • ₹{creditCost.toFixed(2)}</span>
                         {aiUnits < 150 && (
                            <button 
                              onClick={() => setPricingOpen(true)}
                              className="text-[10px] font-black text-orange-600 uppercase tracking-widest mt-1 hover:underline"
                            >
                               Low Balance! Recharge
                            </button>
                         )}
                     </div>
                  </div>

                  {metrics && (
                     <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                           <span>Analysis Details</span>
                           <span>Multiplier Logic</span>
                        </div>
                        <div className="space-y-2">
                           <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600 flex items-center gap-2">
                                 <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                 Base Extraction
                              </span>
                              <span className="text-gray-900 font-medium">5 Units</span>
                           </div>
                           {metrics.pages && metrics.pages > 1 && (
                              <div className="flex items-center justify-between text-sm">
                                 <span className="text-gray-600 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Multi-page ({metrics.pages} pgs)
                                 </span>
                                 <span className="text-gray-900 font-medium">+{metrics.pages - 1} Units</span>
                              </div>
                           )}
                           {metrics.languages && metrics.languages.length > 1 && (
                              <div className="flex items-center justify-between text-sm">
                                 <span className="text-gray-600 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Multilingual ({metrics.languages.join(', ')})
                                 </span>
                                 <span className="text-gray-900 font-medium">+2 Units</span>
                              </div>
                           )}
                           {metrics.ocrPerformed && (
                              <div className="flex items-center justify-between text-sm">
                                 <span className="text-gray-600 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    OCR Processing
                                 </span>
                                 <span className="text-gray-900 font-medium">+1 Unit</span>
                              </div>
                           )}
                           {metrics.complexity === 'HIGH' && (
                              <div className="flex items-center justify-between text-sm">
                                 <span className="text-gray-600 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    High Complexity Legal
                                 </span>
                                 <span className="text-gray-900 font-medium">+2 Units</span>
                              </div>
                           )}
                        </div>
                        {metrics.reasoning && (
                           <div className="mt-2 pt-2 border-t border-gray-200/50 italic text-[11px] text-gray-400">
                             AI Note: {metrics.reasoning}
                           </div>
                        )}
                     </div>
                  )}
               </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Name</label>
                <input 
                   type="text"
                   value={docName}
                   onChange={e => setDocName(e.target.value)}
                   className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium shadow-sm"
                />
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                 <div className="flex items-center gap-2 text-gray-500 mb-1 font-medium text-sm">
                   <FolderOpen size={16} /> Filing into:
                 </div>
                 <div className="text-xl font-bold text-gray-900">
                   {entitiesStr || 'Unknown'} <span className="text-gray-400 mx-2">→</span> {displayFolder}
                 </div>
              </div>

              <div className="mb-6">
                 <label className="block text-sm font-medium text-gray-700 mb-2">Assign Entities (Comma Separated)</label>
                 <input 
                    type="text"
                    list="existingEntities"
                    placeholder="e.g. Tejas, 11-year-old Son, Kajal"
                    value={entitiesStr}
                    onChange={e => setEntitiesStr(e.target.value)}
                    className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium appearance-none shadow-sm"
                 />
                 <datalist id="existingEntities">
                    {existingEntities.map(ent => <option key={ent} value={ent} />)}
                 </datalist>
              </div>

              <div className="mb-8">
                 <div className="flex items-center justify-between mb-2">
                   <label className="block text-sm font-medium text-gray-700">Override Folder</label>
                   <button 
                     onClick={() => {
                        setIsCreatingNewFolder(!isCreatingNewFolder);
                        setCustomFolder('');
                     }} 
                     className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                   >
                     {isCreatingNewFolder ? "Select Existing Folder" : "+ Create New Folder"}
                   </button>
                 </div>

                 {isCreatingNewFolder ? (
                   <input 
                      type="text"
                      placeholder="Enter custom folder name..."
                      value={customFolder}
                      onChange={e => setCustomFolder(e.target.value)}
                      className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium shadow-sm"
                   />
                 ) : (
                   <select 
                      value={folder}
                      onChange={e => setFolder(e.target.value)}
                      className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium appearance-none shadow-sm"
                   >
                      <option value="" disabled>Select a predefined folder</option>
                      {Object.entries(FOLDER_TEMPLATES).map(([type, folders]) => (
                        <optgroup key={type} label={type}>
                          {folders.map(fold => (
                            <option key={fold} value={fold}>{fold}</option>
                          ))}
                        </optgroup>
                      ))}
                      {customFolders.length > 0 && (
                        <optgroup label="Custom Folders">
                           {customFolders.map(fold => (
                              <option key={fold} value={fold}>{fold}</option>
                           ))}
                        </optgroup>
                      )}
                   </select>
                 )}
              </div>

              {Object.keys(metadata).length > 0 && Object.values(metadata).some(isValidMetadata) && (
                 <div className="mb-8 bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50">
                    <label className="block text-sm font-bold text-gray-800 mb-3">Extracted Details</label>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(metadata).map(([key, val]) => isValidMetadata(val) ? (
                         <div key={key}>
                            <span className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <input 
                              type="text" 
                              value={val}
                              onChange={e => setMetadata({...metadata, [key]: e.target.value})}
                              className="w-full bg-white border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium"
                            />
                         </div>
                      ) : null)}
                    </div>
                 </div>
              )}

              <div className="mb-10 flex-1">
                 <label className="block text-sm font-medium text-gray-700 mb-3">Extracted Tags</label>
                 <div className="flex flex-wrap gap-2 mb-4">
                    {tags.map((tag, i) => (
                      <span 
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200"
                      >
                        #{tag}
                        <button onClick={() => handleRemoveTag(i)} className="ml-1 text-gray-400 hover:text-gray-900 focus:outline-none transition-colors">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                 </div>
                 
                 <div className="relative flex items-center max-w-sm">
                   <Plus size={16} className="absolute left-3 text-gray-400" />
                   <input 
                      type="text" 
                      placeholder="Add a tag and press enter..."
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      onKeyDown={handleAddTag}
                      className="w-full bg-white border border-gray-200 rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 shadow-sm"
                   />
                 </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex gap-4 mt-auto">
                 <button 
                  onClick={() => setPendingDocument(null)}
                  className="px-6 py-3.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={handleSave}
                   className="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-xl font-medium transition-all active:scale-[0.98]"
                 >
                   <Save size={18} /> Confirm & Save
                 </button>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}
