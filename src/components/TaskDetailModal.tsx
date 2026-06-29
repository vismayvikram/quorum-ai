import React from 'react';
import { Subtask, Task, TaxEffect } from '../types';
import { 
  X, Calendar, Clock, AlertCircle, CheckCircle2, 
  ArrowRight, ShieldAlert, BarChart3, Info, 
  History, Settings2, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getParentTaskSummary } from '../lib/getParentTaskSummary';

interface TaskDetailModalProps {
  subtask: Subtask | null;
  tasks: Task[];
  allSubtasks: Subtask[];
  virtualTime: number;
  taxes: TaxEffect[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: (id: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  subtask,
  tasks,
  allSubtasks,
  virtualTime,
  taxes,
  isOpen,
  onClose,
  onComplete
}) => {
  if (!subtask) return null;

  const parentTask = tasks.find(t => t.id === subtask.taskId);
  const summary = getParentTaskSummary(subtask.taskId, allSubtasks, virtualTime);
  const activeTaxesForParent = taxes.filter(t => t.active); // Simplified check

  const formatTime = (ms: number) => {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'missed': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  // Find dependencies
  const blockedBy = allSubtasks.filter(st => subtask.dependencies.includes(st.id));
  const blocking = allSubtasks.filter(st => st.dependencies.includes(subtask.id));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start shrink-0 bg-slate-50/50">
              <div className="flex-1 pr-8">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${getStatusColor(subtask.status)}`}>
                    {subtask.status}
                  </span>
                  {subtask.assignedSlot && (
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(subtask.assignedSlot.start)} - {formatTime(subtask.assignedSlot.end)}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 leading-tight">
                  {subtask.title}
                </h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
              {/* Section 1: Microtask Details */}
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Execution Parameters
                </h3>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    {subtask.description || "No additional description provided for this subtask."}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Duration</p>
                      <p className="text-sm font-semibold text-slate-700">{subtask.durationMinutes} minutes</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Grace Period</p>
                      <p className="text-sm font-semibold text-slate-700">{subtask.gracePeriodMinutes} mins</p>
                    </div>
                  </div>

                  {/* Dependency Map */}
                  {(blockedBy.length > 0 || blocking.length > 0) && (
                    <div className="mt-6 pt-4 border-t border-slate-200/50 space-y-4">
                      {blockedBy.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Prerequisites</p>
                          <div className="flex flex-wrap gap-2">
                            {blockedBy.map(dep => (
                              <div key={dep.id} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500">
                                <ArrowRight className="w-3 h-3 text-amber-400" />
                                {dep.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {blocking.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Unlocks</p>
                          <div className="flex flex-wrap gap-2">
                            {blocking.map(dep => (
                              <div key={dep.id} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                {dep.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Section 2: Parent Task Context */}
              {parentTask && (
                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5" />
                    Structural Context (Parent Task)
                  </h3>
                  <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -mr-16 -mt-16 rounded-full blur-2xl" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-slate-300">
                          {parentTask.type}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400">
                          Priority {parentTask.priority}
                        </span>
                      </div>
                      <h4 className="text-lg font-black tracking-tight mb-2 leading-tight">
                        {parentTask.title}
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4 italic">
                        "{parentTask.description}"
                      </p>
                      
                      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-300">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Final Deadline: {new Date(parentTask.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Section 3: Aggregate Progress */}
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Aggregate Execution Performance
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-end mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completion</p>
                      <p className="text-lg font-black text-slate-900 leading-none">{summary.completed}<span className="text-slate-300 text-xs font-bold">/{summary.total}</span></p>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${summary.progressPercentage}%` }}
                        className="h-full bg-emerald-500" 
                      />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-2">{summary.progressPercentage}% structural progress</p>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-end mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accumulated Delay</p>
                      <p className={`text-lg font-black leading-none ${summary.accumulatedDelayMinutes > 0 ? 'text-red-500' : 'text-slate-900'}`}>
                        {summary.accumulatedDelayMinutes}<span className="text-slate-300 text-xs font-bold">m</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 mt-3">
                      {summary.missed > 0 ? (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-red-500">
                          <AlertCircle className="w-3 h-3" />
                          {summary.missed} subtask misses detected
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                          <CheckCircle2 className="w-3 h-3" />
                          On-track performance
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {activeTaxesForParent.length > 0 && (
                  <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">Active Accountability Enforcement</p>
                      <p className="text-xs text-red-600 font-medium">This task thread is currently under structural penalties.</p>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
              {subtask.status !== 'completed' && (
                <button
                  onClick={() => {
                    onComplete(subtask.id);
                    onClose();
                  }}
                  className="flex-1 bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-slate-900/20 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Completed
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 border border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-widest py-3.5 rounded-xl hover:bg-white transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
