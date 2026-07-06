import React, { useMemo } from 'react';
import { ShieldAlert, ArrowUpRight, CheckCircle, Info, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { RECOMMENDED_DOCS } from '../../constants';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';

interface MissingEssentialsWidgetProps {
  completionRate: number;
  missingDocs: typeof RECOMMENDED_DOCS;
  onUploadClick: () => void;
  onUploadedClick: (docType: string) => void;
}

const PRIORITY_ORDER = { 'Critical': 3, 'High': 2, 'Medium': 1 };

export function MissingEssentialsWidget({ 
  completionRate, 
  missingDocs, 
  onUploadClick,
  onUploadedClick
}: MissingEssentialsWidgetProps) {
  
  const isDocUploaded = (docId: string) => {
    return !missingDocs.some(md => md.id === docId);
  };

  // Sort RECOMMENDED_DOCS by:
  // 1. Missing first
  // 2. Priority weight descending
  // 3. Uploaded last
  const sortedDocs = useMemo(() => {
    return [...RECOMMENDED_DOCS].sort((a, b) => {
      const aUploaded = isDocUploaded(a.id);
      const bUploaded = isDocUploaded(b.id);

      // Missing first
      if (aUploaded !== bUploaded) {
        return aUploaded ? 1 : -1;
      }

      // Priority descending
      const aWeight = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] || 0;
      const bWeight = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] || 0;
      if (aWeight !== bWeight) {
        return bWeight - aWeight;
      }

      // Alphabetical secondary sort
      return a.title.localeCompare(b.title);
    });
  }, [missingDocs]);

  const totalDocsCount = RECOMMENDED_DOCS.length;
  const missingCount = missingDocs.length;
  const availableCount = totalDocsCount - missingCount;
  const isComplete = missingCount === 0;

  const getPriorityBadgeStyles = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'High':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="Missing Life Essentials" 
        subtitle="Critical, High, and Medium priority documents check"
        icon={<ShieldAlert className="text-blue-600 w-5 h-5" />}
        actions={
          !isComplete && (
            <button 
              onClick={onUploadClick}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline uppercase tracking-wider"
            >
              Start Scanning
            </button>
          )
        }
      />
      <WidgetBody className="mt-4">
        {/* Progress & Summary Bar */}
        <div className="mb-6 bg-gray-50/50 border border-gray-100 p-4 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Completeness Rate</span>
            <span className="text-sm font-black text-gray-900">{completionRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div 
              className={cn(
                "h-2.5 rounded-full transition-all duration-500",
                completionRate === 100 ? "bg-green-500" : "bg-blue-600"
              )}
              style={{ width: `${completionRate}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200/50 text-left">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Available Documents</p>
              <p className="text-xs font-bold text-gray-900 leading-relaxed">
                {availableCount} of {totalDocsCount} essential files uploaded
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Recommendations</p>
              <p className={cn("text-xs font-bold leading-relaxed", isComplete ? "text-green-600" : "text-blue-600")}>
                {isComplete 
                  ? "All essential files present" 
                  : `${missingCount} ${missingCount === 1 ? 'file' : 'files'} still recommended`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Card States or Completion Success View */}
        {isComplete ? (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-green-50/15 border border-green-100/50 rounded-2xl my-2">
            <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center text-green-600 mb-4 shadow-sm">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-gray-900 mb-1">🎉 Vault Complete!</h4>
            <p className="text-xs text-gray-500 max-w-sm">
              Your vault contains all recommended life essential documents.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {sortedDocs.map(doc => {
              const uploaded = isDocUploaded(doc.id);
              return (
                <div 
                  key={doc.id}
                  onClick={() => {
                    if (uploaded) {
                      onUploadedClick(doc.id);
                    } else {
                      onUploadClick();
                    }
                  }}
                  className={cn(
                    "p-4 border rounded-2xl transition-all flex flex-col justify-between h-[115px] group relative cursor-pointer",
                    uploaded 
                      ? 'bg-green-50/15 border-green-150/40 hover:bg-green-50/20 hover:border-green-200' 
                      : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-gray-50/20 hover:shadow-xs'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                      uploaded 
                        ? 'bg-green-100 text-green-800 border-green-200/50' 
                        : getPriorityBadgeStyles(doc.priority)
                    )}>
                      {uploaded ? 'Uploaded' : doc.priority}
                    </span>
                    {uploaded ? (
                      <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all shrink-0" />
                    )}
                  </div>
                  <div>
                    <h4 className={cn("text-xs font-bold truncate", uploaded ? "text-gray-600" : "text-gray-900")}>
                      {doc.title}
                    </h4>
                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider mt-1 truncate">
                      {doc.category}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </WidgetBody>
    </DashboardWidget>
  );
}
