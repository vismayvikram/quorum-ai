import { useState, useEffect } from 'react';
import { getLocalIdentity } from '../lib/identity';
import { apiFetch } from '../lib/api';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';

interface InsightData {
  completionRate: number;
  eveningMissRate: number;
  learningGoalMissRate: number;
  executionMissRate: number;
  totalCount: number;
  completedCount: number;
  missedCount: number;
  insights: string[];
}

interface InsightCardProps {
  lastUpdated: number;
}

export function InsightCard({ lastUpdated }: InsightCardProps) {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchInsights = async () => {
    try {
      const res = await apiFetch('/api/coach/insights', {
        headers: {
          'x-user-id': getLocalIdentity(),
          'x-timezone-offset': new Date().getTimezoneOffset().toString()
        }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to fetch insights:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [lastUpdated]);

  if (loading) {
    return (
      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-center py-8 font-mono text-[10px] text-slate-400">
        <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
        <span>Syncing Data Patterns...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      {/* Compact Header */}
      <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
          <span>Real-time Insights</span>
        </h3>
        <span className="text-[9px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-bold">
          {data.totalCount} Events
        </span>
      </div>

      <div className="p-4 max-height-[320px] overflow-y-auto scrollbar-thin">
        {data.totalCount === 0 ? (
          <div className="text-center py-4 text-slate-400">
            <Lightbulb className="w-6 h-6 mx-auto text-slate-300 stroke-[1.5] mb-2" />
            <p className="text-[10px] font-medium leading-relaxed">No history logged yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Inline Completion Rate */}
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Performance Rate</span>
              <span className="text-sm font-bold font-mono text-white">
                {data.completionRate}%
              </span>
            </div>

            {/* Dynamic Insight Bullet Points */}
            <div className="space-y-2">
              {data.insights.slice(0, isExpanded ? undefined : 1).map((insight, idx) => (
                <div key={idx} className="flex gap-2 items-start text-[11px] text-slate-600 bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100/50">
                  <Sparkles className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="leading-normal font-medium">{insight}</p>
                </div>
              ))}
            </div>

            {data.insights.length > 1 && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
              >
                {isExpanded ? 'Show Less' : `+${data.insights.length - 1} More Insights`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
