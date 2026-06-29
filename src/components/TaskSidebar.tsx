import { useState } from 'react';
import { Subtask, Task } from '../types';
import { Clock, Calendar, AlertCircle, CheckCircle, ListTodo, ShieldAlert, Award } from 'lucide-react';

interface TaskSidebarProps {
  subtasks: Subtask[];
  tasks: Task[];
  virtualTime: number;
  onCompleteSubtask: (id: string) => void;
  onSubtaskClick: (id: string) => void;
}

export function TaskSidebar({ subtasks, tasks, virtualTime, onCompleteSubtask, onSubtaskClick }: TaskSidebarProps) {
  const [activeTab, setActiveTab] = useState<'day' | 'urgency'>('day');

  const getDayStartTimestamp = (ts: number) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const isSameDay = (t1: number, t2: number) => {
    const d1 = new Date(t1);
    const d2 = new Date(t2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // 1. Day Timeline: Chronological subtasks of the virtual current day
  const virtualTodayStart = getDayStartTimestamp(virtualTime);
  const daySubtasks = subtasks
    .filter(st => st.assignedSlot && isSameDay(st.assignedSlot.start, virtualTodayStart))
    .sort((a, b) => (a.assignedSlot?.start || 0) - (b.assignedSlot?.start || 0));

  // 2. Global Urgency: Flat list of all outstanding (pending/missed/overdue) open subtasks sorted by urgency descending
  const openSubtasks = subtasks
    .filter(st => st.status === 'pending' || st.status === 'missed')
    .sort((a, b) => (b.urgencyScore || 0) - (a.urgencyScore || 0));

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getUrgencyBadgeColor = (band?: string, isInactive?: boolean) => {
    if (isInactive) return 'bg-slate-100 text-slate-400 border-slate-200';
    switch (band) {
      case 'red': return 'bg-red-500 text-white border-red-600';
      case 'amber': return 'bg-amber-500 text-white border-amber-600';
      case 'green':
      default: return 'bg-emerald-500 text-white border-emerald-600';
    }
  };

  const renderUrgencyBadge = (score: number, band?: string, isInactive?: boolean) => (
    <div 
      className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 text-[11px] font-bold shadow-sm ${getUrgencyBadgeColor(band, isInactive)}`}
      title={`Urgency: ${score.toFixed(0)}`}
    >
      {score.toFixed(0)}
    </div>
  );

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden w-full">
      
      {/* Sidebar Tabs */}
      <div className="flex border-b border-slate-100 mb-4 shrink-0">
        <button
          onClick={() => setActiveTab('day')}
          className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center transition-colors relative ${
            activeTab === 'day' 
              ? 'text-slate-900 border-b-2 border-slate-900' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Daily Timeline ({daySubtasks.length})</span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab('urgency')}
          className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center transition-colors relative ${
            activeTab === 'urgency' 
              ? 'text-slate-900 border-b-2 border-slate-900' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <ListTodo className="w-3.5 h-3.5" />
            <span>Execution Priority ({openSubtasks.length})</span>
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        
        {activeTab === 'day' && (
          <div className="space-y-3">
            {daySubtasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Calendar className="w-8 h-8 mx-auto stroke-[1.5] text-slate-300 mb-2" />
                <p className="text-xs font-medium">No tasks scheduled for today.</p>
                <p className="text-[10px] text-slate-400 mt-1">Use the Floating Action Button to generate a new roadmap.</p>
              </div>
            ) : (
              daySubtasks.map(st => {
                const parent = tasks.find(t => t.id === st.taskId);
                const parentTitle = parent ? parent.description : 'Task';
                const isInactive = st.status === 'completed' || st.status === 'missed';

                return (
                  <div 
                    key={st.id} 
                    onClick={() => onSubtaskClick(st.id)}
                    className={`p-3 rounded-xl border border-slate-100 flex items-center gap-3 transition-all cursor-pointer ${
                      isInactive ? 'bg-slate-50/50 grayscale opacity-60' : 'bg-white hover:bg-slate-50 shadow-xs hover:border-slate-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-bold text-slate-800 truncate leading-none ${st.status === 'completed' ? 'line-through' : ''}`}>
                        {st.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate mt-1 font-medium">
                        {formatTime(st.assignedSlot!.start)} • {parentTitle}
                      </p>
                    </div>
                    {renderUrgencyBadge(st.urgencyScore || 0, st.urgencyBand, isInactive)}
                    {!isInactive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompleteSubtask(st.id);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-500 hover:text-emerald-500 transition-all shadow-xs shrink-0"
                        title="Mark Completed"
                      >
                        <CheckCircle className="w-4 h-4 text-slate-400" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'urgency' && (
          <div className="space-y-3">
            {openSubtasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Award className="w-8 h-8 mx-auto stroke-[1.5] text-emerald-500/80 mb-2" />
                <p className="text-xs font-bold text-slate-700">All tasks completed!</p>
                <p className="text-[10px] text-slate-400 mt-1">Excellent record. Use the button to load more tasks.</p>
              </div>
            ) : (
              openSubtasks.map((st, idx) => {
                const parent = tasks.find(t => t.id === st.taskId);
                const parentTitle = parent ? parent.description : 'Task';
                const isInactive = st.status === 'completed' || st.status === 'missed';
                const showHeader = idx === 0 || st.taskId !== openSubtasks[idx - 1].taskId;

                return (
                  <div key={st.id} className="space-y-2">
                    {showHeader && (
                      <div className="flex items-center gap-2 pt-2 first:pt-0">
                        <div className="h-px flex-1 bg-slate-100"></div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] truncate px-2">
                          {parentTitle}
                        </span>
                        <div className="h-px flex-1 bg-slate-100"></div>
                      </div>
                    )}
                    <div 
                      onClick={() => onSubtaskClick(st.id)}
                      className={`p-3 rounded-xl border border-slate-100 flex items-center gap-3 transition-all cursor-pointer ${
                        isInactive ? 'bg-slate-50/50 grayscale opacity-60' : 'bg-white hover:bg-slate-50 shadow-xs hover:border-slate-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs font-bold text-slate-800 truncate leading-none ${isInactive && st.status === 'completed' ? 'line-through' : ''}`}>
                          {st.title}
                        </h4>
                        <p className="text-[9px] font-mono text-slate-400 mt-1">
                          Due {new Date(st.assignedSlot?.end || 0).toLocaleDateString()}
                        </p>
                      </div>
                      {renderUrgencyBadge(st.urgencyScore || 0, st.urgencyBand, isInactive)}
                      {!isInactive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCompleteSubtask(st.id);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-500 hover:text-emerald-500 transition-all shadow-xs shrink-0"
                        >
                          <CheckCircle className="w-4 h-4 text-slate-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
