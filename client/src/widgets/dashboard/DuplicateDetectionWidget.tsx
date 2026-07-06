import React from 'react';
import { Copy, AlertTriangle } from 'lucide-react';
import { DuplicateGroup } from '../../utils/dashboardUtils';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';
import { WidgetEmpty } from '../../components/dashboard/WidgetEmpty';

interface DuplicateDetectionWidgetProps {
  duplicates: DuplicateGroup[];
  onDocClick: (docId: string) => void;
}

export function DuplicateDetectionWidget({ 
  duplicates,
  onDocClick
}: DuplicateDetectionWidgetProps) {
  const hasDuplicates = duplicates.length > 0;

  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="Potential Duplicates" 
        subtitle="Identical filenames or sizes detected"
        icon={<Copy className="text-orange-500 w-5 h-5" />}
      />
      <WidgetBody className="mt-2">
        {hasDuplicates ? (
          <div className="space-y-3">
            {duplicates.slice(0, 3).map((group, idx) => (
              <div 
                key={idx}
                className="p-3 bg-orange-50/20 border border-orange-100/30 rounded-2xl flex flex-col justify-between gap-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 overflow-hidden">
                    <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 truncate leading-snug">{group.name}</h4>
                      {group.size && <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Size: {group.size}</p>}
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md shrink-0">
                    {group.count} copies
                  </span>
                </div>
                
                <div className="mt-1 space-y-1">
                  {group.docs.map(doc => (
                    <div 
                      key={doc._id}
                      onClick={() => onDocClick(doc._id)}
                      className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>📁 {doc.folder || 'Uploads'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {duplicates.length > 3 && (
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mt-1">
                + {duplicates.length - 3} more duplicate groups
              </p>
            )}
          </div>
        ) : (
          <WidgetEmpty 
            message="No duplicate files or matching names detected."
            icon={<Copy className="w-10 h-10 text-gray-250" />}
          />
        )}
      </WidgetBody>
    </DashboardWidget>
  );
}
