import { useState, useEffect, useRef } from 'react';
import { useProfile } from './hooks/useProfile';
import { AuthForm } from './components/AuthForm';
import { OnboardingForm } from './components/OnboardingForm';
import { SettingsPanel } from './components/SettingsPanel';
import { CompanionHub } from './components/CompanionHub';
import { CalendarView } from './components/CalendarView';
import { TaskSidebar } from './components/TaskSidebar';
import { TaskCreatorModal } from './components/TaskCreatorModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { InsightCard } from './components/InsightCard';
import { getLocalIdentity } from './lib/identity';
import { apiFetch } from './lib/api';
import { Subtask, TaskType, TaxEffect, Tone, Task } from './types';
import { 
  Clock, ShieldAlert, CheckCircle2, Flame, RefreshCw, AlertTriangle, 
  Plus, Sparkles, X, ChevronDown, ChevronUp, Sliders, MessageSquare 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { profile, loading, error, saveProfile, needsLogin, refreshProfile, logout } = useProfile();
  
  const [isTaskCreatorOpen, setIsTaskCreatorOpen] = useState(false);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Scheduler & Accountability State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [taxes, setTaxes] = useState<TaxEffect[]>([]);
  const [effectiveTone, setEffectiveTone] = useState<Tone>('neutral');
  const [virtualTime, setVirtualTime] = useState<number>(Date.now());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Daily AI Briefing State
  const [briefing, setBriefing] = useState<string | null>(null);
  const [dismissedDay, setDismissedDay] = useState<string | null>(null);
  const lastBriefingFetchRef = useRef<string | null>(null);

  const getVirtualDayKey = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  // Collapsible toggle for settings
  const [showSettings, setShowSettings] = useState(false);

  // Poll scheduler and accountability status
  useEffect(() => {
    if (!profile) return;

    const fetchStatus = async () => {
      try {
        const res = await apiFetch('/api/scheduler/status', {
          headers: {
            'x-user-id': getLocalIdentity(),
            'x-timezone-offset': new Date().getTimezoneOffset().toString()
          }
        });
        if (res.ok) {
          const data = await res.json();
          setTasks(data.tasks || []);
          setSubtasks(data.subtasks || []);
          setTaxes(data.taxes || []);
          setEffectiveTone(data.effectiveTone || profile.tone);
          setVirtualTime(data.virtualTime || Date.now());
        }
      } catch (e) {
        console.error('Failed to fetch status', e);
      }
    };

    fetchStatus();
    // Poll every 4 seconds to stay synchronized with virtual time / background checks
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [profile, refreshTrigger]);

  // Fetch Daily AI Briefing
  useEffect(() => {
    if (!profile) return;

    const dayKey = getVirtualDayKey(virtualTime);

    const fetchBriefing = async () => {
      if (dismissedDay === dayKey) {
        setBriefing(null);
        return;
      }

      // Optimization: avoid redundant fetches if the context (day + refresh trigger) hasn't changed
      const fetchKey = `${dayKey}-${refreshTrigger}`;
      if (lastBriefingFetchRef.current === fetchKey) return;
      lastBriefingFetchRef.current = fetchKey;

      try {
        const res = await apiFetch('/api/coach/briefing', {
          headers: {
            'x-user-id': getLocalIdentity(),
            'x-timezone-offset': new Date().getTimezoneOffset().toString()
          }
        });
        if (res.ok) {
          const data = await res.json();
          setBriefing(data.briefing);
        }
      } catch (e) {
        console.error('Failed to fetch daily briefing:', e);
      }
    };

    fetchBriefing();
  }, [profile, getVirtualDayKey(virtualTime), dismissedDay, refreshTrigger]);

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  // Step 3 Confirmation action triggered inside TaskCreatorModal
  const handleCreateRoadmap = async (data: {
    description: string;
    deadlineMinutes: number;
    subtasks: Partial<Subtask>[];
    taskType: TaskType;
    priority: number;
  }) => {
    const res = await apiFetch('/api/scheduler/commit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getLocalIdentity(),
        'x-timezone-offset': new Date().getTimezoneOffset().toString()
      },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      triggerRefresh();
    } else {
      throw new Error('Scheduler commitment failed');
    }
  };

  const handleCompleteSubtask = async (subtaskId: string) => {
    try {
      const res = await apiFetch('/api/scheduler/subtask/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': getLocalIdentity(),
          'x-timezone-offset': new Date().getTimezoneOffset().toString()
        },
        body: JSON.stringify({ subtaskId })
      });
      if (res.ok) {
        triggerRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = async () => {
    try {
      await apiFetch('/api/scheduler/reset', {
        method: 'POST',
        headers: {
          'x-user-id': getLocalIdentity(),
          'x-timezone-offset': new Date().getTimezoneOffset().toString()
        }
      });
      triggerRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const formatVirtualClock = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleDismissBriefing = () => {
    const currentDayKey = getVirtualDayKey(virtualTime);
    setDismissedDay(currentDayKey);
    setBriefing(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-medium text-slate-500 font-mono tracking-wider">INITIALIZING SYSTEM</p>
        </div>
      </div>
    );
  }

  if (needsLogin) {
    return <AuthForm onAuthSuccess={refreshProfile} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-red-500 p-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-red-100 max-w-md w-full">
          <h2 className="text-lg font-bold mb-2">Initialization Error</h2>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!profile || !profile.goals || profile.goals.trim() === '') {
    return <OnboardingForm onComplete={saveProfile} onLogout={logout} />;
  }

  const isSettingsLocked = taxes.some(t => t.type === 'lock_element' && t.active);
  const isMaxFirmnessActive = taxes.some(t => t.type === 'max_firmness' && t.active);
  const isShortenActive = taxes.some(t => t.type === 'shorten_next_block' && t.active);

  const overdueSubtasksCount = subtasks.filter(st => {
    if (st.status === 'completed' || st.status === 'missed' || !st.assignedSlot) return false;
    const graceMinutes = isMaxFirmnessActive ? 0 : (st.gracePeriodMinutes ?? 30);
    const deadlineWithGrace = st.assignedSlot.end + graceMinutes * 60 * 1000;
    return virtualTime > st.assignedSlot.end && virtualTime <= deadlineWithGrace;
  }).length;

  return (
    <div className={`h-screen flex flex-col transition-colors duration-500 ${isMaxFirmnessActive ? 'bg-red-50/10' : 'bg-slate-50'} text-slate-900 font-sans overflow-hidden`}>
      
      {/* Unified Simulation Status Bar */}
      <div className="bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="max-w-[1500px] mx-auto px-6 py-1.5 flex justify-between items-center text-[10px] font-mono tracking-[0.15em] text-white">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold">{formatVirtualClock(virtualTime)}</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 font-bold uppercase">
            <span>System Online</span>
          </div>
        </div>
      </div>

      {/* Daily AI Briefing Banner */}
      {briefing && (
        <div className="bg-blue-600 text-white shadow-lg animate-slide-down shrink-0">
          <div className="max-w-[1500px] mx-auto px-6 py-3.5 flex justify-between items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0 animate-bounce" />
              <p className="truncate leading-relaxed">{briefing}</p>
            </div>
            <button
              onClick={handleDismissBriefing}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
              title="Dismiss Briefing"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container - scrollable content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Tax & Urgent Warnings Banners */}
        {(taxes.length > 0 || overdueSubtasksCount > 0) && (
          <div className="max-w-[1500px] mx-auto w-full px-6 mt-4 space-y-3 shrink-0">
            {overdueSubtasksCount > 0 && (
              <div className="bg-amber-500 text-white px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-pulse shadow-md">
                <AlertTriangle className="w-5 h-5 text-white shrink-0" />
                <div>
                  <span className="font-bold">URGENT DEADLINE OVERRUN:</span> You have {overdueSubtasksCount} task{overdueSubtasksCount > 1 ? 's' : ''} currently exceeding scheduled focus hours! Complete them immediately before the grace period expires to avoid penalty taxes.
                </div>
              </div>
            )}
            {isShortenActive && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-fade-in shadow-sm">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">TAX ACTIVE: Schedule compression.</span> Subtasks are compacted due to a past miss. Finish tasks on time to lift constraints.
                </div>
              </div>
            )}
            {isMaxFirmnessActive && (
              <div className="bg-red-600 text-white px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-pulse shadow-md">
                <Flame className="w-5 h-5 text-white shrink-0" />
                <div>
                  <span className="font-bold">CONSEQUENCE TRIGGERED: MAXIMUM FIRMNESS ACTIVE.</span> Zero-minute grace periods are active. All task slots expire instantly at their scheduled endpoints until virtual midnight!
                </div>
              </div>
            )}
          </div>
        )}

        <div className="max-w-[1500px] mx-auto w-full px-6 mt-4 flex flex-col flex-1 min-h-0">
          <header className="mb-4 flex justify-between items-start shrink-0 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 leading-none">Quorum</h1>
              <p className="text-slate-400 text-sm font-medium italic tracking-tight">Decisions made. Deadlines kept.</p>
            </div>
            
            <div className="flex flex-col items-end gap-2 pt-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-full shadow-sm hover:shadow-md transition-shadow cursor-default">
                  <div className={`h-1.5 w-1.5 rounded-full ${effectiveTone === 'gentle' ? 'bg-emerald-500' : effectiveTone === 'firm' ? 'bg-amber-500' : 'bg-red-500'} shadow-[0_0_4px_rgba(0,0,0,0.1)]`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{effectiveTone}</span>
                  <span className="w-px h-3 bg-slate-200 mx-0.5" />
                  <span className="text-[10px] font-mono font-bold text-slate-400">ID: {profile?.id?.substring(0, 8)}</span>
                </div>
                <button
                  onClick={logout}
                  className="px-3.5 py-1.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-600 transition-colors cursor-pointer shadow-sm shadow-slate-950/5 flex items-center gap-1.5"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          {/* 70/30 Calendar View & Sidebar Grid Layout - Dynamic Height */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start flex-1 min-h-0 pb-6 h-[calc(100vh-160px)]">
            
            {/* Left Column: Main Week/Day Calendar view */}
            <div className="h-full min-h-0">
              <CalendarView 
                subtasks={subtasks}
                tasks={tasks}
                virtualTime={virtualTime}
                settings={storeGetDocPlaceholderSettings()} 
                onCompleteSubtask={handleCompleteSubtask}
              />
            </div>
            
            {/* Right Column: Tabbed Sidebar, Insights & Controls */}
            <div className="space-y-6 h-full overflow-y-auto pr-2 scrollbar-thin">
              {/* Sidebar with Selected Day & Global Urgency list tabs */}
              <TaskSidebar 
                subtasks={subtasks}
                tasks={tasks}
                virtualTime={virtualTime}
                onCompleteSubtask={handleCompleteSubtask}
                onSubtaskClick={(id) => setSelectedSubtaskId(id)}
              />

              {/* Real Insights trend analyzer card */}
              <InsightCard lastUpdated={refreshTrigger} />

              {/* Collapsible config controls panel */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full px-5 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100/70 transition-colors text-slate-700 font-bold text-xs uppercase tracking-wider"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-slate-500" />
                    <span>Simulation & System Configuration</span>
                  </span>
                  {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showSettings && (
                  <div className="p-4 border-t border-slate-100 bg-white">
                    <SettingsPanel 
                      isLocked={isSettingsLocked} 
                      onTimeWarpApplied={triggerRefresh}
                      onReset={handleReset}
                      subtasks={subtasks}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-4 z-40">
        <button
          onClick={() => setIsChatOpen(true)}
          className="p-3.5 bg-white text-slate-700 rounded-full shadow-xl hover:bg-slate-50 transition-all duration-300 hover:scale-105 border border-slate-200 flex items-center justify-center group"
          title="Open Companion Chat"
          id="floating-chat-launcher"
        >
          <MessageSquare className="w-5 h-5 text-sky-500" />
        </button>

        <button
          onClick={() => setIsTaskCreatorOpen(true)}
          className="p-4 bg-slate-900 text-white rounded-full shadow-2xl hover:bg-slate-800 transition-all duration-300 hover:scale-105 border border-slate-700 flex items-center justify-center group"
          title="Schedule New Task"
          id="floating-task-launcher"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Slide-in Companion Drawer */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Companion Hub</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Monitoring</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-2.5 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <CompanionHub 
                  subtasks={subtasks}
                  taxes={taxes}
                  virtualTime={virtualTime}
                  tone={effectiveTone}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Modal for Task Creator */}
      <TaskCreatorModal 
        isOpen={isTaskCreatorOpen}
        onClose={() => setIsTaskCreatorOpen(false)}
        onConfirm={handleCreateRoadmap}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        subtask={subtasks.find(st => st.id === selectedSubtaskId) || null}
        tasks={tasks}
        allSubtasks={subtasks}
        virtualTime={virtualTime}
        taxes={taxes}
        isOpen={!!selectedSubtaskId}
        onClose={() => setSelectedSubtaskId(null)}
        onComplete={handleCompleteSubtask}
      />
    </div>
  );

  // Helper placeholder so settings are fetched dynamically or bound to current settings in settings panel
  function storeGetDocPlaceholderSettings() {
    // Return a structured object that bindings can read directly. SettingsPanel will manage writing modifications to /api/settings.
    // In our dual-mode setup, we fetch this in our calendar components or from the active scheduler profile.
    // Let's pass the default structure so it doesn't fail before loading settings.
    return {
      userId: getLocalIdentity(),
      blockedWindows: [],
      durationMultiplier: 1.0,
      developerTimeControlsEnabled: true
    };
  }
}
