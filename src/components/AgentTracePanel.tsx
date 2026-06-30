import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, Sparkles, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

interface AgentTracePanelProps {
  traceMessages: string[];
}

export const AgentTracePanel: React.FC<AgentTracePanelProps> = ({ traceMessages }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!traceMessages || traceMessages.length === 0) return null;

  const getAgentIconAndName = (msg: string) => {
    const uppercaseMsg = msg.toUpperCase();
    if (uppercaseMsg.includes('PLANNER')) {
      return {
        name: 'Planner Agent',
        icon: <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />,
        bgColor: 'bg-sky-50 border-sky-100',
        textColor: 'text-sky-800'
      };
    } else if (uppercaseMsg.includes('VALIDATOR')) {
      return {
        name: 'DAG Validator',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
        bgColor: 'bg-emerald-50 border-emerald-100',
        textColor: 'text-emerald-800'
      };
    } else if (uppercaseMsg.includes('SPECULATIVE PREVIEW')) {
      return {
        name: 'Scheduler Agent (Speculative Preview)',
        icon: <Clock className="w-4 h-4 text-amber-500/70 shrink-0" />,
        bgColor: 'bg-amber-50/50 border-amber-100/70 border-dashed',
        textColor: 'text-amber-700/90'
      };
    } else if (uppercaseMsg.includes('SCHEDULER')) {
      return {
        name: 'Scheduler Agent',
        icon: <Clock className="w-4 h-4 text-amber-500 shrink-0" />,
        bgColor: 'bg-amber-50 border-amber-100',
        textColor: 'text-amber-800'
      };
    } else if (uppercaseMsg.includes('ACCOUNTABILITY')) {
      return {
        name: 'Accountability Agent',
        icon: <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />,
        bgColor: 'bg-red-50 border-red-100',
        textColor: 'text-red-800'
      };
    }
    return {
      name: 'Agent System',
      icon: <Cpu className="w-4 h-4 text-slate-500 shrink-0" />,
      bgColor: 'bg-slate-50 border-slate-100',
      textColor: 'text-slate-800'
    };
  };

  return (
    <div className="border border-slate-200/80 rounded-2xl bg-slate-50/50 overflow-hidden shadow-xs" id="agent-trace-panel">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 flex justify-between items-center hover:bg-slate-100/50 transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Cpu className="w-4 h-4 text-slate-500 animate-pulse" />
          <span>{traceMessages.length} agents reasoned about this plan — view trace</span>
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-white">
          <div className="relative border-l border-slate-100 pl-4 ml-2.5 space-y-4">
            {traceMessages.map((msg, index) => {
              const info = getAgentIconAndName(msg);
              return (
                <div key={index} className="relative">
                  {/* Icon Node */}
                  <div className="absolute -left-[27px] top-0.5 bg-white p-1 rounded-full border border-slate-100 shadow-sm flex items-center justify-center">
                    {info.icon}
                  </div>
                  {/* Content Box */}
                  <div className={`p-3 rounded-xl border ${info.bgColor} flex flex-col gap-0.5 shadow-xs`}>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {info.name}
                    </span>
                    <p className={`text-xs font-medium leading-relaxed ${info.textColor}`}>
                      {msg}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
