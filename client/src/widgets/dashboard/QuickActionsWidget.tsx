import React from 'react';
import { Plus, Search, TreePine, Users, TableProperties, Clock, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';

interface QuickActionsWidgetProps {
  onAction: (action: string) => void;
}

export function QuickActionsWidget({ onAction }: QuickActionsWidgetProps) {
  const actions = [
    { id: 'upload', label: 'Scan & Upload', icon: Plus, color: 'bg-blue-50 text-blue-600 hover:bg-blue-600' },
    { id: 'archive', label: 'Global Archive', icon: Search, color: 'bg-green-50 text-green-600 hover:bg-green-600' },
    { id: 'tree', label: 'Vault Tree', icon: TreePine, color: 'bg-purple-50 text-purple-600 hover:bg-purple-600' },
    { id: 'entity', label: 'GLiNER Entities', icon: Users, color: 'bg-orange-50 text-orange-600 hover:bg-orange-600' },
    { id: 'tables', label: 'Extracted Tables', icon: TableProperties, color: 'bg-teal-50 text-teal-600 hover:bg-teal-600' },
    { id: 'timeline', label: 'Workflow Logs', icon: Clock, color: 'bg-red-50 text-red-600 hover:bg-red-600' }
  ];

  return (
    <DashboardWidget colSpan="col-span-12" className="p-5">
      <WidgetHeader 
        title="DMS Navigator" 
        subtitle="Quick access toolbar for workspace discovery"
        icon={<Sparkles className="text-purple-500 w-5 h-5" />}
      />
      <WidgetBody>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl transition-all hover:text-white group border border-transparent hover:border-gray-150 hover:shadow-sm active:scale-[0.98]",
                action.color
              )}
            >
              <action.icon size={22} className="group-hover:scale-105 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-wider">{action.label}</span>
            </button>
          ))}
        </div>
      </WidgetBody>
    </DashboardWidget>
  );
}
