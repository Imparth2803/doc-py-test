import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { Document } from '../../types';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';
import { WidgetEmpty } from '../../components/dashboard/WidgetEmpty';

interface ProcessingQueueWidgetProps {
  processingDocs: Document[];
  completedCount: number;
  failedCount: number;
}

export function ProcessingQueueWidget({ 
  processingDocs, 
  completedCount, 
  failedCount 
}: ProcessingQueueWidgetProps) {
  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="Active Processing Operations" 
        subtitle={`Jobs queued: ${processingDocs.length}`}
        icon={<Clock className="text-blue-500 w-5 h-5" />}
        actions={
          <div className="flex gap-2">
            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border border-green-100">
              Done: {completedCount}
            </span>
            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border border-red-100">
              Failed: {failedCount}
            </span>
          </div>
        }
      />
      <WidgetBody className="mt-2">
        <div className="space-y-3">
          {processingDocs.length > 0 ? processingDocs.map(doc => (
            <div 
              key={doc._id} 
              className="flex items-center justify-between p-4 bg-blue-50/20 border border-blue-100/30 rounded-2xl hover:bg-blue-50/30 transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin shrink-0"></div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-gray-900 truncate">{doc.name}</p>
                  <p className="text-[9px] text-blue-500 uppercase font-black tracking-widest mt-0.5">
                    {doc.status === 'DECRYPTED' ? 'Pending Analysis' : 'Neural Extraction Running'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100/30 uppercase tracking-widest shrink-0">
                {doc.status}
              </span>
            </div>
          )) : (
            <WidgetEmpty 
              message="No documents currently processing. All queues are clear."
              icon={<CheckCircle2 className="w-10 h-10 text-green-500/20" />}
            />
          )}
        </div>
      </WidgetBody>
    </DashboardWidget>
  );
}
