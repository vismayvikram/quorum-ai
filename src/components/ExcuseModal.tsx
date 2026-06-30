import React, { useState } from 'react';
import { X, ShieldAlert, Sparkles, AlertCircle, CheckCircle2, Sliders, ArrowRight } from 'lucide-react';
import { Subtask, Tone } from '../types';
import { apiFetch } from '../lib/api';
import { getLocalIdentity } from '../lib/identity';
import { motion, AnimatePresence } from 'motion/react';

interface ExcuseModalProps {
  subtask: Subtask | null;
  virtualTime: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Triggered when subtask is successfully rescheduled
}

export const ExcuseModal: React.FC<ExcuseModalProps> = ({
  subtask,
  virtualTime,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [excuse, setExcuse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    text: string;
    rescheduled: boolean;
    tone: Tone;
    traceMessage: string;
  } | null>(null);

  if (!subtask) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excuse.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch('/api/coach/excuse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': getLocalIdentity(),
          'x-timezone-offset': new Date().getTimezoneOffset().toString()
        },
        body: JSON.stringify({
          subtaskId: subtask.id,
          excuse,
          virtualTime
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (data.rescheduled) {
          onSuccess();
        }
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit excuse');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during excuse evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMoodEmoji = (rescheduled: boolean) => {
    return rescheduled ? '✨' : '🔥';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-500/20 text-red-400 rounded-lg">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide uppercase">Accountability Hearing</h3>
                  <p className="text-[10px] text-slate-400">Plead Your Case to the Coach Agent</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Missed Task Context */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Missed Subtask Detail
                </span>
                <h4 className="font-bold text-sm text-slate-800 mt-1">{subtask.title}</h4>
                {subtask.assignedSlot && (
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">
                    Scheduled end: {new Date(subtask.assignedSlot.end).toLocaleString()}
                  </p>
                )}
              </div>

              {!result ? (
                /* Excuse Entry Form */
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Provide Your Excuse / Explanation
                    </label>
                    <textarea
                      required
                      value={excuse}
                      onChange={(e) => setExcuse(e.target.value)}
                      placeholder="Why did you miss this task? Be honest. The coach is analyzing your reason..."
                      className="w-full h-32 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-sm resize-none"
                    />
                    <p className="text-[10px] text-slate-400 italic">
                      Note: Genuine reasons (technical issues, health, emergencies) are forgiven in Gentle/Neutral tones. Weak excuses face penalties.
                    </p>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !excuse.trim()}
                    className="w-full bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-slate-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Evaluating Case...' : 'Submit Case to Coach'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                /* Case Evaluation Verdict Output */
                <div className="space-y-5 animate-fade-in">
                  <div className="text-center py-4">
                    <div className="text-4xl mb-2">{getMoodEmoji(result.rescheduled)}</div>
                    <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                      result.rescheduled 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      Verdict: {result.rescheduled ? 'Forgiven & Rescheduled' : 'Excuse Rejected'}
                    </span>
                  </div>

                  {/* Coach Response Speech Bubble */}
                  <div className="p-4 bg-slate-50 border border-slate-250 rounded-2xl relative">
                    <div className="absolute -top-2 left-6 px-2 bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 rounded-md shadow-xs">
                      Companion Coach
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed italic pt-1">
                      "{result.text}"
                    </p>
                  </div>

                  {/* Inline Trace Message Row */}
                  <div className={`p-3.5 rounded-xl border flex gap-3 items-start ${
                    result.rescheduled 
                      ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                      : 'bg-red-50/50 border-red-100 text-red-800'
                  }`} id="excuse-trace-line">
                    {result.rescheduled ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        System Trace Event
                      </p>
                      <p className="text-xs font-semibold leading-normal mt-0.5 font-mono">
                        {result.traceMessage}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-full bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-md"
                  >
                    Return to Timeline
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
