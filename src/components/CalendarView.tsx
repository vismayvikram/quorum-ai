import { useState, useEffect, useRef } from 'react';
import { Subtask, Task, Settings } from '../types';
import { Clock, CheckCircle, Flame, Calendar, Ban, User, AlertCircle, RefreshCw } from 'lucide-react';

interface CalendarViewProps {
  subtasks: Subtask[];
  tasks: Task[];
  virtualTime: number;
  settings: Settings | null;
  onCompleteSubtask: (id: string) => void;
}

export function CalendarView({
  subtasks,
  tasks,
  virtualTime,
  settings,
  onCompleteSubtask,
}: CalendarViewProps) {
  // Find the current virtual day to initialize
  const getDayStartTimestamp = (ts: number) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const [selectedDay, setSelectedDay] = useState<number>(getDayStartTimestamp(virtualTime));
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the calendar view to the current virtual hour or first task
  useEffect(() => {
    if (containerRef.current) {
      const d = new Date(virtualTime);
      const currentHour = d.getHours();
      
      // Default focus: if it's before 6am, scroll to 6am. If after 10pm, scroll to 10pm.
      // Otherwise scroll to current hour minus a bit of buffer.
      let focusHour = currentHour;
      if (currentHour < 6) focusHour = 6;
      if (currentHour > 22) focusHour = 18; // show end of day

      const scrollPos = Math.max(0, (focusHour - 1) * 60);
      containerRef.current.scrollTo({ top: scrollPos, behavior: 'auto' });
    }
  }, [selectedDay, viewMode]);

  // Sync selected day if virtualTime rolls over to a new day
  const prevVirtualDayStartRef = useRef<number>(getDayStartTimestamp(virtualTime));

  useEffect(() => {
    const currentVirtualDayStart = getDayStartTimestamp(virtualTime);
    if (currentVirtualDayStart !== prevVirtualDayStartRef.current) {
      setSelectedDay(currentVirtualDayStart);
      prevVirtualDayStartRef.current = currentVirtualDayStart;
    }
  }, [virtualTime]);

  // Create list of 7 days starting from current virtual time day
  const daysList = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(virtualTime);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  const isSameDay = (t1: number, t2: number) => {
    const d1 = new Date(t1);
    const d2 = new Date(t2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const formatDayName = (ts: number) => {
    return new Date(ts).toLocaleDateString([], { weekday: 'short' });
  };

  // Urgency color helper
  const getUrgencyColor = (band?: string) => {
    switch (band) {
      case 'red':
        return 'border-red-500 bg-red-50/90 text-red-900';
      case 'amber':
        return 'border-amber-500 bg-amber-50/90 text-amber-900';
      case 'green':
      default:
        return 'border-emerald-500 bg-emerald-50/90 text-emerald-900';
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMinutesSinceStartOfDay = (ts: number, referenceDayTs: number) => {
    const startOfRefDay = new Date(referenceDayTs);
    startOfRefDay.setHours(0, 0, 0, 0);
    const diffMs = ts - startOfRefDay.getTime();
    return Math.max(0, diffMs / (60 * 1000));
  };

  const renderTimelineBlocks = (dayTs: number, isWeekView: boolean = false) => {
    const daySubtasks = subtasks.filter(
      (st) => st.assignedSlot && isSameDay(st.assignedSlot.start, dayTs)
    );
    const dayBlockedWindows = (settings?.blockedWindows || []).filter(
      (w) => isSameDay(w.start, dayTs)
    );

    return (
      <>
        {/* Manual Blocked Windows */}
        {dayBlockedWindows.map((w, i) => {
          const startMin = getMinutesSinceStartOfDay(w.start, dayTs);
          const endMin = getMinutesSinceStartOfDay(w.end, dayTs);
          const height = Math.max(25, endMin - startMin);

          return (
            <div
              key={`blocked-${dayTs}-${i}`}
              className="absolute left-1 right-1 rounded border border-dashed border-slate-300 bg-slate-100/50 text-slate-500 flex items-center justify-center overflow-hidden z-10"
              style={{
                top: `${startMin}px`,
                height: `${height}px`,
              }}
              title={w.label}
            >
              {!isWeekView && <Ban className="w-3.5 h-3.5 text-slate-400 opacity-50" />}
            </div>
          );
        })}

        {/* Scheduled Subtask Blocks */}
        {daySubtasks.map((st) => {
          if (!st.assignedSlot) return null;
          const startMin = getMinutesSinceStartOfDay(st.assignedSlot.start, dayTs);
          const endMin = getMinutesSinceStartOfDay(st.assignedSlot.end, dayTs);
          const height = Math.max(isWeekView ? 20 : 45, endMin - startMin);

          const parentTask = tasks.find((t) => t.id === st.taskId);
          const parentName = parentTask ? parentTask.description : 'Focus';

          const cardStyle = getUrgencyColor(st.urgencyBand);
          const isCompleted = st.status === 'completed';
          const isMissed = st.status === 'missed';
          const isInactive = isCompleted || isMissed;

          return (
            <div
              key={st.id}
              className={`absolute left-0.5 right-0.5 rounded border-l-2 border-y border-r px-1.5 py-1 flex flex-col items-start overflow-hidden shadow-xs transition-all duration-200 hover:z-20 hover:shadow-md ${cardStyle} ${
                isInactive ? 'opacity-40 line-through grayscale border-slate-300 bg-slate-100 text-slate-500 shadow-none' : ''
              }`}
              style={{
                top: `${startMin}px`,
                height: `${height}px`,
              }}
              onClick={() => {
                if (isWeekView) {
                  setSelectedDay(dayTs);
                  setViewMode('day');
                }
              }}
            >
              <div className="min-w-0 w-full">
                <h4 className={`font-bold truncate leading-none ${isWeekView ? 'text-[9px]' : 'text-[11px]'}`}>
                  {parentName}
                </h4>
                {(!isWeekView || height > 40) && (
                  <p className={`font-medium text-slate-600 truncate mt-0.5 ${isWeekView ? 'text-[8px]' : 'text-[10px]'}`}>
                    {st.title}
                  </p>
                )}
              </div>
              
              {!isWeekView && !isCompleted && !isMissed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompleteSubtask(st.id);
                  }}
                  className="absolute bottom-1 right-1 p-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 hover:text-emerald-600 transition-colors shrink-0 shadow-xs"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* Real-time Dashboard Marker */}
        {isSameDay(virtualTime, dayTs) && (
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-red-500 z-30 pointer-events-none"
            style={{ top: `${getMinutesSinceStartOfDay(virtualTime, dayTs)}px` }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 -mt-1 -ml-1"></div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
      {/* Calendar Header */}
      <div className="mb-4 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-medium tracking-tight text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            <span>{viewMode === 'week' ? 'Week Strategy Overview' : 'Focused Day Timeline'}</span>
          </h2>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                viewMode === 'week' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Week
            </button>
            <button 
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                viewMode === 'day' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Day
            </button>
          </div>
        </div>

        {/* Top Date Header for columns */}
        <div className={`grid ${viewMode === 'week' ? 'grid-cols-7 ml-12' : 'grid-cols-1 ml-12'} gap-px border-b border-slate-100`}>
          {viewMode === 'week' ? (
            daysList.map(dayTs => (
              <div 
                key={dayTs} 
                className={`py-2 text-center transition-colors cursor-pointer hover:bg-slate-50 ${isSameDay(dayTs, selectedDay) && viewMode === 'day' ? 'bg-slate-50' : ''}`}
                onClick={() => {
                  setSelectedDay(dayTs);
                  setViewMode('day');
                }}
              >
                <div className={`text-[9px] uppercase font-bold tracking-widest ${isSameDay(dayTs, virtualTime) ? 'text-red-500' : 'text-slate-400'}`}>
                  {formatDayName(dayTs)}
                </div>
                <div className={`text-xs font-bold mt-0.5 ${isSameDay(dayTs, virtualTime) ? 'text-slate-900' : 'text-slate-600'}`}>
                  {new Date(dayTs).getDate()}
                </div>
              </div>
            ))
          ) : (
            <div className="py-2 text-left flex items-center gap-3">
              <div className="text-xl font-bold text-slate-900">
                {new Date(selectedDay).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              {isSameDay(selectedDay, virtualTime) && (
                <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">TODAY</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hourly Timetable Area */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50 scrollbar-thin"
      >
        <div className="relative w-full h-[1440px] select-none flex">
          {/* Hour Labels */}
          <div className="w-12 shrink-0 border-r border-slate-200 bg-white/50 sticky left-0 z-40">
            {Array.from({ length: 24 }).map((_, hour) => (
              <div
                key={hour}
                className="h-[60px] text-right pr-2 -mt-2 text-[10px] font-mono text-slate-400 font-medium"
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Grid Content */}
          <div className={`relative flex-1 grid ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-1'} divide-x divide-slate-100`}>
            {/* Horizontal Hour Lines */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 24 }).map((_, hour) => (
                <div
                  key={hour}
                  className="h-[60px] border-b border-slate-100/60"
                />
              ))}
            </div>

            {viewMode === 'week' ? (
              daysList.map(dayTs => (
                <div key={dayTs} className="relative h-full group">
                  {renderTimelineBlocks(dayTs, true)}
                </div>
              ))
            ) : (
              <div className="relative h-full">
                {renderTimelineBlocks(selectedDay, false)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
