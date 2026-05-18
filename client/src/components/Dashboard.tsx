import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Plus, 
  FileText, 
  ShieldAlert, 
  Calendar, 
  Zap, 
  ArrowRight, 
  CreditCard,
  TrendingDown,
  ChevronRight,
  Sparkles,
  PieChart,
  CheckCircle2,
  TreePine,
  Users,
  Search
} from 'lucide-react';
import { RECOMMENDED_DOCS } from '../constants';
import { TopNav } from './TopNav';
import { motion } from 'motion/react';
import { isValidMetadata } from '../lib/utils';

export function Dashboard() {
  const { 
    documents, 
    aiUnits, 
    aiCredits, 
    aiUnitsUsed, 
    aiCreditsUsed,
    goToUpload, 
    goToArchive,
    goToTree,
    goToEntity,
    setPricingOpen
  } = useApp();

  const isComplete = (docDef: typeof RECOMMENDED_DOCS[0]) => {
    return documents.some(d => {
      const textMatch = [d.name, d.docType, ...d.tags].join(' ').toLowerCase();
      return docDef.tagsMatch.some(tm => textMatch.includes(tm));
    });
  };

  const missingDocs = RECOMMENDED_DOCS.filter(d => !isComplete(d));
  const completionRate = Math.round(((RECOMMENDED_DOCS.length - missingDocs.length) / RECOMMENDED_DOCS.length) * 100);

  const upcomingReminders = documents
    .filter(d => d.metadata?.expiryDate && isValidMetadata(d.metadata.expiryDate))
    .map(d => ({
      ...d,
      daysLeft: Math.ceil((new Date(d.metadata!.expiryDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    }))
    .filter(d => d.daysLeft > 0 && d.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const estDocsLeft = Math.floor(aiUnits / 6.5);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <TopNav activeTab="hub" />
      
      <main className="max-w-7xl mx-auto px-6 py-10">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Vault Overview</h1>
            <p className="text-gray-500 font-medium tracking-tight">Welcome back! Your digital universe is {completionRate}% synchronized.</p>
          </div>
          <button 
            onClick={goToUpload}
            className="bg-gray-900 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-600 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gray-200"
          >
            <Plus size={20} strokeWidth={3} />
            Quick Upload
          </button>
        </header>

        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {/* Main Stat: AI Credits */}
          <motion.div variants={item} className="lg:col-span-2 bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm relative overflow-hidden group cursor-pointer hover:border-blue-200 transition-all" onClick={() => setPricingOpen(true)}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50/30 rounded-bl-full -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-500"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <Zap size={24} />
                </div>
                <div>
                   <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">AI Resource Ledger</h3>
                   <p className="text-lg font-bold text-gray-900 mt-1">{aiUnits} Units Available</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-8">
                <div>
                  <span className="text-5xl font-black text-gray-900">₹{aiCredits.toFixed(2)}</span>
                  <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-wide">Pending Balance</p>
                </div>
                <div className="h-12 w-px bg-gray-100 hidden sm:block"></div>
                <div>
                  <span className="text-2xl font-bold text-blue-600">~{estDocsLeft} Docs</span>
                  <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wide">Capacity Estimate</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button 
                  onClick={(e) => { e.stopPropagation(); setPricingOpen(true); }}
                  className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors"
                >
                  Top Up AI Credits
                </button>
                <div className="flex flex-col justify-center">
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Used to date</p>
                   <p className="text-sm font-black text-gray-600">₹{aiCreditsUsed.toFixed(2)}</p>
                </div>
              </div>
              
              {aiUnits < 200 && (
                <div className="mt-6 flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-bold animate-pulse">
                   <ShieldAlert size={14} /> Low Balance Nudge: Complex OCR and Multilingual analysis will be disabled soon.
                </div>
              )}
            </div>
          </motion.div>

          {/* Doc Count */}
          <motion.div variants={item} className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm hover:shadow-md transition-shadow group cursor-pointer" onClick={goToArchive}>
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 mb-6 group-hover:bg-green-500 group-hover:text-white transition-all">
              <FileText size={24} />
            </div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Total Artifacts</h3>
            <div className="flex items-end justify-between mt-4">
              <span className="text-5xl font-black text-gray-900">{documents.length}</span>
              <div className="text-right">
                <div className="flex items-center gap-1 text-green-600 text-xs font-bold mb-1">
                   <TrendingDown size={14} className="rotate-180" /> +{documents.filter(d => d.date.includes('2026')).length}
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">This Year</span>
              </div>
            </div>
          </motion.div>

          {/* Sync Progress */}
          <motion.div variants={item} className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm hover:shadow-md transition-shadow group cursor-pointer" onClick={goToUpload}>
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-6 group-hover:bg-purple-500 group-hover:text-white transition-all">
              <Sparkles size={24} />
            </div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Vault Integrity</h3>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-4xl font-black text-gray-900">{completionRate}%</span>
                <span className="text-xs font-bold text-purple-600 uppercase">{missingDocs.length} Missing</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  className="bg-purple-500 h-full rounded-full"
                />
              </div>
            </div>
          </motion.div>

          {/* DMS Quick Links */}
          <motion.div variants={item} className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-6">DMS Navigator</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={goToTree}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-50 rounded-2xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all group"
              >
                <TreePine size={24} />
                <span className="text-[10px] font-black uppercase">Tree View</span>
              </button>
              <button 
                onClick={goToEntity}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-purple-50 rounded-2xl text-purple-600 hover:bg-purple-600 hover:text-white transition-all group"
              >
                <Users size={24} />
                <span className="text-[10px] font-black uppercase">Entities</span>
              </button>
            </div>
            <button 
              onClick={goToArchive}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 transition-all text-xs font-bold"
            >
              <Search size={14} /> Global Archive Search
            </button>
          </motion.div>

          {/* Life Reminders */}
          <motion.div variants={item} className="lg:col-span-2 bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm cursor-pointer hover:border-orange-200 transition-all" onClick={goToArchive}>
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                   <Calendar size={20} />
                 </div>
                 <h3 className="font-bold text-gray-900">30-Day Critical Reminders</h3>
               </div>
               <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-black">
                  {upcomingReminders.length}
               </div>
            </div>

            <div className="space-y-4">
              {upcomingReminders.length > 0 ? upcomingReminders.map(rem => (
                <div key={rem.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl hover:border-orange-200 transition-colors">
                   <div className="flex items-center gap-4">
                     <div className={`w-2 h-2 rounded-full ${rem.daysLeft < 30 ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`}></div>
                     <div>
                       <p className="text-sm font-bold text-gray-900">{rem.name}</p>
                       <p className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">Expires: {rem.metadata.expiryDate}</p>
                     </div>
                   </div>
                   <div className="text-right">
                      <span className={`text-sm font-black ${rem.daysLeft < 30 ? 'text-red-500' : 'text-gray-900'}`}>{rem.daysLeft}</span>
                      <span className="text-[10px] text-gray-400 uppercase font-bold ml-1">Days left</span>
                   </div>
                </div>
              )) : (
                <div className="h-[140px] flex flex-col items-center justify-center text-center grey-stack">
                   <CheckCircle2 size={32} className="text-green-500 mb-2 opacity-20" />
                   <p className="text-sm text-gray-400 font-medium">All clear! No upcoming expirations found.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* AI Economy Metrics */}
          <motion.div variants={item} className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 rounded-[32px] p-8 shadow-xl text-white relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent)]"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-blue-400 backdrop-blur-md">
                     <TrendingDown size={20} className="rotate-180" />
                   </div>
                   <h3 className="font-bold">Optimization Insights</h3>
                 </div>
                 <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg text-xs font-bold border border-green-500/30">
                    Pro Plan Active
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                   <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Lifetime Productivity</p>
                   <p className="text-3xl font-black">{aiUnitsUsed.toLocaleString()} <span className="text-xs font-bold text-white/40">Units</span></p>
                </div>
                <div>
                   <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Total AI investment</p>
                   <p className="text-3xl font-black">₹{aiCreditsUsed.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                 <Sparkles size={16} className="text-yellow-400" />
                 <p className="text-xs text-white/70 leading-relaxed">
                    You've saved roughly <span className="text-white font-bold">24 hours</span> of manual filing time this month by leveraging our neural auto-categorization system.
                 </p>
              </div>
            </div>
          </motion.div>

          {/* Missing Essentials */}
          <motion.div variants={item} className="lg:col-span-3 bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm">
             <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-3">
                 <h3 className="font-bold text-gray-900">Missing Life Essentials</h3>
                 <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase">{missingDocs.length} Docs</span>
               </div>
               <button onClick={goToUpload} className="text-xs font-bold text-blue-600 hover:underline uppercase tracking-widest">Start Scanning</button>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               {missingDocs.slice(0, 6).map(doc => (
                 <div key={doc._id} className="flex flex-col p-4 bg-gray-50/50 border border-gray-100 rounded-2xl group hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                       <ShieldAlert size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                       <Plus size={14} className="text-gray-400" />
                    </div>
                    <p className="text-xs font-bold text-gray-900 line-clamp-1">{doc.title}</p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tight">{doc.category}</p>
                 </div>
               ))}
             </div>
          </motion.div>

          {/* Profile Quick Link */}
          <motion.div variants={item} className="bg-blue-600 rounded-[32px] p-8 shadow-lg shadow-blue-500/20 text-white flex flex-col justify-between">
             <div>
                <h3 className="text-xl font-bold leading-tight mb-2">Share Your Vault</h3>
                <p className="text-xs text-blue-100 opacity-80 leading-relaxed">Securely grant temporary access to family members or legal advisors.</p>
             </div>
             <button className="mt-6 w-full py-3 bg-white text-blue-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors">
                Manage Access
                <ArrowRight size={14} />
             </button>
          </motion.div>
        </motion.div>

        {/* Floating Credit Warning */}
        {aiUnits < 300 && (
           <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-6 right-6 z-[60]"
           >
              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-2xl max-w-sm flex items-center gap-4 border-l-4 border-l-orange-500 overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 rounded-bl-full -mr-10 -mt-10"></div>
                 <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 shrink-0">
                    <Zap size={24} />
                 </div>
                 <div className="relative z-10 pr-6">
                    <p className="text-sm font-black text-gray-900 leading-tight mb-1">AI Energy is Depleting</p>
                    <p className="text-[11px] text-gray-500 font-medium">You only have ~{estDocsLeft} documents worth of processing left.</p>
                    <button 
                      onClick={() => setPricingOpen(true)}
                      className="mt-3 text-xs font-bold text-blue-600 hover:underline uppercase tracking-widest flex items-center gap-1"
                    >
                      Recharge Now <ArrowRight size={12} />
                    </button>
                 </div>
              </div>
           </motion.div>
        )}
      </main>
    </div>
  );
}
