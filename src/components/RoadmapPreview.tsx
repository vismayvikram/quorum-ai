import { Subtask, TaskType } from '../types';

interface RoadmapPreviewProps {
  taskType: TaskType;
  subtasks: Partial<Subtask>[];
  onConfirm: () => void;
}

export function RoadmapPreview({ taskType, subtasks, onConfirm }: RoadmapPreviewProps) {
  if (!subtasks.length) return null;

  return (
    <div className="bg-slate-900 text-white p-8 rounded-2xl mt-8 shadow-xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-medium tracking-tight mb-1">Generated Roadmap</h2>
          <div className="flex items-center gap-2">
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium tracking-wider uppercase ${taskType === 'execution' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'}`}>
              {taskType.replace('_', ' ')}
            </span>
            <span className="text-sm text-slate-400">Strategy automatically selected.</span>
          </div>
        </div>
        <button 
          onClick={onConfirm}
          className="bg-white text-slate-900 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
        >
          Confirm Plan
        </button>
      </div>
      
      <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-800">
        {subtasks.sort((a, b) => (a.order || 0) - (b.order || 0)).map((st, i) => (
          <div key={st.id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            {/* Timeline dot */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-slate-700 text-slate-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              <span className="text-xs font-medium">{i + 1}</span>
            </div>
            
            {/* Card */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
              <h3 className="font-medium text-sm mb-1 text-slate-100">{st.title}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                <span>{st.estimatedDuration}m</span>
                {st.dependencies && st.dependencies.length > 0 && (
                  <span>{st.dependencies.length} deps</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
