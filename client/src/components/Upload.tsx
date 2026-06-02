import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion } from 'motion/react';
import { UploadCloud, Zap } from 'lucide-react';
import {
  uploadDocument,
  processDocument
} from '../services/documentApi';
import { HubWizard } from './HubWizard';
import { TopNav } from './TopNav';
import { Document } from '../types';
export function Upload() {
  const {
  documents,
  aiUnits,
  setPricingOpen,
  fetchLiveDocuments,
  setPendingDocument,
  } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const processFile = async (file: File) => {
  setIsProcessing(true);
  setErrorMsg(null);

  try {
    console.log('Uploading document...');

    // Upload file to backend
    const uploadedDoc = await uploadDocument(file);

    console.log('Upload successful:', uploadedDoc);

    // Trigger backend AI processing
    const processedDoc = await processDocument(uploadedDoc._id);

    console.log('Processing complete:', processedDoc);

    // Refresh documents from backend (swallow error so we can still get to Review)
    try {
      await fetchLiveDocuments();
    } catch (e) {
      console.error('Non-critical fetch error:', e);
    }

    console.log('Preparing Review screen...');

    // Trigger Review Screen
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    setPendingDocument({
      file,
      base64Data: base64,
      mimeType: file.type,
      aiResult: processedDoc
    });

  } catch (err: any) {
    console.error('Upload/processing error details:', {
      message: err.message,
      stack: err.stack,
      error: err
    });

    setErrorMsg(
      `Upload failed: ${err.message || 'Unknown error'}`
    );
  } finally {
    setIsProcessing(false);
  }
 };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | any) => {
    e.preventDefault();
    const file = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (file) {
      if (documents.some((d: any) => d.name === file.name)) {
        setErrorMsg(`A document named "${file.name}" has already been uploaded. Duplicate rejected.`);
        // Reset file input value to allow re-selection if needed
        if (e.target && 'value' in e.target) {
            e.target.value = '';
        }
        return;
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if(!allowedTypes.includes(file.type)) {
         setErrorMsg("Only JPG, PNG, WEBP, and PDF files are supported.");
         return;
      }
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  return (
    <div className="min-h-screen bg-[#fafafc] flex flex-col font-sans relative pb-24">
      <TopNav activeTab="hub" />

      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto space-y-12 mt-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full text-center"
        >
          {isProcessing ? (
             <div className="flex flex-col items-center justify-center py-24 space-y-6">
                <div className="w-20 h-20 border-4 border-blue-50 border-t-blue-500 rounded-full animate-spin"></div>
                <h2 className="text-2xl font-medium tracking-tight text-gray-900">Analyzing document...</h2>
                <p className="text-gray-500">Extracting classification, metadata, and auto-tags via Gemini Flash...</p>
             </div>
          ) : (
            <>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 text-gray-900">Upload Center</h1>
              <p className="text-gray-500 mb-6 max-w-lg mx-auto text-sm sm:text-base leading-relaxed">Drop a document below. Our AI extracts entities, categories, and tags instantly.</p>

              {aiUnits < 200 && (
                <div className="mb-10 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-between gap-4 max-w-xl mx-auto shadow-sm shadow-orange-500/5">
                  <div className="flex items-center gap-3 text-orange-700">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                       <Zap size={16} strokeWidth={3} />
                    </div>
                    <p className="text-[11px] sm:text-xs font-bold uppercase tracking-tight text-left">
                       AI Balance Low: {aiUnits} units remaining. <br/>
                       <span className="text-orange-400 font-medium lowercase">Recharge for uninterrupted smart filing.</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => setPricingOpen(true)}
                    className="bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-orange-700 transition-colors shrink-0"
                  >
                     Top Up
                  </button>
                </div>
              )}

              {errorMsg && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-8 animate-in fade-in slide-in-from-top-1 text-center">
                  {errorMsg}
                </div>
              )}
              
              <label 
                onDragOver={handleDragOver}
                onDrop={handleFileUpload}
                className="w-full max-w-2xl mx-auto min-h-[340px] border-2 border-dashed border-gray-200 hover:border-blue-400 focus-within:border-blue-400 bg-white hover:bg-blue-50/20 rounded-[40px] p-8 sm:p-12 flex flex-col items-center justify-center cursor-pointer transition-all group shadow-sm hover:shadow-xl hover:shadow-blue-500/5 active:scale-[0.995]"
              >
                <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 relative">
                  <UploadCloud size={44} className="text-blue-500" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white"></div>
                </div>
                <span className="text-2xl font-bold text-gray-900 mb-2">Drop local file</span>
                <span className="text-sm text-gray-400 font-medium tracking-tight">Supporting PDF and Images</span>
                
                <div className="mt-10 px-8 py-3 bg-gray-900 text-white text-sm font-bold rounded-2xl group-hover:bg-blue-600 transition-colors shadow-lg shadow-gray-200">
                  Select Document
                </div>
                
                <input 
                   type="file" 
                   accept="image/jpeg, image/png, image/webp, application/pdf" 
                   className="hidden" 
                   onChange={handleFileUpload} 
                />
              </label>

              <HubWizard />
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
