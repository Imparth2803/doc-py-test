import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, FileText, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useApp, ManualReminder } from '../../context/AppContext';
import { Document } from '../../types';
import { parseNormalizedDate } from '../../utils/dateParser';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';
import { cn } from '../../lib/utils';

interface CalendarRemindersWidgetProps {
  documents: Document[];
}

type ViewMode = 'day' | 'week' | 'month' | 'year';

interface UnifiedReminder {
  id: string;
  title: string;
  description?: string;
  date: Date;
  dateStr: string; // YYYY-MM-DD
  time?: string;
  type: 'Personal' | 'Document' | 'Payment' | 'Renewal' | 'Other';
  isManual: boolean;
  relatedDoc?: Document;
  iconPrefix: string;
}

export function CalendarRemindersWidget({ documents }: CalendarRemindersWidgetProps) {
  const { manualReminders, addManualReminder, deleteManualReminder, goToArchiveWithContext } = useApp();

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Modal State for adding a reminder
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDateStr, setNewDateStr] = useState('');
  const [newTimeStr, setNewTimeStr] = useState('');
  const [newType, setNewType] = useState<ManualReminder['type']>('Personal');
  const [newRelatedDocId, setNewRelatedDocId] = useState('');

  // Extract all reminders (documents + manual)
  const allReminders = useMemo(() => {
    const list: UnifiedReminder[] = [];

    // 1. Process Document Due/Expiry Dates
    documents.forEach(doc => {
      const sFields = doc.metadata?.summaryFields || {};
      const checks: Array<{ keys: string[]; type: 'Payment' | 'Renewal' | 'Expiry'; icon: string }> = [
        { keys: ['Due Date', 'Bill Due Date'], type: 'Payment', icon: '💳' },
        { keys: ['Renewal Date'], type: 'Renewal', icon: '🔄' },
        { keys: ['Expiry Date', 'Policy End Date', 'Valid Until'], type: 'Expiry', icon: '🛂' }
      ];

      let foundDate: Date | null = null;
      let foundType: 'Payment' | 'Renewal' | 'Expiry' = 'Payment';
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
        if (foundDate) break;
      }

      if (foundDate) {
        const yyyy = foundDate.getFullYear();
        const mm = String(foundDate.getMonth() + 1).padStart(2, '0');
        const dd = String(foundDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        list.push({
          id: `doc-${doc._id}-${foundType}`,
          title: doc.name,
          description: `AI-extracted ${foundType} deadline from document.`,
          date: foundDate,
          dateStr,
          type: foundType === 'Payment' ? 'Payment' : foundType === 'Renewal' ? 'Renewal' : 'Document',
          isManual: false,
          relatedDoc: doc,
          iconPrefix: foundIcon
        });
      }
    });

    // 2. Process Manual Reminders
    (manualReminders || []).forEach(mr => {
      const parsedDate = new Date(mr.date);
      if (!isNaN(parsedDate.getTime())) {
        const doc = mr.relatedDocId ? documents.find(d => d._id === mr.relatedDocId) : undefined;
        let icon = '📅';
        if (mr.type === 'Payment') icon = '💳';
        if (mr.type === 'Renewal') icon = '🔄';

        list.push({
          id: mr.id,
          title: mr.title,
          description: mr.description,
          date: parsedDate,
          dateStr: mr.date,
          time: mr.time,
          type: mr.type,
          isManual: true,
          relatedDoc: doc,
          iconPrefix: icon
        });
      }
    });

    return list;
  }, [documents, manualReminders]);

  // Navigate dates
  const handlePrev = () => {
    setCurrentDate(prev => {
      const copy = new Date(prev);
      if (viewMode === 'month') copy.setMonth(copy.getMonth() - 1);
      else if (viewMode === 'week') copy.setDate(copy.getDate() - 7);
      else if (viewMode === 'day') copy.setDate(copy.getDate() - 1);
      else if (viewMode === 'year') copy.setFullYear(copy.getFullYear() - 1);
      return copy;
    });
  };

  const handleNext = () => {
    setCurrentDate(prev => {
      const copy = new Date(prev);
      if (viewMode === 'month') copy.setMonth(copy.getMonth() + 1);
      else if (viewMode === 'week') copy.setDate(copy.getDate() + 7);
      else if (viewMode === 'day') copy.setDate(copy.getDate() + 1);
      else if (viewMode === 'year') copy.setFullYear(copy.getFullYear() + 1);
      return copy;
    });
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Month days builder
  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const cells = [];
    // Padding days from previous month
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null, date: null });
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      cells.push({ day, date: cellDate });
    }

    return cells;
  }, [currentDate]);

  // Selected Day Agenda Reminders
  const selectedDayReminders = useMemo(() => {
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const targetStr = `${yyyy}-${mm}-${dd}`;

    return allReminders
      .filter(r => r.dateStr === targetStr)
      .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  }, [allReminders, selectedDate]);

  // Check if a date has reminders
  const getRemindersForDate = (date: Date | null) => {
    if (!date) return [];
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const targetStr = `${yyyy}-${mm}-${dd}`;
    return allReminders.filter(r => r.dateStr === targetStr);
  };

  const handleSaveReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDateStr) return;

    addManualReminder({
      title: newTitle,
      description: newDescription || undefined,
      date: newDateStr,
      time: newTimeStr || undefined,
      type: newType,
      relatedDocId: newRelatedDocId || undefined
    });

    // Reset Form
    setNewTitle('');
    setNewDescription('');
    setNewDateStr('');
    setNewTimeStr('');
    setNewType('Personal');
    setNewRelatedDocId('');
    setIsAddModalOpen(false);
  };

  const handleDayCellClick = (date: Date | null) => {
    if (!date) return;
    setSelectedDate(date);
    setCurrentDate(date);
  };

  const handleReminderAction = (item: UnifiedReminder) => {
    if (item.isManual && !item.relatedDoc) {
      alert(`[Reminder Detail]\nTitle: ${item.title}\nDescription: ${item.description || 'N/A'}\nTime: ${item.time || 'N/A'}`);
    } else if (item.relatedDoc) {
      goToArchiveWithContext({ documentId: item.relatedDoc._id });
    }
  };

  const getReminderTypeColor = (type: UnifiedReminder['type']) => {
    switch (type) {
      case 'Payment': return 'bg-red-500';
      case 'Renewal': return 'bg-purple-500';
      case 'Document': return 'bg-orange-500';
      default: return 'bg-green-500';
    }
  };

  const getMonthName = (monthIdx: number) => {
    return new Date(2000, monthIdx, 1).toLocaleDateString('en-US', { month: 'long' });
  };

  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="Calendar & Reminders" 
        subtitle="Manage personal reminders and document due dates"
        icon={<CalendarIcon className="text-purple-600 w-5 h-5" />}
        actions={
          <div className="flex items-center gap-1.5 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            {(['day', 'week', 'month', 'year'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all",
                  viewMode === mode 
                    ? "bg-white text-purple-700 shadow-xs border border-gray-200/50" 
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        }
      />
      <WidgetBody className="mt-4">
        {/* Navigation Toolbar */}
        <div className="flex items-center justify-between gap-4 mb-4 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrev}
              className="p-1.5 hover:bg-gray-100 rounded-xl border border-gray-200 text-gray-500 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-black text-gray-800 tracking-tight min-w-[120px] text-center">
              {viewMode === 'month' && `${getMonthName(currentDate.getMonth())} ${currentDate.getFullYear()}`}
              {viewMode === 'year' && currentDate.getFullYear()}
              {viewMode === 'day' && currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {viewMode === 'week' && `W/C ${new Date(currentDate.getTime() - currentDate.getDay()*24*60*60*1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </span>
            <button 
              onClick={handleNext}
              className="p-1.5 hover:bg-gray-100 rounded-xl border border-gray-200 text-gray-500 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all"
            >
              Today
            </button>
            <button 
              onClick={() => {
                const yyyy = selectedDate.getFullYear();
                const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const dd = String(selectedDate.getDate()).padStart(2, '0');
                setNewDateStr(`${yyyy}-${mm}-${dd}`);
                setIsAddModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-purple-500/10 active:scale-98"
            >
              <Plus size={14} /> Add Reminder
            </button>
          </div>
        </div>

        {/* Dynamic Views Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Visual Calendar Space */}
          <div className="col-span-12 md:col-span-8">
            
            {/* MONTH VIEW */}
            {viewMode === 'month' && (
              <div>
                <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <span key={d} className="text-[10px] font-black text-gray-400 uppercase tracking-widest py-1">{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthData.map((cell, idx) => {
                    const hasReminders = cell.date ? getRemindersForDate(cell.date) : [];
                    const isToday = cell.date ? cell.date.toDateString() === new Date().toDateString() : false;
                    const isSelected = cell.date ? cell.date.toDateString() === selectedDate.toDateString() : false;

                    return (
                      <div
                        key={idx}
                        onClick={() => handleDayCellClick(cell.date)}
                        className={cn(
                          "h-[50px] border border-gray-100/60 rounded-xl p-1 flex flex-col justify-between transition-all cursor-pointer",
                          !cell.day && "opacity-0 pointer-events-none",
                          cell.day && "bg-white hover:border-purple-300 hover:shadow-xs",
                          isSelected && "border-purple-500 ring-1 ring-purple-500",
                          isToday && "bg-purple-50/20 border-purple-200"
                        )}
                      >
                        <span className={cn(
                          "text-[10px] font-bold self-start ml-1",
                          isToday ? "text-purple-700 bg-purple-100/60 w-5 h-5 flex items-center justify-center rounded-full" : "text-gray-800"
                        )}>
                          {cell.day}
                        </span>
                        
                        {/* Indicators bar */}
                        <div className="flex gap-0.5 justify-center w-full overflow-hidden h-1.5 mb-0.5">
                          {hasReminders.slice(0, 4).map((r, i) => (
                            <span 
                              key={i} 
                              className={cn("w-1.5 h-1.5 rounded-full shrink-0", getReminderTypeColor(r.type))}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {viewMode === 'week' && (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, idx) => {
                  const firstDayOfWeek = new Date(currentDate.getTime() - currentDate.getDay()*24*60*60*1000);
                  const dayDate = new Date(firstDayOfWeek.getTime() + idx*24*60*60*1000);
                  const cellReminders = getRemindersForDate(dayDate);
                  const isToday = dayDate.toDateString() === new Date().toDateString();
                  const isSelected = dayDate.toDateString() === selectedDate.toDateString();

                  return (
                    <div
                      key={idx}
                      onClick={() => handleDayCellClick(dayDate)}
                      className={cn(
                        "p-3 border border-gray-100 rounded-2xl flex flex-col justify-between min-h-[140px] cursor-pointer bg-white transition-all hover:border-purple-300 hover:shadow-sm",
                        isSelected && "border-purple-500 ring-1 ring-purple-500",
                        isToday && "bg-purple-50/20 border-purple-200"
                      )}
                    >
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                          {dayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                        </p>
                        <p className={cn(
                          "text-base font-black",
                          isToday ? "text-purple-700" : "text-gray-900"
                        )}>
                          {dayDate.getDate()}
                        </p>
                      </div>
                      
                      <div className="space-y-1.5 mt-2">
                        {cellReminders.slice(0, 2).map((r, i) => (
                          <div key={i} className="flex items-center gap-1 overflow-hidden truncate">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", getReminderTypeColor(r.type))} />
                            <span className="text-[9px] font-bold text-gray-600 truncate">{r.title}</span>
                          </div>
                        ))}
                        {cellReminders.length > 2 && (
                          <span className="text-[8px] font-bold text-purple-600">+ {cellReminders.length - 2} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* DAY VIEW */}
            {viewMode === 'day' && (
              <div className="bg-white p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 text-base font-black">
                    {currentDate.getDate()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">
                      {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Hourly Agenda Overview</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {getRemindersForDate(currentDate).length > 0 ? getRemindersForDate(currentDate).map((item, idx) => (
                    <div 
                      key={idx}
                      onClick={() => handleReminderAction(item)}
                      className="p-3 bg-gray-50/50 border border-gray-150/40 rounded-xl hover:bg-white hover:border-purple-200 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-base shrink-0">{item.iconPrefix}</span>
                        <div>
                          <p className="text-xs font-bold text-gray-900 truncate">{item.title}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">
                            Type: {item.type} {item.time ? `| Time: ${item.time}` : ''}
                          </p>
                        </div>
                      </div>
                      
                      {item.isManual && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteManualReminder(item.id);
                          }}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )) : (
                    <p className="text-xs text-gray-400 text-center py-8">No scheduled reminders or due events for this day.</p>
                  )}
                </div>
              </div>
            )}

            {/* YEAR VIEW */}
            {viewMode === 'year' && (
              <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, mIdx) => {
                  const mDate = new Date(currentDate.getFullYear(), mIdx, 1);
                  const mReminders = allReminders.filter(r => r.date.getMonth() === mIdx && r.date.getFullYear() === currentDate.getFullYear());

                  return (
                    <div
                      key={mIdx}
                      onClick={() => {
                        setCurrentDate(mDate);
                        setViewMode('month');
                      }}
                      className="p-3 border border-gray-100 bg-white hover:border-purple-200 hover:shadow-xs transition-all rounded-xl cursor-pointer text-center min-h-[90px] flex flex-col justify-between"
                    >
                      <p className="text-xs font-black text-gray-900 uppercase tracking-widest">{getMonthName(mIdx).slice(0, 3)}</p>
                      <div className="bg-purple-50 text-purple-700 text-[10px] font-black py-1 px-2 rounded-lg mt-2">
                        {mReminders.length} events
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
          </div>

          {/* Right Column: Selected Day Agenda & Quick List */}
          <div className="col-span-12 md:col-span-4 bg-gray-50/50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between min-h-[260px]">
            <div>
              <div className="flex items-center justify-between border-b border-gray-200/50 pb-2 mb-3">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Agenda: {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  {selectedDayReminders.length} Events
                </span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {selectedDayReminders.length > 0 ? selectedDayReminders.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleReminderAction(item)}
                    className="p-2.5 bg-white border border-gray-150/40 rounded-xl hover:border-purple-200 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-sm shrink-0">{item.iconPrefix}</span>
                      <div className="overflow-hidden">
                        <p className="text-[11px] font-bold text-gray-900 truncate leading-snug">{item.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[8px] font-semibold text-gray-400">{item.type}</span>
                          {item.time && (
                            <>
                              <span className="w-0.5 h-0.5 bg-gray-300 rounded-full"></span>
                              <span className="text-[8px] text-gray-400">{item.time}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.isManual && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteManualReminder(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-all"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                      <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-purple-600 transition-colors" />
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10">
                    <CheckCircle2 className="w-8 h-8 text-green-400/80 mx-auto mb-2" />
                    <p className="text-[11px] font-bold text-gray-500">All caught up!</p>
                    <p className="text-[9px] text-gray-400">No scheduled events for this date.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="pt-3 border-t border-gray-200/50 mt-4">
              <button 
                onClick={() => {
                  const yyyy = selectedDate.getFullYear();
                  const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                  const dd = String(selectedDate.getDate()).padStart(2, '0');
                  setNewDateStr(`${yyyy}-${mm}-${dd}`);
                  setIsAddModalOpen(true);
                }}
                className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <Plus size={14} /> Quick Add Reminder
              </button>
            </div>
          </div>
        </div>
      </WidgetBody>

      {/* Add Reminder Modal overlay */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl p-6 w-full max-w-md relative animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 hover:bg-gray-50 rounded-full transition-colors"
            >
              &times;
            </button>
            <h3 className="text-base font-black text-gray-900 mb-4 flex items-center gap-2">
              <CalendarIcon className="text-purple-600" size={18} />
              Add Manual Reminder
            </h3>
            
            <form onSubmit={handleSaveReminder} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Passport Renewal Reminder"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Description (Optional)</label>
                <textarea 
                  placeholder="Add details, policy numbers, notes..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Date</label>
                  <input 
                    type="date" 
                    required
                    value={newDateStr}
                    onChange={e => setNewDateStr(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Time (Optional)</label>
                  <input 
                    type="time" 
                    value={newTimeStr}
                    onChange={e => setNewTimeStr(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Type</label>
                  <select 
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none bg-white"
                  >
                    <option value="Personal">Personal</option>
                    <option value="Payment">Payment</option>
                    <option value="Renewal">Renewal</option>
                    <option value="Document">Document</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Linked Document</label>
                  <select 
                    value={newRelatedDocId}
                    onChange={e => setNewRelatedDocId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none bg-white"
                  >
                    <option value="">None</option>
                    {documents.map(d => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-colors"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
