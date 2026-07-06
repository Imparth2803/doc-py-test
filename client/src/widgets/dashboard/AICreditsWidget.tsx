import React from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';
import { WidgetActions } from '../../components/dashboard/WidgetActions';

interface AICreditsWidgetProps {
  aiUnits: number;
  aiCredits: number;
  estDocsLeft: number;
  onUpgradeClick: () => void;
}

export function AICreditsWidget({ 
  aiUnits, 
  aiCredits, 
  estDocsLeft, 
  onUpgradeClick 
}: AICreditsWidgetProps) {
  return (
    <DashboardWidget className="p-6 w-full h-full justify-between">
      <div>
        <WidgetHeader 
          title="AI Energy Balance" 
          icon={<Zap className="text-yellow-500 w-5 h-5" />}
        />
        <WidgetBody className="mt-2">
          <div className="flex items-end justify-between mb-3">
            <div>
              <span className="text-3xl font-black text-gray-900">₹{aiCredits.toFixed(2)}</span>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Resource Value</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-blue-600">~{estDocsLeft} Docs</span>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Estimate</p>
            </div>
          </div>

          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-4">
            <div 
              className="bg-yellow-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, (aiUnits / 1000) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">
            <span>{aiUnits} Units Left</span>
            <span>1,000 Cap</span>
          </div>
        </WidgetBody>
      </div>

      <WidgetActions className="mt-8">
        <button
          onClick={onUpgradeClick}
          className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-sm"
        >
          Top Up AI Credits
          <ArrowRight size={12} />
        </button>
      </WidgetActions>
    </DashboardWidget>
  );
}
