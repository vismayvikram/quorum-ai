import { useState, useEffect } from 'react';
import { Subtask, TaskType } from '../types';
import { getLocalIdentity } from '../lib/identity';
import { apiFetch } from '../lib/api';
import { 
  X, Mic, MicOff, Play, CheckCircle2, ChevronRight, AlertTriangle, Clock, 
  Trash2, Plus, CornerDownRight, Check, Sparkles, Sliders, RefreshCw 
} from 'lucide-react';

interface TaskCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    description: string;
    deadlineMinutes: number;
    subtasks: Partial<Subtask>[];
    taskType: TaskType;
    priority: number;
  }) => Promise<void>;
}

export function TaskCreatorModal({ isOpen, onClose, onConfirm }: TaskCreatorModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [description, setDescription] = useState('');
  const [deadlineHours, setDeadlineHours] = useState('24');
  const [priority, setPriority] = useState(5);
  
  // Voice input state
  const [isListening, setIsListening] = useState(false);

  // Step 2: Decomposed Roadmap state
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>('execution');
  const [subtasks, setSubtasks] = useState<Partial<Subtask>[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Step 3: Success state
  const [isCommitting, setIsCommitting] = useState(false);

  // Reset modal state on open/close
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setDescription('');
      setDeadlineHours('24');
      setPriority(5);
      setSubtasks([]);
      setValidationError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Web Speech API trigger
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition API is not supported in this browser. Try Chrome, Safari, or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription((prev) => (prev ? prev + ' ' + transcript : transcript));
    };

    recognition.start();
  };

  // Step 1 -> Decompose
  const handleDecompose = async () => {
    if (!description.trim()) return;
    setIsDecomposing(true);
    setValidationError(null);
    try {
      const res = await apiFetch('/api/planner/decompose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': getLocalIdentity(),
          'x-timezone-offset': new Date().getTimezoneOffset().toString()
        },
        body: JSON.stringify({ 
          description, 
          deadlineMinutes: parseInt(deadlineHours) * 60 
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTaskType(data.taskType || 'execution');
        setSubtasks(data.subtasks || []);
        setStep(2);
      } else {
        throw new Error('Failed to decompose task');
      }
    } catch (e: any) {
      setValidationError('AI planning failed. Falling back to local template.');
      // Heuristic Fallback
      const isLearning = /learn|study|understand|course|read|research/i.test(description);
      const mockSubtasks: Partial<Subtask>[] = isLearning ? [
        { id: 'sb-1', title: 'Collect and research study materials', estimatedDuration: 30, dependencies: [], order: 1 },
        { id: 'sb-2', title: 'Study foundational theories & concepts', estimatedDuration: 60, dependencies: ['sb-1'], order: 2 },
        { id: 'sb-3', title: 'Construct physical practice exercises', estimatedDuration: 60, dependencies: ['sb-2'], order: 3 },
        { id: 'sb-4', title: 'Review completed items & wrap up', estimatedDuration: 30, dependencies: ['sb-3'], order: 4 },
      ] : [
        { id: 'sb-1', title: 'Set up development environment', estimatedDuration: 15, dependencies: [], order: 1 },
        { id: 'sb-2', title: 'Code core architecture and layout', estimatedDuration: 90, dependencies: ['sb-1'], order: 2 },
        { id: 'sb-3', title: 'Perform local checks & visual testing', estimatedDuration: 45, dependencies: ['sb-2'], order: 3 },
        { id: 'sb-4', title: 'Final deployment and review', estimatedDuration: 30, dependencies: ['sb-3'], order: 4 },
      ];
      setTaskType(isLearning ? 'learning_goal' : 'execution');
      setSubtasks(mockSubtasks);
      setStep(2);
    } finally {
      setIsDecomposing(false);
    }
  };

  // Check cycles in customized subtasks list
  const hasCycle = (list: Partial<Subtask>[]): boolean => {
    const adj = new Map<string, string[]>();
    list.forEach(st => {
      adj.set(st.id!, st.dependencies || []);
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (id: string): boolean => {
      if (recStack.has(id)) return true;
      if (visited.has(id)) return false;

      visited.add(id);
      recStack.add(id);

      const deps = adj.get(id) || [];
      for (const depId of deps) {
        if (dfs(depId)) return true;
      }

      recStack.delete(id);
      return false;
    };

    for (const st of list) {
      if (dfs(st.id!)) return true;
    }
    return false;
  };

  // Handle updates to subtask fields in Step 2
  const updateSubtask = (id: string, fields: Partial<Subtask>) => {
    const updated = subtasks.map(st => {
      if (st.id === id) {
        return { ...st, ...fields };
      }
      return st;
    });

    // Run structural cycles check if dependencies changed
    if (fields.dependencies) {
      if (hasCycle(updated)) {
        setValidationError("Dependency cycle detected! Cycles are not allowed in the schedule.");
        return;
      } else {
        setValidationError(null);
      }
    }

    setSubtasks(updated);
  };

  // Add subtask in custom step 2
  const addSubtask = () => {
    const newId = `custom-sb-${Math.random().toString(36).substring(7)}`;
    const newSub: Partial<Subtask> = {
      id: newId,
      title: 'New Milestone Item',
      estimatedDuration: 30,
      dependencies: [],
      order: subtasks.length + 1,
      taskType: taskType
    };
    setSubtasks([...subtasks, newSub]);
  };

  // Delete subtask in Step 2
  const deleteSubtask = (id: string) => {
    const remaining = subtasks.filter(st => st.id !== id);
    // clean up any dependencies on deleted item
    const cleaned = remaining.map(st => ({
      ...st,
      dependencies: st.dependencies?.filter(depId => depId !== id) || []
    }));
    setSubtasks(cleaned);
  };

  // Step 2 -> Step 3 Commit Plan
  const handleCommit = async () => {
    if (validationError) return;
    setIsCommitting(true);
    try {
      const deadlineMinutes = parseInt(deadlineHours) * 60;
      await onConfirm({
        description,
        deadlineMinutes,
        subtasks,
        taskType,
        priority
      });
      setStep(3);
    } catch (e) {
      console.error(e);
      setValidationError("Failed to schedule plan. Verify focus windows and settings.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide uppercase">New Accountability Roadmap</h3>
              <p className="text-[10px] text-slate-400">Step {step} of 3 • AI Decomposition & Deterministic Placement</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Progress Bar */}
        <div className="h-1 w-full bg-slate-100 flex shrink-0">
          <div className={`h-full bg-emerald-500 transition-all duration-300 ${
            step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'
          }`} />
        </div>

        {/* Modal Body (Scrollable content) */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">What's the big task?</label>
                <div className="relative">
                  <textarea
                    className="w-full h-32 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-sm resize-none pr-12"
                    placeholder="E.g., Finish my final term paper in Computer Architecture, including diagrams..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <button
                    onClick={toggleListening}
                    className={`absolute bottom-3 right-3 p-2.5 rounded-full transition-all duration-200 ${
                      isListening 
                        ? 'bg-red-500 text-white animate-bounce shadow-md' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title="Dictate description"
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
                {isListening && (
                  <p className="text-xs text-red-500 font-medium mt-1 animate-pulse flex items-center gap-1">
                    ● Listening... speak naturally. Text will output in description.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hard Deadline (Hours)</label>
                  <div className="relative">
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-sm font-mono"
                      value={deadlineHours}
                      onChange={(e) => setDeadlineHours(e.target.value)}
                      min="1"
                      max="168"
                    />
                    <Clock className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Maximum hours allocated to final completion.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Priority (1 - 10)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-900"
                      value={priority}
                      onChange={(e) => setPriority(parseInt(e.target.value))}
                    />
                    <span className="w-8 text-center font-mono text-sm font-bold bg-slate-900 text-white py-1 rounded">
                      {priority}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Feeds directly into the Urgency deterministic engine.</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center bg-slate-900 text-white p-3.5 rounded-2xl">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Strategy Auto-Selected</span>
                  <h4 className="text-sm font-bold capitalize mt-0.5">
                    {taskType === 'learning_goal' ? '📘 Curriculum Progression' : '🛠️ Checklist Execution'}
                  </h4>
                </div>
                <button
                  onClick={addSubtask}
                  className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center gap-1 shrink-0 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Step</span>
                </button>
              </div>

              {validationError && (
                <div className="bg-red-50 border border-red-100 text-red-700 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Subtasks DAG customizations list */}
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {subtasks.map((st, index) => (
                  <div 
                    key={st.id} 
                    className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col gap-2.5 relative group hover:border-slate-300 transition-colors"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-mono text-xs text-slate-400 font-bold w-4 shrink-0">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          className="bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none text-sm font-semibold text-slate-800 flex-1 min-w-0 py-0.5"
                          value={st.title}
                          onChange={(e) => updateSubtask(st.id!, { title: e.target.value })}
                        />
                      </div>
                      
                      <button
                        onClick={() => deleteSubtask(st.id!)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete Milestone Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pl-6">
                      {/* Duration modification */}
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Duration:</span>
                        <input
                          type="number"
                          className="w-16 px-1.5 py-0.5 text-xs border border-slate-200 rounded text-center font-mono font-bold"
                          value={st.estimatedDuration || 15}
                          onChange={(e) => updateSubtask(st.id!, { estimatedDuration: parseInt(e.target.value) || 15 })}
                          min="5"
                        />
                        <span className="text-[10px] font-mono text-slate-500">min</span>
                      </div>

                      {/* Dependencies selector */}
                      <div className="flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Depends on:</span>
                        <select
                          className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 font-medium max-w-[120px]"
                          value={st.dependencies?.[0] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateSubtask(st.id!, { dependencies: val ? [val] : [] });
                          }}
                        >
                          <option value="">None (Root)</option>
                          {subtasks
                            .filter(other => other.id !== st.id)
                            .map(other => (
                              <option key={other.id} value={other.id}>
                                {other.title?.substring(0, 20)}...
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-8 flex flex-col items-center text-center space-y-4 animate-fade-in">
              <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full shadow-lg border-4 border-emerald-50">
                <Check className="w-10 h-10 animate-scale-up" style={{ strokeWidth: 3 }} />
              </div>
              <h4 className="text-xl font-bold text-slate-900">Roadmap Committed Successfully!</h4>
              <p className="text-sm text-slate-500 max-w-sm">
                The planning system has computed the optimal time frames and committed your milestones safely onto your active calendar view.
              </p>
              <p className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50/50 px-3 py-1.5 rounded-full">
                ACTIVE ACCOUNTABILITY TRIGGERED
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
          {step === 1 && (
            <>
              <p className="text-[10px] text-slate-500 max-w-sm italic">
                Decomposition is done with a local fallback logic or AI planning depending on your active model setup.
              </p>
              <button
                onClick={handleDecompose}
                disabled={!description.trim() || isDecomposing}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                {isDecomposing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Planning...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Steps</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all"
              >
                Back to Inputs
              </button>

              <button
                onClick={handleCommit}
                disabled={!!validationError || isCommitting}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Scheduling...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Commit Roadmap</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <button
              onClick={onClose}
              className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
            >
              Close and View Calendar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
