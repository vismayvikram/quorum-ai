import { Subtask } from '../types';
import { CheckCircle2, Clock, XCircle, AlertTriangle, Flame } from 'lucide-react';

interface ActiveRoadmapProps {
  subtasks: Subtask[];
  virtualTime: number;
  onComplete: (subtaskId: string) => void;
  isMaxFirmnessActive?: boolean;
}

export function ActiveRoadmap({ subtasks, virtualTime, onComplete, isMaxFirmnessActive }: ActiveRoadmapProps) {
  if (subtasks.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400">
        <p className="text-sm">No scheduled subtasks right now.</p>
        <p className="text-xs mt-1">Enter a task to decompose and schedule.</p>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSubtaskState = (st: Subtask) => {
    if (st.status === 'completed') return 'completed';
    if (st.status === 'missed') return 'missed';

    if (!st.assignedSlot) return 'pending';

    // Check if currently active (current time is within the slot)
    if (virtualTime >= st.assignedSlot.start && virtualTime <= st.assignedSlot.end) {
      return 'active';
    }

    // Check if overdue (current time is past the slot but within the grace period)
    const graceMinutes = isMaxFirmnessActive ? 0 : (st.gracePeriodMinutes ?? 30);
    const deadlineWithGrace = st.assignedSlot.end + graceMinutes * 60 * 1000;
    if (virtualTime > st.assignedSlot.end && virtualTime <= deadlineWithGrace) {
      return 'overdue';
    }

    // Check if completely missed/exceeded grace period
    if (virtualTime > deadlineWithGrace) {
      return 'missed';
    }

    return 'pending';
  };

  // Sort subtasks by their assigned slot start time
  const sortedSubtasks = [...subtasks].sort((a, b) => {
    const aStart = a.assignedSlot?.start || 0;
    const bStart = b.assignedSlot?.start || 0;
    return aStart - bStart;
  });

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-medium tracking-tight text-slate-900">Active Timeline</h2>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>Deterministic Scheduler</span>
        </div>
      </div>

      <div className="relative border-l-2 border-slate-100 pl-6 ml-3 space-y-6">
        {sortedSubtasks.map((st) => {
          const state = getSubtaskState(st);
          const hasGraceRemaining = state === 'active' || (st.assignedSlot && virtualTime > st.assignedSlot.end && state !== 'missed');
          
          let cardStyle = "border-slate-150 bg-white";
          let badgeStyle = "bg-slate-100 text-slate-600";
          let stateLabel = "Upcoming";

          if (state === 'completed') {
            cardStyle = "border-slate-100 bg-slate-50/50 opacity-60";
            badgeStyle = "bg-emerald-50 text-emerald-700";
            stateLabel = "Completed";
          } else if (state === 'missed') {
            cardStyle = "border-red-100 bg-red-50/10";
            badgeStyle = "bg-red-50 text-red-700";
            stateLabel = "Missed";
          } else if (state === 'active') {
            cardStyle = "border-slate-900 ring-2 ring-slate-900/10 bg-slate-50/30";
            badgeStyle = "bg-slate-900 text-white animate-pulse";
            stateLabel = "In Progress";
          } else if (state === 'overdue') {
            cardStyle = "border-amber-200 bg-amber-50/20";
            badgeStyle = "bg-amber-100 text-amber-800";
            stateLabel = "Overdue (Grace)";
          }

          return (
            <div key={st.id} className="relative group">
              {/* Timeline marker */}
              <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-white transition-colors duration-300 ${
                state === 'completed' ? 'border-emerald-500 bg-emerald-50' :
                state === 'missed' ? 'border-red-500 bg-red-50' :
                state === 'active' ? 'border-slate-900 bg-slate-900 shadow-sm' :
                'border-slate-300'
              }`} />

              {/* Subtask Card */}
              <div className={`p-4 rounded-xl border transition-all duration-300 ${cardStyle}`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className={`text-sm font-medium ${state === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                      {st.title}
                    </h3>
                    
                    {st.assignedSlot && (
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        {formatTime(st.assignedSlot.start)} - {formatTime(st.assignedSlot.end)} 
                        <span className="mx-1.5">•</span>
                        {st.estimatedDuration} mins
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {st.urgencyScore !== undefined && st.status === 'pending' && (
                      <span className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded flex items-center gap-1 ${
                        st.urgencyBand === 'red' ? 'bg-red-500 text-white animate-pulse' :
                        st.urgencyBand === 'amber' ? 'bg-amber-500 text-white' :
                        'bg-emerald-500 text-white'
                      }`}>
                        {st.urgencyBand === 'red' && <Flame className="w-3 h-3 shrink-0" />}
                        Urgency: {st.urgencyScore}
                      </span>
                    )}

                    <span className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded ${badgeStyle}`}>
                      {stateLabel}
                    </span>

                    {state !== 'completed' && state !== 'missed' && (
                      <button
                        onClick={() => onComplete(st.id)}
                        className="p-1 rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                        title="Mark complete"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Grace Warning or Overdue warning info */}
                {state === 'overdue' && st.assignedSlot && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Missed end time. Complete now! Grace expires in {Math.max(0, Math.ceil((st.assignedSlot.end + st.gracePeriodMinutes * 60 * 1000 - virtualTime) / 60000))} mins.
                    </span>
                  </div>
                )}

                {state === 'active' && st.assignedSlot && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg font-medium">
                    <Clock className="w-3.5 h-3.5 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
                    <span>
                      Active slot. Remaining: {Math.max(0, Math.ceil((st.assignedSlot.end - virtualTime) / 60000))} mins.
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
