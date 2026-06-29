import React, { useState } from 'react';
import { Tone, TimeWindow } from '../types';

interface OnboardingFormProps {
  onComplete: (data: { goals: string; context: string; tone: Tone; focusHours: TimeWindow[] }) => void;
  onLogout?: () => void;
}

export function OnboardingForm({ onComplete, onLogout }: OnboardingFormProps) {
  const [goals, setGoals] = useState('');
  const [context, setContext] = useState('');
  const [tone, setTone] = useState<Tone>('neutral');
  const [startHour, setStartHour] = useState('09:00');
  const [endHour, setEndHour] = useState('17:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await onComplete({
      goals,
      context,
      tone,
      focusHours: [{ start: startHour, end: endHour }]
    });
    
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100 relative">
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="absolute top-6 right-6 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        )}
        <div className="mb-8">
          <h1 className="text-3xl font-medium tracking-tight mb-2">Welcome to your Agent</h1>
          <p className="text-slate-500">Let's set up your productivity companion.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">What are your primary goals?</label>
            <textarea 
              value={goals}
              onChange={e => setGoals(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all"
              placeholder="e.g., Ship my side project, finish my degree, manage daily chaos..."
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Any context the agent should know?</label>
            <textarea 
              value={context}
              onChange={e => setContext(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all"
              placeholder="e.g., I have ADHD, I procrastinate on writing tasks, I work best in bursts..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Accountability Tone</label>
            <div className="grid grid-cols-3 gap-3">
              {(['gentle', 'neutral', 'firm'] as Tone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${tone === t ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              How strict should the agent be when you miss deadlines?
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Preferred Focus Hours</label>
            <div className="flex items-center gap-4">
              <input 
                type="time" 
                value={startHour}
                onChange={e => setStartHour(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
                required
              />
              <span className="text-slate-400">to</span>
              <input 
                type="time" 
                value={endHour}
                onChange={e => setEndHour(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-slate-900 text-white rounded-lg p-4 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Initializing...' : 'Initialize Agent'}
          </button>
        </form>
      </div>
    </div>
  );
}
