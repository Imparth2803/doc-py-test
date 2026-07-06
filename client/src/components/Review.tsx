import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FOLDER_TEMPLATES, ALL_FOLDERS } from '../types';
import { motion } from 'motion/react';
import { FileText, X, Plus, Save, ChevronLeft, Sparkles, FolderOpen, RotateCcw, RotateCw, RefreshCcw, Pin, Lock, Unlock } from 'lucide-react';
import { cn, isValidMetadata } from '../lib/utils';
import { rotateDocument as apiRotateDocument, decryptDocument, processDocument } from '../services/documentApi';

export function Review() {
  const { pendingDoc, saveDocument, setPendingDocument, customFolders, addFolder, aiUnits, setPricingOpen, goToDashboard, fetchLiveDocuments } = useApp();
  
  const [docName, setDocName] = useState('');
  const [folder, setFolder] = useState('');
  const [entitiesStr, setEntitiesStr] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [metadata, setMetadata] = useState<Record<string, string | undefined>>({});
  const [rotation, setRotation] = useState(0);

  const [customFolder, setCustomFolder] = useState('');
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);

  const [password, setPassword] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDecrypt = async () => {
    if (!password.trim() || !pendingDoc?.aiResult?._id) return;
    setIsDecrypting(true);
    setErrorMsg(null);
    try {
      const updatedDoc = await decryptDocument(pendingDoc.aiResult._id, password);
      let newServerUrl = pendingDoc.serverUrl;
      if (newServerUrl) {
        newServerUrl = `${newServerUrl.split('?')[0]}?v=${Date.now()}`;
      }
      setPendingDocument({
        ...pendingDoc,
        aiResult: updatedDoc,
        serverUrl: newServerUrl
      });
      setPassword('');
      await fetchLiveDocuments();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Decryption failed');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!pendingDoc?.aiResult?._id) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const updatedDoc = await processDocument(pendingDoc.aiResult._id);
      setPendingDocument({
        ...pendingDoc,
        aiResult: updatedDoc
      });
      await fetchLiveDocuments();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const documents = useApp().documents;
  const existingEntities = Array.from(new Set(documents.flatMap(d => (d.entities || []) as string[])));

  useEffect(() => {
    if (pendingDoc?.aiResult) {
      setDocName(pendingDoc.aiResult.documentName || pendingDoc.file.name);
      const { entities: resEnt, docType: resFold } = pendingDoc.aiResult;
      
      if ((resEnt && resEnt.length > 0 && resEnt[0] === 'UNKNOWN') || resFold === 'UNKNOWN') {
         setIsCreatingNewFolder(true);
         setEntitiesStr('');
         setFolder('');
      } else {
         setEntitiesStr(resEnt ? resEnt.join(', ') : '');
         setFolder(resFold || '');
      }
      
      setTags(pendingDoc.aiResult.tags || []);
      const { summaryFields, ...restMetadata } = pendingDoc.aiResult.metadata || {};
      setMetadata(restMetadata);
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

  const handleSave = async () => {
    let finalFolder = folder;
    if (isCreatingNewFolder && customFolder.trim()) {
       finalFolder = customFolder.trim();
       addFolder(finalFolder);
    }
    const finalEntities = entitiesStr.split(',').map(s => s.trim()).filter(Boolean);

    let finalPreviewUrl = pendingDoc.serverUrl || pendingDoc.base64Data;

    // Apply backend rotation if user changed it visually
    if (rotation !== 0 && pendingDoc.aiResult?._id) {
       // Normalize rotation to 90, 180, 270 backend equivalents
       let normalized = rotation % 360;
       if (normalized < 0) normalized += 360;
       
       if (normalized !== 0) {
         try {
           await apiRotateDocument(pendingDoc.aiResult._id, normalized);
           // Cache bust to force browser to load newly rotated image
           if (pendingDoc.serverUrl) {
             finalPreviewUrl = `${pendingDoc.serverUrl}?v=${Date.now()}`;
           }
         } catch (err) {
           console.error("Failed to rotate document on backend", err);
         }
       }
    }

    let finalCategory = 'Uploads';
    for (const [catName, folders] of Object.entries(FOLDER_TEMPLATES)) {
      if (folders.includes(finalFolder)) {
        finalCategory = catName;
        break;
      }
    }

    saveDocument(docName || pendingDoc.file.name, finalFolder, finalCategory, tags, finalPreviewUrl, finalEntities, finalFolder, finalMetadata as any, unitsUsed, creditCost, pendingDoc.mimeType);
  };

  const finalMetadata = {
   ...metadata,
   ...(pendingDoc.aiResult?.metadata?.summaryFields
      ? {
         summaryFields:
            pendingDoc.aiResult.metadata.summaryFields
         }
      : {})
   };

   console.log(
   "[SAVE_SUMMARY_FIELDS]",
   finalMetadata.summaryFields
   );

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

  const handleTogglePin = async (fieldKey: string) => {
    if (!pendingDoc || !pendingDoc.aiResult?._id) return;
    
    const docId = pendingDoc.aiResult._id;
    const currentPinned = pendingDoc.aiResult.pinnedFields || [];
    const isPinned = currentPinned.includes(fieldKey);
    
    let newPinned: string[];
    if (isPinned) {
      newPinned = currentPinned.filter(k => k !== fieldKey);
    } else {
      if (currentPinned.length >= 3) {
        alert("Maximum of 3 pinned fields allowed");
        return;
      }
      newPinned = [...currentPinned, fieldKey];
    }
    
    // Update pendingDoc state optimistically
    setPendingDocument({
      ...pendingDoc,
      aiResult: {
        ...pendingDoc.aiResult,
        pinnedFields: newPinned
      }
    });
    
    try {
      const response = await fetch(`http://localhost:8000/api/documents/${docId}/toggle-pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fieldKey })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to toggle pin');
      }
      
      const data = await response.json();
      setPendingDocument({
        ...pendingDoc,
        aiResult: {
          ...pendingDoc.aiResult,
          pinnedFields: data.pinnedFields
        }
      });
    } catch (err: any) {
      console.error("[TOGGLE_PIN_CLIENT_ERROR]", err);
      // Revert optimistic update
      setPendingDocument({
        ...pendingDoc,
        aiResult: {
          ...pendingDoc.aiResult,
          pinnedFields: currentPinned
        }
      });
      alert(err.message || 'Failed to toggle pin');
    }
  };

  const docStatus = pendingDoc.aiResult?.status;
  const isAnalyzed = docStatus === 'COMPLETED' || docStatus === 'PARTIAL_SUCCESS';
  const isImage = pendingDoc.mimeType.startsWith('image/');
  const displayFolder = isCreatingNewFolder ? (customFolder || 'New Folder') : folder;

  return (
    <div className="min-h-screen bg-[#f7f7f9] flex flex-col font-sans">
       <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 w-full">
         <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setPendingDocument(null);
              goToDashboard();
            }}
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
            <div className="w-full lg:w-1/2 bg-gray-50 p-8 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-gray-100 min-h-[400px] relative">
              {isImage && (docStatus !== 'NEEDS_PASSWORD' && docStatus !== 'UNLOCK_FAILED') && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/80 backdrop-blur-md p-1.5 rounded-xl border border-gray-200 shadow-sm z-10">
                  <button onClick={() => setRotation(r => r - 90)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Rotate Left">
                    <RotateCcw size={18} />
                  </button>
                  <button onClick={() => setRotation(0)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Reset Rotation">
                    <RefreshCcw size={16} />
                  </button>
                  <button onClick={() => setRotation(r => r + 90)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Rotate Right">
                    <RotateCw size={18} />
                  </button>
                </div>
              )}

              {docStatus === 'NEEDS_PASSWORD' || docStatus === 'UNLOCK_FAILED' ? (
                <div className="flex flex-col items-center justify-center p-8 text-red-500">
                  <Lock size={64} className="mb-4 text-red-400" />
                  <p className="font-bold text-gray-700 text-lg">Document Password Protected</p>
                  <p className="text-sm text-gray-400 mt-2 text-center max-w-xs leading-relaxed">
                    This document is encrypted. Please enter the password below to decrypt and unlock it.
                  </p>
                </div>
              ) : isImage ? (
                 <img 
                    src={pendingDoc.serverUrl || pendingDoc.base64Data} 
                    alt="Document Preview" 
                    style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s ease-out' }}
                    className="max-w-full max-h-[600px] object-contain rounded-xl shadow-sm border border-gray-200" 
                 />
              ) : pendingDoc.mimeType === 'application/pdf' ? (
                 <object data={ pendingDoc.serverUrl || pendingDoc.base64Data } type="application/pdf" className="w-full h-full min-h-[500px] rounded-xl shadow-sm border border-gray-200">
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

              {/* Decryption Controls in Review Flow */}
              {(docStatus === 'NEEDS_PASSWORD' || docStatus === 'UNLOCK_FAILED') && (
                <div className="w-full max-w-sm mt-8 p-5 bg-red-50/50 rounded-2xl border border-red-100/50 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                    <Lock size={14} className="text-red-500" />
                    <span>Enter Decryption Password</span>
                  </div>
                  {errorMsg && <p className="text-xs font-semibold text-red-600 bg-white/80 px-3 py-2 rounded-xl border border-red-100">{errorMsg}</p>}
                  <div className="flex gap-2">
                    <input 
                      type="password"
                      placeholder="Password..."
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={isDecrypting}
                      className="flex-1 px-4 py-2.5 border border-red-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400 text-gray-800"
                      onKeyDown={e => e.key === 'Enter' && handleDecrypt()}
                    />
                    <button 
                      onClick={handleDecrypt}
                      disabled={isDecrypting || !password.trim()}
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95 flex items-center gap-1 shadow-md shadow-red-500/10 shrink-0"
                    >
                      {isDecrypting ? 'Unlocking...' : 'Decrypt'}
                    </button>
                  </div>
                </div>
              )}

              {/* Prominent Analyze Document Button */}
              {docStatus === 'DECRYPTED' && (
                <div className="w-full max-w-sm mt-8 flex flex-col gap-3">
                  {errorMsg && <p className="text-xs font-semibold text-red-600 bg-white/80 px-3 py-2 rounded-xl border border-red-100">{errorMsg}</p>}
                  <button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 hover:scale-[1.01] pointer-events-auto"
                  >
                    <Sparkles size={18} /> Analyze Document
                  </button>
                </div>
              )}

              {/* Processing Loader */}
              {(docStatus === 'PROCESSING' || isAnalyzing) && (
                <div className="w-full max-w-sm mt-8 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex flex-col items-center gap-4">
                  <div className="flex items-center gap-3 text-blue-700 font-bold text-sm uppercase tracking-wider">
                    <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <span>Analyzing Document...</span>
                  </div>
                  <p className="text-xs text-blue-500 text-center leading-relaxed">
                    Running OCR, entity enrichment, tag classification, and smart filing analysis...
                  </p>
                </div>
              )}
            </div>

            {/* Right side: AI Results & Edit */}
            <div className="w-full lg:w-1/2 p-8 lg:p-12 flex flex-col overflow-y-auto max-h-[calc(100vh-80px)]">
               {!isAnalyzed ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-50/30 rounded-[24px] border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[22px] flex items-center justify-center mb-6 shadow-sm border border-blue-100">
                      <Sparkles size={28} className="animate-pulse" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Awaiting AI Analysis</h3>
                    <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-8">
                      Once the document is decrypted and analyzed, our AI extracts the document metadata, tags, entities, and suggested folder location automatically.
                    </p>
                    
                    <div className="flex flex-col gap-3.5 w-full max-w-xs text-left p-5 bg-white border border-gray-100 rounded-2xl shadow-sm">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 border-b border-gray-50 pb-2">
                        Workflow Progress
                      </div>
                      
                      <div className="flex items-start gap-3 text-xs">
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5", 
                          (docStatus === 'NEEDS_PASSWORD' || docStatus === 'UNLOCK_FAILED')
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : "bg-green-50 text-green-600 border border-green-200"
                        )}>
                          {(docStatus === 'NEEDS_PASSWORD' || docStatus === 'UNLOCK_FAILED') ? '🔒' : '✓'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">1. Decrypt Document</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Decrypt using the password input on the left.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 text-xs">
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5", 
                          docStatus === 'DECRYPTED' ? "bg-blue-50 text-blue-600 border border-blue-200 animate-pulse" : 
                          docStatus === 'PROCESSING' || isAnalyzing ? "bg-blue-50 text-blue-600 border border-blue-200 animate-spin" : 
                          isAnalyzed ? "bg-green-50 text-green-600 border border-green-200" : "bg-gray-50 text-gray-400 border border-gray-200"
                        )}>
                          {docStatus === 'PROCESSING' || isAnalyzing ? '⚙' : '2'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">2. Run AI Analysis</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Extract classifications, OCR text, and summary details.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 text-xs">
                        <div className="w-5 h-5 rounded-full bg-gray-50 text-gray-400 border border-gray-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                          3
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">3. Verify & Save</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Confirm the extracted values and file to the vault.</p>
                        </div>
                      </div>
                    </div>
                 </div>
               ) : (
                 <>
                   <div className="flex flex-col gap-4 mb-8">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full text-sm font-medium">
                        <Sparkles size={16} /> AI Analyzed {(pendingDoc.aiResult?.ocrConfidence ?? 100) < 70 ? '(Low Confidence)' : ''}
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

              {pendingDoc.aiResult?.metadata?.summaryFields && Object.keys(pendingDoc.aiResult.metadata.summaryFields).length > 0 && (
                  <div className="mb-6 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                     <label className="block text-sm font-bold text-gray-800 mb-3">Summary Fields</label>
                     <div className="grid grid-cols-2 gap-4">
                       {Object.entries(pendingDoc.aiResult.metadata.summaryFields).map(([key, val]) => {
                          const isPinned = (pendingDoc.aiResult?.pinnedFields || []).includes(key);
                          return (
                             <div key={key} className="flex flex-col p-2.5 rounded-xl border border-gray-50 bg-gray-50/30 hover:bg-gray-50 transition-all relative group/pin">
                                <div className="flex items-center justify-between">
                                   <span className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 truncate pr-6">{key}</span>
                                   <button 
                                      type="button"
                                      onClick={() => handleTogglePin(key)}
                                      className="absolute top-2 right-2 p-1 rounded-md hover:bg-gray-200 transition-colors"
                                      title={isPinned ? "Unpin field" : "Pin field"}
                                   >
                                      <Pin 
                                         size={12} 
                                         className={cn(
                                           "transition-all",
                                           isPinned 
                                             ? "text-blue-600 fill-blue-600 rotate-45 scale-110" 
                                             : "text-gray-300 hover:text-gray-500"
                                         )}
                                      />
                                   </button>
                                </div>
                                <span className="font-medium text-gray-900 block pr-6 truncate text-sm mt-0.5" title={String(val)}>{String(val)}</span>
                             </div>
                          );
                       })}
                     </div>
                  </div>
               )}

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
                  onClick={() => {
                    setPendingDocument(null);
                    goToDashboard();
                  }}
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
                 </>
               )}
            </div>
        </div>
      </main>
    </div>
  );
}
