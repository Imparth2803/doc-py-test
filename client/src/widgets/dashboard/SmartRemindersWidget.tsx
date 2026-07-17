import React, { useMemo, useState, useEffect } from 'react';
import { Bell, Calendar, ChevronRight, AlertCircle, Clock, CheckCircle2, RotateCcw, Check, EyeOff } from 'lucide-react';
import { Document } from '../../types';
import { useApp, PendingDocument } from '../../context/AppContext';
import { parseNormalizedDate } from '../../utils/dateParser';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';
import { WidgetEmpty } from '../../components/dashboard/WidgetEmpty';

interface SmartRemindersWidgetProps {
  documents: Document[];
}

const SOON_THRESHOLD_DAYS = 7;

interface ReminderItem {
  doc: Document;
  title: string;
  type: 'Payment Due' | 'Renewal' | 'Expiry';
  date: Date;
  dateStr: string;
  diffDays: number;
  status: 'overdue' | 'today' | 'tomorrow' | 'soon' | 'future';
  statusLabel: string;
  remainingText: string;
  category?: string;
  iconPrefix: string;
}

export function SmartRemindersWidget({ documents }: SmartRemindersWidgetProps) {
  const { setPendingDocument, updateDocumentReminder } = useApp();

  const [lastCompletedReminder, setLastCompletedReminder] = useState<{
    docId: string;
    title: string;
    status: 'COMPLETED' | 'DISMISSED';
    completedDate: string;
  } | null>(null);

  // Clear Undo banner after timeout
  useEffect(() => {
    if (lastCompletedReminder) {
      const timer = setTimeout(() => {
        setLastCompletedReminder(null);
      }, 6000); // 6 seconds
      return () => clearTimeout(timer);
    }
  }, [lastCompletedReminder]);

  const reminders = useMemo(() => {
    const list: ReminderItem[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    documents.forEach(doc => {
      const sFields = doc.metadata?.summaryFields || {};
      
      // Define check keys and types in priority order
      const checks: Array<{ keys: string[]; type: 'Payment Due' | 'Renewal' | 'Expiry'; icon: string }> = [
        { keys: ['Due Date', 'Bill Due Date'], type: 'Payment Due', icon: '💳' },
        { keys: ['Renewal Date'], type: 'Renewal', icon: '🔄' },
        { keys: ['Expiry Date', 'Policy End Date', 'Valid Until'], type: 'Expiry', icon: '🛂' }
      ];

      // Find the first matching field
      let foundDate: Date | null = null;
      let foundType: 'Payment Due' | 'Renewal' | 'Expiry' = 'Payment Due';
      let foundIcon = '📅';

      for (const check of checks) {
        for (const key of check.keys) {
          if (sFields[key]) {
            const parsed = parseNormalizedDate(sFields[key]);
            if (parsed) {
              foundDate = parsed;
              foundType = check.type;
              foundIcon = check.icon;
              break;
            }
          }
        }
        if (foundDate) break; // Priority match found
      }

      if (foundDate) {
        const targetDate = new Date(foundDate.getFullYear(), foundDate.getMonth(), foundDate.getDate());
        const targetDateStr = targetDate.toISOString().split('T')[0];

        // Skip generating if it is already completed/dismissed for this targetDateStr
        if (doc.reminderState && doc.reminderState.status !== 'ACTIVE') {
          if (doc.reminderState.completedDate === targetDateStr) {
            return; // Skip this reminder
          }
        }

        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let status: 'overdue' | 'today' | 'tomorrow' | 'soon' | 'future' = 'future';
        let statusLabel = '🟢 Future';
        let remainingText = '';

        // Determine status
        if (diffDays < 0) {
          status = 'overdue';
          statusLabel = '🔴 Overdue';
        } else if (diffDays === 0) {
          status = 'today';
          statusLabel = '🟠 Due Today';
        } else if (diffDays === 1) {
          status = 'tomorrow';
          statusLabel = '🟡 Due Tomorrow';
        } else if (diffDays <= SOON_THRESHOLD_DAYS) {
          status = 'soon';
          statusLabel = '🟡 Due Soon';
        } else {
          status = 'future';
          statusLabel = '🟢 Future';
        }

        // Determine type-specific text
        const absDays = Math.abs(diffDays);
        const dayLabel = absDays === 1 ? 'day' : 'days';

        if (status === 'overdue') {
          if (foundType === 'Expiry') {
            remainingText = `Expired ${absDays} ${dayLabel} ago`;
          } else if (foundType === 'Renewal') {
            remainingText = `Renewal overdue by ${absDays} ${dayLabel}`;
          } else {
            remainingText = `Overdue by ${absDays} ${dayLabel}`;
          }
        } else if (status === 'today') {
          if (foundType === 'Expiry') {
            remainingText = 'Expires Today';
          } else if (foundType === 'Renewal') {
            remainingText = 'Renewal Due Today';
          } else {
            remainingText = 'Due Today';
          }
        } else if (status === 'tomorrow') {
          if (foundType === 'Expiry') {
            remainingText = 'Expires Tomorrow';
          } else if (foundType === 'Renewal') {
            remainingText = 'Renewal Due Tomorrow';
          } else {
            remainingText = 'Due Tomorrow';
          }
        } else {
          // Soon or Future
          if (foundType === 'Expiry') {
            remainingText = `Expires in ${absDays} ${dayLabel}`;
          } else if (foundType === 'Renewal') {
            remainingText = `Renewal due in ${absDays} ${dayLabel}`;
          } else {
            remainingText = `Due in ${absDays} ${dayLabel}`;
          }
        }

        const dateStr = foundDate.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });

        list.push({
          doc,
          title: doc.name,
          type: foundType,
          date: foundDate,
          dateStr,
          diffDays,
          status,
          statusLabel,
          remainingText,
          category: doc.vaultCategory || 'Uploads',
          iconPrefix: foundIcon
        });
      }
    });

    // Sort by diffDays ascending (most overdue first, then today, tomorrow, soon, future)
    return list.sort((a, b) => a.diffDays - b.diffDays);
  }, [documents]);

  const handleReminderClick = (item: ReminderItem) => {
    const doc = item.doc;
    
    // Construct the PendingDocument payload to seamlessly load in the Review page
    const pending: PendingDocument = {
      file: new File([], doc.name),
      base64Data: doc.previewUrl || '',
      mimeType: doc.mimeType || 'application/pdf',
      serverUrl: doc.previewUrl,
      aiResult: {
        _id: doc._id,
        originalName: doc.originalName || doc.name,
        documentName: doc.name,
        mimeType: doc.mimeType || 'application/pdf',
        status: doc.status || 'COMPLETED',
        entities: doc.entities || [],
        docType: doc.docType || 'Document',
        tags: doc.tags || [],
        metadata: doc.metadata || {},
        pinnedFields: doc.pinnedFields || []
      } as any
    };

    console.log('[REMINDER CLICK] Redirecting to Review view for document:', doc._id);
    setPendingDocument(pending);
  };

  const handleComplete = async (item: ReminderItem) => {
    const docId = item.doc._id;
    const targetDate = new Date(item.date.getFullYear(), item.date.getMonth(), item.date.getDate());
    const targetDateStr = targetDate.toISOString().split('T')[0];

    setLastCompletedReminder({
      docId,
      title: item.title,
      status: 'COMPLETED',
      completedDate: targetDateStr
    });

    await updateDocumentReminder(docId, 'COMPLETED', targetDateStr);
  };

  const handleDismiss = async (item: ReminderItem) => {
    const docId = item.doc._id;
    const targetDate = new Date(item.date.getFullYear(), item.date.getMonth(), item.date.getDate());
    const targetDateStr = targetDate.toISOString().split('T')[0];

    setLastCompletedReminder({
      docId,
      title: item.title,
      status: 'DISMISSED',
      completedDate: targetDateStr
    });

    await updateDocumentReminder(docId, 'DISMISSED', targetDateStr);
  };

  const handleUndo = async () => {
    if (!lastCompletedReminder) return;
    const { docId } = lastCompletedReminder;

    await updateDocumentReminder(docId, 'ACTIVE', undefined);
    setLastCompletedReminder(null);
  };

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'bg-red-50 text-red-700 border-red-150';
      case 'today':
        return 'bg-orange-50 text-orange-700 border-orange-150';
      case 'tomorrow':
      case 'soon':
        return 'bg-yellow-50 text-yellow-800 border-yellow-150';
      default:
        return 'bg-green-50 text-green-700 border-green-150';
    }
  };

  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="Smart Reminders" 
        subtitle="AI-detected due dates and expiry events"
        icon={<Bell className="text-blue-500 w-5 h-5 animate-pulse" />}
      />
      <WidgetBody className="mt-2">
        {/* Undo Notification Banner */}
        {lastCompletedReminder && (
          <div className="mb-3 p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between text-xs text-blue-700 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600 stroke-[3px]" />
              <span>
                "{lastCompletedReminder.title}" marked as {lastCompletedReminder.status === 'COMPLETED' ? 'completed' : 'dismissed'}.
              </span>
            </div>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider text-[10px] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Undo
            </button>
          </div>
        )}

        {reminders.length > 0 ? (
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {reminders.map((item, idx) => (
              <div 
                key={idx}
                onClick={() => handleReminderClick(item)}
                className="p-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl hover:border-blue-200 hover:bg-white hover:shadow-sm transition-all group cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                    {item.iconPrefix}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors pr-2">
                      {item.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider bg-gray-100 px-1.5 py-0.5 rounded">
                        {item.type}
                      </span>
                      {item.category && (
                        <>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span className="text-[10px] text-gray-500 font-bold">
                            {item.category}
                          </span>
                        </>
                      )}
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        Due: {item.dateStr}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider ${getStatusBadgeStyles(item.status)}`}>
                    {item.remainingText}
                  </span>

                  {/* Actions Container */}
                  <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComplete(item);
                      }}
                      className="p-1.5 bg-white hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-xl text-gray-500 hover:text-green-600 transition-all shadow-xs flex items-center justify-center cursor-pointer"
                      title="Mark Completed"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5px]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(item);
                      }}
                      className="p-1.5 bg-white hover:bg-gray-100 border border-gray-200 hover:border-gray-400 rounded-xl text-gray-400 hover:text-gray-600 transition-all shadow-xs flex items-center justify-center cursor-pointer"
                      title="Dismiss Reminder"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <WidgetEmpty 
            message="🎉 You're all caught up! No upcoming reminders."
            icon={<CheckCircle2 className="w-10 h-10 text-green-500/80" />}
          />
        )}
      </WidgetBody>
    </DashboardWidget>
  );
}
