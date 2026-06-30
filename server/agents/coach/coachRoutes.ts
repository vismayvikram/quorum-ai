import { Router } from 'express';
import { requireLocalIdentity, AuthenticatedRequest } from '../../identity/LocalIdentity';
import { store } from '../../db/store';
import { CoachEngine } from './CoachEngine';
import { Profile, Subtask, TaxEffect } from '../../../src/types';
import { VirtualClock } from '../../time/VirtualClock';
import { DeterministicScheduler } from '../../scheduler/DeterministicScheduler';

export const coachRouter = Router();

coachRouter.post('/coach/chat', requireLocalIdentity, async (req: AuthenticatedRequest, res) => {
  try {
    const { messages } = req.body;
    const userId = req.userId!;

    const profile = store.getDoc('profiles', userId) as Profile;
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found. Please complete onboarding first.' });
    }

    const subtasks = store.query('subtasks', s => s.userId === userId) as Subtask[];
    const activeTaxes = store.query('taxes', t => t.userId === userId && t.active) as TaxEffect[];

    // Always fetch live virtual time to prevent Time-Warp session caching or leakage
    const currentVirtualTime = VirtualClock.getVirtualTime();

    const result = await CoachEngine.generateResponse(
      messages || [],
      profile,
      subtasks,
      activeTaxes,
      currentVirtualTime
    );

    let actionsApplied = false;
    const actionResults: { type: string; subtaskId?: string; status: 'success' | 'failed'; reason?: string }[] = [];

    // Apply any actions returned by the CoachEngine
    if (result.actions && Array.isArray(result.actions)) {
      for (const action of result.actions) {
        try {
          if (action.type === 'reschedule_subtask') {
            if (!action.subtaskId) {
              actionResults.push({ type: 'reschedule_subtask', status: 'failed', reason: 'Missing subtaskId' });
              continue;
            }
            const subtask = store.getDoc('subtasks', action.subtaskId) as Subtask;
            if (!subtask) {
              actionResults.push({ type: 'reschedule_subtask', subtaskId: action.subtaskId, status: 'failed', reason: 'Subtask not found (might have been deleted)' });
              continue;
            }
            if (subtask.userId !== userId) {
              actionResults.push({ type: 'reschedule_subtask', subtaskId: action.subtaskId, status: 'failed', reason: 'Access denied: subtask ownership check failed' });
              continue;
            }

            const settings = store.getDoc('settings', userId) || {};
            const { scheduledSubtasks: rescheduled } = DeterministicScheduler.schedule(
              [{ ...subtask, status: 'pending' }],
              profile,
              settings,
              action.newStartTime || currentVirtualTime,
              req.timezoneOffset || 0
            );

            if (rescheduled && rescheduled.length > 0) {
              store.setDoc('subtasks', subtask.id, rescheduled[0]);
              actionsApplied = true;
              actionResults.push({ type: 'reschedule_subtask', subtaskId: action.subtaskId, status: 'success' });
            } else {
              actionResults.push({ type: 'reschedule_subtask', subtaskId: action.subtaskId, status: 'failed', reason: 'Deterministic scheduler failed to find a valid slot (focus hours or blocked windows).' });
            }

          } else if (action.type === 'complete_subtask') {
            if (!action.subtaskId) {
              actionResults.push({ type: 'complete_subtask', status: 'failed', reason: 'Missing subtaskId' });
              continue;
            }
            const subtask = store.getDoc('subtasks', action.subtaskId) as Subtask;
            if (!subtask) {
              actionResults.push({ type: 'complete_subtask', subtaskId: action.subtaskId, status: 'failed', reason: 'Subtask not found (might have been deleted)' });
              continue;
            }
            if (subtask.userId !== userId) {
              actionResults.push({ type: 'complete_subtask', subtaskId: action.subtaskId, status: 'failed', reason: 'Access denied: subtask ownership check failed' });
              continue;
            }

            store.updateDoc('subtasks', action.subtaskId, { status: 'completed' });
            
            // Check if all subtasks for the task are completed
            const taskId = subtask.taskId;
            const allSubtasks = store.query('subtasks', s => s.taskId === taskId) as Subtask[];
            const allCompleted = allSubtasks.every(s => s.status === 'completed' || s.status === 'missed');
            if (allCompleted) {
              store.updateDoc('tasks', taskId, { status: 'completed' });
            }
            actionsApplied = true;
            actionResults.push({ type: 'complete_subtask', subtaskId: action.subtaskId, status: 'success' });

          } else if (action.type === 'delete_subtask') {
            if (!action.subtaskId) {
              actionResults.push({ type: 'delete_subtask', status: 'failed', reason: 'Missing subtaskId' });
              continue;
            }
            const subtask = store.getDoc('subtasks', action.subtaskId) as Subtask;
            if (!subtask) {
              actionResults.push({ type: 'delete_subtask', subtaskId: action.subtaskId, status: 'failed', reason: 'Subtask not found (might have been deleted)' });
              continue;
            }
            if (subtask.userId !== userId) {
              actionResults.push({ type: 'delete_subtask', subtaskId: action.subtaskId, status: 'failed', reason: 'Access denied: subtask ownership check failed' });
              continue;
            }

            store.setDoc('subtasks', action.subtaskId, undefined);
            // Clean up from other subtasks' dependencies
            const otherSubtasks = store.query('subtasks', s => s.userId === userId) as Subtask[];
            otherSubtasks.forEach(s => {
              if (s.dependencies?.includes(action.subtaskId)) {
                const updatedDeps = s.dependencies.filter(id => id !== action.subtaskId);
                store.updateDoc('subtasks', s.id, { dependencies: updatedDeps });
              }
            });
            actionsApplied = true;
            actionResults.push({ type: 'delete_subtask', subtaskId: action.subtaskId, status: 'success' });

          } else if (action.type === 'replan_pending') {
            const pendingSubtasks = store.query('subtasks', s => s.userId === userId && s.status === 'pending') as Subtask[];
            const settings = store.getDoc('settings', userId) as any;
            if (!settings) {
              actionResults.push({ type: 'replan_pending', status: 'failed', reason: 'User settings not found' });
              continue;
            }
            if (pendingSubtasks.length === 0) {
              actionResults.push({ type: 'replan_pending', status: 'failed', reason: 'No pending subtasks found to reschedule' });
              continue;
            }

            const replanStartMs = action.replanStart || currentVirtualTime;
            const { scheduledSubtasks: rescheduled } = DeterministicScheduler.schedule(
              pendingSubtasks,
              profile,
              settings,
              replanStartMs,
              0
            );
            rescheduled.forEach(st => {
              store.setDoc('subtasks', st.id, st);
            });
            actionsApplied = true;
            actionResults.push({ type: 'replan_pending', status: 'success' });
          } else {
            actionResults.push({ type: action.type || 'unknown', status: 'failed', reason: `Unknown action type: ${action.type}` });
          }
        } catch (actionErr: any) {
          console.error('Failed to execute coach action:', action, actionErr);
          actionResults.push({ 
            type: action.type || 'unknown', 
            subtaskId: action.subtaskId, 
            status: 'failed', 
            reason: actionErr?.message || 'Unexpected server error' 
          });
        }
      }
    }

    res.json({
      ...result,
      actionsApplied,
      actionResults
    });
  } catch (error: any) {
    console.error('Coach Chat API error:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate coach response' });
  }
});

coachRouter.post('/coach/excuse', requireLocalIdentity, async (req: AuthenticatedRequest, res) => {
  try {
    const { subtaskId, excuse, virtualTime } = req.body;
    const userId = req.userId!;

    const subtask = store.getDoc('subtasks', subtaskId) as Subtask;
    if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

    const profile = store.getDoc('profiles', userId) as Profile;
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const result = await CoachEngine.evaluateExcuse(
      subtask,
      excuse,
      profile,
      virtualTime || Date.now()
    );

    if (result.rescheduled) {
      // Reschedule the missed subtask
      const settings = store.getDoc('settings', userId) || {};
      const { scheduledSubtasks: rescheduled } = DeterministicScheduler.schedule(
        [{ ...subtask, status: 'pending' }],
        profile,
        settings,
        VirtualClock.getVirtualTime(),
        req.timezoneOffset || 0
      );
      if (rescheduled && rescheduled.length > 0) {
        store.setDoc('subtasks', subtask.id, rescheduled[0]);
      }

      // True forgiveness: deactivate any active penalty taxes for this user
      const activeTaxes = store.query('taxes', t => t.userId === userId && t.active) as TaxEffect[];
      activeTaxes.forEach(tax => {
        store.updateDoc('taxes', tax.id, { active: false });
      });
    }

    // Generate Accountability Agent trace line
    let traceMessage = '';
    if (result.rescheduled) {
      traceMessage = `Accountability Agent — evaluated your reason, verdict: forgiven, rescheduled subtask to next focus window.`;
    } else {
      const activeTaxes = store.query('taxes', t => t.userId === userId && t.active) as TaxEffect[];
      const taxLabel = activeTaxes.length > 0 ? activeTaxes[0].type : 'shorten_next_block';
      traceMessage = `Accountability Agent — evaluated your reason, verdict: invalid, applied tax: ${taxLabel}.`;
    }

    res.json({
      ...result,
      traceMessage
    });
  } catch (error: any) {
    console.error('Coach Excuse API error:', error);
    res.status(500).json({ error: error?.message || 'Failed to evaluate excuse' });
  }
});

// Simple in-memory cache for briefings to avoid hitting API rate limits on every clock tick
const briefingCache = new Map<string, { briefing: string; virtualDay: string; subtaskHash: string }>();

function getVirtualDayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

coachRouter.get('/coach/briefing', requireLocalIdentity, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const virtualTime = VirtualClock.getVirtualTime();
    const dayKey = getVirtualDayKey(virtualTime);
    
    const profile = store.getDoc('profiles', userId) as Profile;
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const allSubtasks = store.query('subtasks', s => s.userId === userId) as Subtask[];
    const activeTaxes = store.query('taxes', t => t.userId === userId && t.active) as TaxEffect[];

    // Filter subtasks scheduled for today (current virtual calendar day)
    const virtualDayStart = new Date(virtualTime);
    virtualDayStart.setHours(0, 0, 0, 0);
    const virtualDayEnd = new Date(virtualTime);
    virtualDayEnd.setHours(23, 59, 59, 999);

    const todaySubtasks = allSubtasks.filter(st => {
      if (!st.assignedSlot) return false;
      return st.assignedSlot.start >= virtualDayStart.getTime() && st.assignedSlot.start <= virtualDayEnd.getTime();
    });

    // Optimization: Cache the briefing result per virtual day + subtask count/ids to avoid redundant Gemini calls
    const subtaskHash = todaySubtasks.map(s => s.id + s.status).sort().join('|');
    const cacheKey = `${userId}-${dayKey}`;
    const cached = briefingCache.get(cacheKey);

    if (cached && cached.virtualDay === dayKey && cached.subtaskHash === subtaskHash) {
      return res.json({ briefing: cached.briefing });
    }

    // Call the AI Engine for the briefing
    const briefing = await CoachEngine.generateDailyBriefing(
      profile,
      todaySubtasks,
      activeTaxes,
      virtualTime
    );

    // Save to cache
    briefingCache.set(cacheKey, { briefing, virtualDay: dayKey, subtaskHash });

    res.json({ briefing });
  } catch (error: any) {
    console.error('Coach Briefing error:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate daily briefing' });
  }
});

coachRouter.get('/coach/insights', requireLocalIdentity, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const allSubtasks = store.query('subtasks', s => s.userId === userId) as Subtask[];
    const allTaxes = store.query('taxes', t => t.userId === userId) as TaxEffect[];

    const completed = allSubtasks.filter(s => s.status === 'completed');
    const missed = allSubtasks.filter(s => s.status === 'missed');
    const total = completed.length + missed.length;

    // 1. Completion rate
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 100;

    // 2. Evening/night miss correlation
    // Check if missed tasks are scheduled after 6:00 PM (18:00)
    const missedInEvening = missed.filter(s => {
      if (!s.assignedSlot) return false;
      const d = new Date(s.assignedSlot.start);
      return d.getHours() >= 18;
    });
    const totalInEvening = allSubtasks.filter(s => {
      if (!s.assignedSlot) return false;
      const d = new Date(s.assignedSlot.start);
      return d.getHours() >= 18;
    }).filter(s => s.status === 'completed' || s.status === 'missed');

    const eveningMissRate = totalInEvening.length > 0 
      ? Math.round((missedInEvening.length / totalInEvening.length) * 100) 
      : 0;

    // 3. Category analysis
    const learningGoalSubtasks = allSubtasks.filter(s => s.taskType === 'learning_goal' && (s.status === 'completed' || s.status === 'missed'));
    const executionSubtasks = allSubtasks.filter(s => s.taskType === 'execution' && (s.status === 'completed' || s.status === 'missed'));

    const learningGoalMissCount = learningGoalSubtasks.filter(s => s.status === 'missed').length;
    const learningGoalMissRate = learningGoalSubtasks.length > 0 
      ? Math.round((learningGoalMissCount / learningGoalSubtasks.length) * 100) 
      : 0;

    const executionMissCount = executionSubtasks.filter(s => s.status === 'missed').length;
    const executionMissRate = executionSubtasks.length > 0 
      ? Math.round((executionMissCount / executionSubtasks.length) * 100) 
      : 0;

    // Generate dynamic insights array
    const insights: string[] = [];

    if (total === 0) {
      insights.push("Start completing subtasks to analyze your productivity and procrastination patterns!");
      insights.push("The Real Insight Agent will track correlation trends and highlight active risks here.");
    } else {
      insights.push(`Your overall task completion rate stands at ${completionRate}%.`);

      if (eveningMissRate > 50) {
        insights.push(`${eveningMissRate}% of your evening slots (after 6:00 PM) are missed. Try scheduling core work earlier!`);
      } else if (eveningMissRate > 0) {
        insights.push(`You have a ${eveningMissRate}% miss rate on tasks scheduled in the evening. Keep an eye on late-day focus.`);
      }

      if (learningGoalMissRate > executionMissRate && learningGoalMissRate > 25) {
        insights.push(`Learning goals have a ${learningGoalMissRate}% failure rate compared to execution tasks (${executionMissRate}%). Structure your study roadmap in smaller pieces!`);
      } else if (executionMissRate > learningGoalMissRate && executionMissRate > 25) {
        insights.push(`Execution tasks have a higher miss rate (${executionMissRate}%) than learning goals. You might be underestimating complexity.`);
      }

      const totalTaxesLevied = allTaxes.length;
      if (totalTaxesLevied > 0) {
        insights.push(`Historically, you have triggered ${totalTaxesLevied} penalty tax consequences. Try to stay within grace periods!`);
      } else {
        insights.push("Excellent record! You have triggered zero penalty taxes so far. Stay consistent!");
      }
    }

    res.json({
      completionRate,
      eveningMissRate,
      learningGoalMissRate,
      executionMissRate,
      totalCount: total,
      completedCount: completed.length,
      missedCount: missed.length,
      insights
    });
  } catch (error: any) {
    console.error('Coach Insights API error:', error);
    res.status(500).json({ error: error?.message || 'Failed to fetch insights' });
  }
});
