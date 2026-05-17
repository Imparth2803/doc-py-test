import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { RECOMMENDED_DOCS } from '../constants';

export function HubWizard() {
  const { documents, goToUpload } = useApp();

  const isComplete = (docDef: typeof RECOMMENDED_DOCS[0]) => {
    return documents.some(d => {
      // Very basic matching based on folder and some tag or docType overlap
      if (d.folder !== docDef.category) return false;
      const textMatch = [d.name, d.docType, ...d.tags].join(' ').toLowerCase();
      return docDef.tagsMatch.some(tm => textMatch.includes(tm));
    });
  };

  const completedCount = RECOMMENDED_DOCS.filter(isComplete).length;
  const progressPercent = Math.round((completedCount / RECOMMENDED_DOCS.length) * 100);

  return (
    <div className="bg-white border border-gray-100 rounded-[40px] p-8 sm:p-10 w-full max-w-2xl mx-auto shadow-sm mt-12 relative overflow-hidden group">
       {/* Background Decoration */}
       <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>

       <div className="flex items-center justify-between mb-8 relative z-10">
         <div>
           <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Onboarding Progress</h3>
           <p className="text-sm text-gray-400 font-medium mt-1">Get your digital vault ready for the future.</p>
         </div>
         <div className="bg-blue-50 px-4 py-2 rounded-2xl text-center">
            <span className="text-2xl font-bold text-blue-600 leading-none block">{progressPercent}%</span>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1 block">Score</span>
         </div>
       </div>

       {/* Progress Bar */}
       <div className="w-full bg-gray-100 rounded-full h-3 mb-10 overflow-hidden p-0.5 border border-gray-50 relative z-10">
         <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1.5, ease: "circOut" }}
            className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full shadow-[0_0_10px_rgba(37,99,235,0.2)]"
         />
       </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
         {RECOMMENDED_DOCS.map(doc => {
           const complete = isComplete(doc);
           return (
             <div key={doc.id} className={`flex flex-col p-5 rounded-[24px] border transition-all duration-300 hover:shadow-md ${complete ? 'bg-white border-green-100 shadow-green-500/5' : 'bg-gray-50 border-gray-100 shadow-gray-500/5'}`}>
                <div className="flex items-center justify-between mb-3">
                   {complete ? (
                     <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                        <CheckCircle2 size={18} />
                     </div>
                   ) : (
                     <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-300">
                        <Circle size={18} />
                     </div>
                   )}
                   {!complete && (
                      <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider px-2 py-0.5 bg-orange-50 rounded-md">Missing</span>
                   )}
                </div>
                <div>
                   <p className={`font-bold text-[14px] leading-tight ${complete ? 'text-gray-900 line-through decoration-green-500/50 decoration-2' : 'text-gray-800'}`}>{doc.title}</p>
                   <p className="text-[11px] text-gray-400 font-medium mt-1">{doc.category}</p>
                </div>
             </div>
           )
         })}
       </div>
    </div>
  )
}
