import React, { useState, useRef, useEffect } from 'react';
import { UrgencyBreakdown } from '../types';
import { Flame, Info } from 'lucide-react';

interface UrgencyBreakdownTooltipProps {
  breakdown?: UrgencyBreakdown;
  score: number;
  children: React.ReactNode;
}

export const UrgencyBreakdownTooltip: React.FC<UrgencyBreakdownTooltipProps> = ({
  breakdown,
  score,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!breakdown) {
    return <>{children}</>;
  }

  const factors = [
    {
      name: 'Timeline Pressure',
      weight: breakdown.timePressure.weight,
      weighted: breakdown.timePressure.weighted,
      raw: breakdown.timePressure.raw,
    },
    {
      name: 'Task Priority',
      weight: breakdown.priority.weight,
      weighted: breakdown.priority.weighted,
      raw: breakdown.priority.raw,
    },
    {
      name: 'Dependency Chain',
      weight: breakdown.dependency.weight,
      weighted: breakdown.dependency.weighted,
      raw: breakdown.dependency.raw,
    },
    {
      name: 'Historical Failure Risk',
      weight: breakdown.historicalRisk.weight,
      weighted: breakdown.historicalRisk.weighted,
      raw: breakdown.historicalRisk.raw,
    },
  ];

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div 
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={(e) => e.stopPropagation()}
      id="urgency-tooltip-wrapper"
    >
      <div 
        onClick={handleToggle}
        className="cursor-help focus:outline-none"
        id="urgency-tooltip-trigger"
      >
        {children}
      </div>

      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute z-[100] right-0 bottom-full mb-2 w-72 bg-white rounded-2xl border border-slate-200 p-4 shadow-xl text-slate-800 transition-all text-xs font-sans pointer-events-auto"
          id="urgency-tooltip-card"
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-2.5 mb-2.5 border-b border-slate-100" id="urgency-tooltip-header">
            <span className="font-black text-slate-900 flex items-center gap-1 uppercase tracking-wider text-[10px]">
              <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              Urgency Equation
            </span>
            <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
              Score: {score}
            </span>
          </div>

          {/* Rows */}
          <div className="space-y-2.5" id="urgency-tooltip-rows">
            {factors.map((f, idx) => (
              <div key={idx} className="flex flex-col gap-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700 text-[10px] uppercase tracking-wide">
                    {f.name}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-500">
                    +{f.weighted} <span className="text-[8px] text-slate-400">({(f.weight * 100)}%)</span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                  <span className="italic truncate max-w-[240px] font-medium">{f.raw}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom helper */}
          <div className="mt-3 pt-2 border-t border-slate-100 text-[9px] font-medium text-slate-400 flex items-center gap-1" id="urgency-tooltip-footer">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            Weighted dynamically. Multiplied if blocking others.
          </div>

          {/* Arrow */}
          <div className="absolute top-full right-4 border-8 border-transparent border-t-white" />
          <div className="absolute top-full right-4 border-8 border-transparent border-t-slate-200 -z-10 translate-y-[1px]" />
        </div>
      )}
    </div>
  );
};
