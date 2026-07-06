import React from 'react';
import { TableProperties, ArrowRight, Table } from 'lucide-react';
import { TableDashboardStats } from '../../utils/dashboardUtils';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';
import { WidgetEmpty } from '../../components/dashboard/WidgetEmpty';

interface TableDashboardWidgetProps {
  tableStats: TableDashboardStats;
  onViewTablesClick: () => void;
  onDocClick: (docId: string) => void;
}

export function TableDashboardWidget({ 
  tableStats, 
  onViewTablesClick,
  onDocClick
}: TableDashboardWidgetProps) {
  const hasTables = tableStats.tablesCount > 0;

  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="Table Extraction" 
        subtitle="Analyzed structured sheet matrix summary"
        icon={<TableProperties className="text-teal-500 w-5 h-5" />}
        actions={
          <button 
            onClick={onViewTablesClick}
            className="text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline uppercase tracking-wider"
          >
            View Archive
          </button>
        }
      />
      <WidgetBody className="mt-2">
        {hasTables ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Quick Counters */}
            <div className="md:col-span-5 grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Tables</span>
                <span className="text-2xl font-black text-gray-900">{tableStats.tablesCount}</span>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Documents</span>
                <span className="text-2xl font-black text-gray-900">{tableStats.documentsCount}</span>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-between col-span-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Excel Sheets</span>
                <span className="text-xl font-black text-teal-600">{tableStats.sheetsCount} sheets</span>
              </div>
            </div>

            {/* Recently Extracted */}
            <div className="md:col-span-7 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-50 pb-2">
                  Recently Extracted Tables
                </h4>
                <div className="space-y-2">
                  {tableStats.recentTables.map(t => (
                    <div 
                      key={t._id} 
                      onClick={() => onDocClick(t._id)}
                      className="p-3 bg-gray-50 hover:bg-white border border-gray-100 hover:border-gray-200 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Table className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        <span className="text-xs font-bold text-gray-900 truncate pr-2">{t.name}</span>
                      </div>
                      <span className="text-[9px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md shrink-0">
                        {t.sheets} sheets
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <button 
                onClick={onViewTablesClick}
                className="mt-4 flex items-center justify-center gap-1.5 py-3 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold rounded-xl transition-colors w-full"
              >
                Open Table Manager
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <WidgetEmpty 
            message="No tables have been extracted from PDF files yet."
            icon={<TableProperties className="w-10 h-10 text-gray-200" />}
          />
        )}
      </WidgetBody>
    </DashboardWidget>
  );
}
