import React from 'react';
import { useApp } from '../context/AppContext';
import { LayoutGrid, Search, Plus, Archive, TreePine, Users, LogOut, Zap, FileBox } from 'lucide-react';
import { cn } from '../lib/utils';

export function TopNav({ activeTab }: { activeTab?: 'hub' | 'archive' | 'tree' | 'entity' }) {
  const { goToDashboard, goToUpload, goToArchive, goToTree, goToEntity, logout, currentView, aiUnits, aiCredits, setPricingOpen } = useApp();

  return (
    <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-xl sticky top-0 z-50 w-full">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={goToDashboard}>
          <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center text-white group-hover:scale-105 transition-all duration-500 shadow-xl shadow-gray-200">
             <FileBox size={22} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-black tracking-tighter text-gray-900 leading-none">AUTO-FILE <span className="text-blue-600">AI</span></span>
        </div>
        
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <NavButton 
            active={currentView === 'dashboard'} 
            onClick={goToDashboard}
            icon={<LayoutGrid size={18} />} 
            label="Dashboard" 
          />
          <NavButton 
            active={currentView === 'archive'} 
            onClick={goToArchive}
            icon={<Search size={18} />} 
            label="Search & Discovery" 
          />
          <NavButton 
            active={currentView === 'tree'} 
            onClick={goToTree}
            icon={<TreePine size={18} />} 
            label="Navigation Tree" 
          />
          <NavButton 
            active={currentView === 'entity'} 
            onClick={goToEntity}
            icon={<Users size={18} />} 
            label="Entity Map" 
          />
        </nav>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-4 bg-gray-50/80 px-4 py-2 rounded-2xl border border-gray-100 backdrop-blur-sm group cursor-pointer hover:border-blue-200 transition-all">
           <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Energy Balance</span>
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
                    <Zap size={14} className="text-blue-500" />
                    {aiUnits} Units
                 </div>
                 <div className="h-4 w-px bg-gray-200"></div>
                 <span className="text-sm font-bold text-gray-900 leading-none">₹{aiCredits.toFixed(2)}</span>
              </div>
           </div>
           <div 
             onClick={() => setPricingOpen(true)}
             className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-100 group-hover:scale-110 transition-transform"
           >
              <Plus size={16} className="text-blue-600" />
           </div>
        </div>

        <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2", 
        active 
          ? "bg-blue-50 text-blue-600 shadow-sm shadow-blue-500/5" 
          : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
