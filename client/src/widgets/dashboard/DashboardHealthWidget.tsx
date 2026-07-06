import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { SystemHealth } from '../../utils/dashboardUtils';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';

interface DashboardHealthWidgetProps {
  health: SystemHealth;
}

export function DashboardHealthWidget({ health }: DashboardHealthWidgetProps) {
  const checkMetrics = [
    { label: 'OCR Success', value: `${health.ocrSuccessRate}%`, color: 'text-green-600 bg-green-50/50' },
    { label: 'AI Success', value: `${health.aiSuccessRate}%`, color: 'text-blue-600 bg-blue-50/50' },
    { label: 'Table Extraction', value: `${health.tableSuccessRate}%`, color: 'text-teal-600 bg-teal-50/50' },
    { label: 'Preview Availability', value: `${health.previewRate}%`, color: 'text-purple-600 bg-purple-50/50' }
  ];

  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="System Health Overview" 
        subtitle="Operational accuracy and parsing rates"
        icon={<ShieldCheck className="text-green-500 w-5 h-5" />}
      />
      <WidgetBody className="mt-2">
        <div className="grid grid-cols-2 gap-4 mb-5">
          {checkMetrics.map((m, idx) => (
            <div key={idx} className="p-3 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{m.label}</span>
              <span className={`text-lg font-black mt-1 ${m.color.split(' ')[0]}`}>{m.value}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-50 pt-4 flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-widest">
          <span>Processed: <span className="text-gray-900">{health.completed}</span></span>
          <span>Queued: <span className="text-blue-600">{health.processing}</span></span>
          <span>Errors: <span className="text-red-500">{health.failed}</span></span>
        </div>
      </WidgetBody>
    </DashboardWidget>
  );
}
