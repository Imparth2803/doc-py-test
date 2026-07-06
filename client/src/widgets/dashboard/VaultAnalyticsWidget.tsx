import React from 'react';
import { Database, FolderOpen, Tag, HardDrive, Users, Table, FileText, Cpu } from 'lucide-react';
import { VaultAnalytics } from '../../utils/dashboardUtils';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';

interface VaultAnalyticsWidgetProps {
  analytics: VaultAnalytics;
}

export function VaultAnalyticsWidget({ analytics }: VaultAnalyticsWidgetProps) {
  const stats = [
    { label: 'Documents', value: analytics.documentsCount, icon: FileText, color: 'text-blue-500' },
    { label: 'Folders', value: analytics.foldersCount, icon: FolderOpen, color: 'text-green-500' },
    { label: 'Categories', value: analytics.categoriesCount, icon: Tag, color: 'text-purple-500' },
    { label: 'Storage Used', value: analytics.storageUsed, icon: HardDrive, color: 'text-orange-500' },
    { label: 'Entities', value: analytics.entitiesCount, icon: Users, color: 'text-red-500' },
    { label: 'Extracted Tables', value: analytics.tablesCount, icon: Table, color: 'text-teal-500' },
    { label: 'Summaries', value: analytics.summariesCount, icon: FileText, color: 'text-indigo-500' },
    { label: 'AI Units Used', value: analytics.aiUnitsUsed, icon: Cpu, color: 'text-amber-500' }
  ];

  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="Vault Analytics" 
        subtitle="High-level structural vault statistics"
        icon={<Database className="text-blue-500 w-5 h-5" />}
      />
      <WidgetBody className="mt-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          {stats.map((stat, idx) => {
            const isLast = idx === stats.length - 1;
            return (
              <div 
                key={idx} 
                className={`p-4 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col justify-between h-[100px] hover:bg-white hover:shadow-xs transition-all duration-300 ${
                  isLast ? 'col-span-2 sm:col-span-3' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{stat.label}</p>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900 tracking-tight leading-none">
                    {stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </WidgetBody>
    </DashboardWidget>
  );
}
