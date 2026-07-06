import React from 'react';
import { FileText, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Document } from '../../types';
import { formatUploadTime } from '../../utils/dashboardUtils';
import { downloadDocument } from '../../lib/shareUtils';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';
import { WidgetEmpty } from '../../components/dashboard/WidgetEmpty';

interface RecentDocumentsWidgetProps {
  recentDocs: Document[];
  onViewAll: () => void;
  onDocClick: (docId: string) => void;
}

export function RecentDocumentsWidget({ recentDocs, onViewAll, onDocClick }: RecentDocumentsWidgetProps) {
  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="Recent Documents" 
        subtitle="List of top 5 recently added documents"
        icon={<FileText className="text-green-500 w-5 h-5" />}
        actions={
          <button 
            onClick={onViewAll}
            className="text-xs font-bold text-green-600 hover:text-green-700 hover:underline uppercase tracking-wider"
          >
            View All
          </button>
        }
      />
      <WidgetBody className="mt-2">
        <div className="space-y-3">
          {recentDocs.length > 0 ? recentDocs.map(doc => (
            <div 
              key={doc._id} 
              onClick={() => onDocClick(doc._id)}
              className="flex items-center justify-between p-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl hover:border-blue-200 hover:bg-white transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center text-green-600 shrink-0 group-hover:bg-green-500 group-hover:text-white transition-colors">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-gray-900 truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{doc.vaultCategory || 'Uploads'}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{formatUploadTime(doc.date)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {doc.previewUrl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadDocument(doc); }}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0",
                  doc.status === 'COMPLETED' ? 'bg-green-50/50 text-green-600 border-green-150' :
                  doc.status === 'FAILED' ? 'bg-red-50/50 text-red-600 border-red-150' :
                  'bg-blue-50/50 text-blue-600 border-blue-150'
                )}>
                  {doc.status}
                </span>
              </div>
            </div>
          )) : (
            <WidgetEmpty 
              message="Your document vault is currently empty."
              icon={<FileText className="w-10 h-10 text-gray-250" />}
            />
          )}
        </div>
      </WidgetBody>
    </DashboardWidget>
  );
}
