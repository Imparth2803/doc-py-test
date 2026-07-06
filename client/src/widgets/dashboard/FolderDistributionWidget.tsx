import React from 'react';
import { PieChart } from 'lucide-react';
import { FolderDistribution } from '../../utils/dashboardUtils';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';
import { WidgetEmpty } from '../../components/dashboard/WidgetEmpty';

interface FolderDistributionWidgetProps {
  distribution: FolderDistribution[];
}

export function FolderDistributionWidget({ distribution }: FolderDistributionWidgetProps) {
  const hasData = distribution.length > 0;

  const getColorClass = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-teal-500',
      'bg-red-500'
    ];
    return colors[index % colors.length];
  };

  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="Folder Distribution" 
        subtitle="Overview of document category allocation"
        icon={<PieChart className="text-purple-500 w-5 h-5" />}
      />
      <WidgetBody className="mt-2">
        {hasData ? (
          <div className="space-y-4">
            {distribution.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-gray-800 font-bold">{item.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-900 font-black">{item.percentage}%</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-400 font-bold">{item.count} docs</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${getColorClass(idx)}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <WidgetEmpty 
            message="No folder distribution stats available."
            icon={<PieChart className="w-10 h-10 text-gray-250" />}
          />
        )}
      </WidgetBody>
    </DashboardWidget>
  );
}
