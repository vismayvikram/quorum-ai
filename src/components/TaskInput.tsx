import { useState } from 'react';

interface TaskInputProps {
  onDecompose: (description: string, deadlineMinutes: number) => Promise<void>;
  isDecomposing: boolean;
}

export function TaskInput({ onDecompose, isDecomposing }: TaskInputProps) {
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState(24);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    await onDecompose(description, hours * 60);
    setDescription('');
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <h2 className="text-xl font-medium tracking-tight mb-4">New Task</h2>
      <div className="space-y-4">
        <textarea 
          className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
          placeholder="What do you need to get done?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          disabled={isDecomposing}
        />
        <div className="flex gap-4">
          <div className="flex-1 flex items-center border border-slate-200 rounded-lg bg-slate-50 px-3">
            <span className="text-sm text-slate-500 mr-2">Max Time:</span>
            <input 
              type="number" 
              className="bg-transparent border-none p-2 text-sm focus:outline-none w-16 text-slate-900 font-medium"
              value={hours}
              onChange={e => setHours(Number(e.target.value))}
              disabled={isDecomposing}
              min={1}
            />
            <span className="text-sm text-slate-500">hours</span>
          </div>
          <button 
            className="bg-slate-900 text-white px-6 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            onClick={handleSubmit}
            disabled={isDecomposing || !description.trim()}
          >
            {isDecomposing ? 'Decomposing...' : 'Decompose'}
          </button>
        </div>
      </div>
    </div>
  );
}
