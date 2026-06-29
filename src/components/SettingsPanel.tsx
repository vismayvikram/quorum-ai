import { useState, useEffect } from 'react';
import { getLocalIdentity } from '../lib/identity';
import { apiFetch } from '../lib/api';
import { Settings, Subtask } from '../types';
import { Lock, Unlock, RotateCcw, AlertTriangle, Calendar, Check, LogOut } from 'lucide-react';
import { googleSignIn, logoutGoogle, initGoogleAuth, getAccessToken } from '../lib/googleAuth';
import { GoogleCalendarService } from '../lib/googleCalendar';

interface SettingsPanelProps {
  isLocked: boolean;
  onTimeWarpApplied: () => void;
  onReset: () => void;
  subtasks: Subtask[];
}

export function SettingsPanel({ isLocked, onTimeWarpApplied, onReset, subtasks }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [offsetHours, setOffsetHours] = useState(0);

  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchSettings = () => {
    apiFetch('/api/settings', {
      headers: {
        'x-user-id': getLocalIdentity(),
        'x-timezone-offset': new Date().getTimezoneOffset().toString()
      }
    })
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSettings();
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleConnect = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleAccessToken(res.accessToken);
        setSyncMessage('Successfully connected Google Calendar!');
        setTimeout(() => setSyncMessage(null), 5000);
      }
    } catch (err: any) {
      setSyncMessage(`Connection failed: ${err.message}`);
    }
  };

  const handleGoogleDisconnect = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setGoogleAccessToken(null);
    setSyncMessage('Disconnected Google Calendar.');
    setTimeout(() => setSyncMessage(null), 5000);
  };

  const handleGoogleSync = async () => {
    const token = googleAccessToken || await getAccessToken();
    if (!token) {
      setSyncMessage('Google Calendar is not connected.');
      return;
    }

    try {
      setGoogleSyncing(true);
      setSyncMessage('Synchronizing subtasks...');
      const res = await GoogleCalendarService.syncSubtasks(subtasks, token);
      if (res.success) {
        setSyncMessage(`Synced ${res.count} items successfully!`);
      }
    } catch (err: any) {
      setSyncMessage(`Sync failed: ${err.message}`);
    } finally {
      setGoogleSyncing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    if (isLocked) return;
    setSettings(newSettings);
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getLocalIdentity(),
        'x-timezone-offset': new Date().getTimezoneOffset().toString()
      },
      body: JSON.stringify(newSettings)
    });
  };

  const handleTimeWarp = async (hours: number) => {
    if (isLocked) return;
    await apiFetch('/api/time/offset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getLocalIdentity(),
        'x-timezone-offset': new Date().getTimezoneOffset().toString()
      },
      body: JSON.stringify({ offsetMs: hours * 3600000 })
    });
    onTimeWarpApplied();
  };

  const addBlockedWindow = () => {
    if (isLocked || !settings) return;
    const now = Date.now();
    // Block out next 2 hours
    const newWindow = {
      start: now + 30 * 60 * 1000,
      end: now + 2.5 * 3600 * 1000,
      label: 'Blocked: Focused Deep Work'
    };
    saveSettings({
      ...settings,
      blockedWindows: [...settings.blockedWindows, newWindow]
    });
  };

  const clearBlockedWindows = () => {
    if (isLocked || !settings) return;
    saveSettings({
      ...settings,
      blockedWindows: []
    });
  };

  if (loading || !settings) return <div className="text-sm font-mono text-slate-400 p-4">Loading settings...</div>;

  return (
    <div className={`relative bg-white p-6 rounded-2xl shadow-sm border transition-all duration-300 ${isLocked ? 'border-red-200 bg-red-50/10' : 'border-slate-100'}`}>
      {/* Visual Overlay if Settings/Warp is locked */}
      {isLocked && (
        <div className="absolute inset-0 bg-slate-100/70 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6 z-10 text-center animate-fade-in">
          <div className="bg-red-500 text-white p-3 rounded-full shadow-lg mb-3">
            <Lock className="w-6 h-6 animate-bounce" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5 justify-center">
            Settings Panel Locked
          </h3>
          <p className="text-xs text-slate-500 mt-2 max-w-xs">
            A deadline tax effect has locked your settings and Time-Warp panel to prevent bypassing accountability. This tax expires at virtual midnight.
          </p>
        </div>
      )}

      <div className={`${isLocked ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black tracking-tight text-slate-900">System Configuration</h2>
          <span className="p-1.5 rounded-full bg-slate-100 text-slate-500">
            <Unlock className="w-4 h-4" />
          </span>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Calendar block-outs</h3>
            <p className="text-xs text-slate-500 mb-3">Add blocked windows to force the scheduler around them.</p>
            
            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {settings.blockedWindows.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No custom blocked windows set.</p>
              ) : (
                <div className="space-y-1">
                  {settings.blockedWindows.map((w, index) => (
                    <div key={index} className="flex justify-between items-center text-xs bg-white p-1.5 rounded border border-slate-100">
                      <span className="font-medium text-slate-700">{w.label}</span>
                      <span className="font-mono text-slate-400">
                        {new Date(w.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button 
                  className="flex-1 bg-white border border-slate-200 text-slate-700 text-xs py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  onClick={addBlockedWindow}
                >
                  + Add Block
                </button>
                {settings.blockedWindows.length > 0 && (
                  <button 
                    className="bg-red-50 text-red-600 border border-red-100 text-xs px-2.5 py-2 rounded-lg font-medium hover:bg-red-100 transition-colors"
                    onClick={clearBlockedWindows}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input 
                type="checkbox"
                checked={settings.developerTimeControlsEnabled}
                onChange={(e) => saveSettings({...settings, developerTimeControlsEnabled: e.target.checked})}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-sm font-bold text-slate-700">Enable Simulation Controls</span>
            </label>
            <p className="text-xs text-slate-400 mt-1 pl-7">Enables proactive timeline simulation and stress-testing.</p>
          </div>

          {settings.developerTimeControlsEnabled && (
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 mt-4">
              <h3 className="text-sm font-medium text-amber-900 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Timeline Simulation Engine
              </h3>
              <p className="text-xs text-amber-700 mb-3">Simulate going forward in time to test grace periods.</p>
              
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="0" max="24" step="0.5" 
                  value={offsetHours}
                  onChange={e => setOffsetHours(Number(e.target.value))}
                  className="flex-1 accent-amber-600 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-amber-900 w-16 text-right">
                  +{offsetHours} hrs
                </span>
              </div>
              <button 
                onClick={() => handleTimeWarp(offsetHours)}
                className="mt-3 w-full bg-amber-900 text-white text-xs font-medium py-2 rounded-lg hover:bg-amber-800 transition-colors"
              >
                Advance System Timeline
              </button>
            </div>
          )}

          {/* Google Calendar Sync Section */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Google Calendar</h3>
            <p className="text-xs text-slate-500 mb-3">
              Sync your scheduled subtasks directly to a dedicated Google Calendar.
            </p>

            {googleUser ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-100 text-emerald-800 p-2.5 rounded-xl">
                  <div className="flex items-center gap-1.5 font-medium truncate max-w-[180px]">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{googleUser.email || 'Connected'}</span>
                  </div>
                  <button 
                    onClick={handleGoogleDisconnect}
                    className="p-1 rounded hover:bg-emerald-100 text-emerald-700 shrink-0"
                    title="Disconnect Google account"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <button
                  onClick={handleGoogleSync}
                  disabled={googleSyncing || subtasks.length === 0}
                  className="w-full bg-slate-900 text-white text-xs font-medium py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {googleSyncing ? 'Syncing...' : 'Sync Timeline to Google Calendar'}
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGoogleConnect}
                className="w-full border border-slate-200 text-slate-700 text-xs py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Connect Google Calendar
              </button>
            )}

            {syncMessage && (
              <p className="text-[11px] font-medium text-slate-600 mt-2 text-center bg-slate-50 border border-slate-100 py-1.5 px-2.5 rounded-lg">
                {syncMessage}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button 
              onClick={onReset}
              className="w-full border border-slate-200 text-slate-500 hover:text-slate-700 text-xs py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Application State
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
