import { Router } from 'express';
import { requireLocalIdentity, AuthenticatedRequest } from '../identity/LocalIdentity';
import { store } from '../db/store';
import { DeterministicScheduler } from './DeterministicScheduler';
import { AccountabilityEngine } from '../accountability/AccountabilityEngine';
import { VirtualClock } from '../time/VirtualClock';
import { UrgencyEngine } from './UrgencyEngine';
import { Task, Subtask } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

export const schedulerRouter = Router();

// Commit plan and schedule
schedulerRouter.post('/scheduler/commit', requireLocalIdentity, (req: AuthenticatedRequest, res) => {
  const { description, deadlineMinutes, subtasks, taskType, priority } = req.body;
  const userId = req.userId!;

  const profile = store.getDoc('profiles', userId);
  const settings = store.getDoc('settings', userId);

  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  if (!settings) return res.status(404).json({ error: 'Settings not found' });

  // 1. Create and store main task
  const taskId = uuidv4();
  const deadlineTimestamp = VirtualClock.getVirtualTime() + (deadlineMinutes || 24 * 60) * 60 * 1000;
  
  const newTask: Task = {
    id: taskId,
    userId,
    description,
    deadline: deadlineTimestamp,
    priority: priority || 5,
    createdAt: VirtualClock.getVirtualTime(),
    status: 'active'
  };
  
  store.setDoc('tasks', taskId, newTask);

  // 2. Schedule subtasks
  const rawSubtasks: Partial<Subtask>[] = subtasks.map((st: any) => ({
    id: st.id || uuidv4(),
    taskId,
    userId,
    title: st.title,
    estimatedDuration: st.estimatedDuration,
    dependencies: st.dependencies || [],
    order: st.order,
    taskType: taskType || 'execution',
    status: 'pending',
    gracePeriodMinutes: AccountabilityEngine.getGracePeriodMinutes(profile.tone)
  }));

  const { scheduledSubtasks, traceMessage } = DeterministicScheduler.schedule(
    rawSubtasks,
    profile,
    settings,
    VirtualClock.getVirtualTime(),
    req.timezoneOffset || 0
  );

  // 3. Store scheduled subtasks in DB
  scheduledSubtasks.forEach(st => {
    store.setDoc('subtasks', st.id, st);
  });

  res.json({
    success: true,
    task: newTask,
    subtasks: scheduledSubtasks,
    traceMessage
  });
});

// Fetch active roadmap, subtasks, and accountability taxes
schedulerRouter.get('/scheduler/status', requireLocalIdentity, (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const virtualTime = VirtualClock.getVirtualTime();

  // Run the Accountability engine immediately to process elapsed deadlines
  const { taxes, missedCount } = AccountabilityEngine.checkAndApplyPenalties(userId, virtualTime);

  // Fetch all tasks
  const tasks = store.query('tasks', t => t.userId === userId && t.status === 'active') as Task[];
  const subtasks = store.query('subtasks', s => s.userId === userId) as Subtask[];

  // Attach dynamic urgency scores and bands
  const enrichedSubtasks = subtasks.map(st => {
    const parentTask = tasks.find(t => t.id === st.taskId) || store.getDoc('tasks', st.taskId) as Task;
    const priority = parentTask ? parentTask.priority : 5;
    const { score, breakdown } = UrgencyEngine.calculateUrgencyScore(st, priority, virtualTime, subtasks);
    const band = UrgencyEngine.getUrgencyBand(score);
    return {
      ...st,
      urgencyScore: score,
      urgencyBand: band,
      urgencyBreakdown: breakdown
    };
  });

  // Check if max firmness tone override is active
  const isMaxFirmnessActive = taxes.some(t => t.type === 'max_firmness');
  const profile = store.getDoc('profiles', userId);
  let effectiveTone = profile?.tone || 'neutral';
  if (isMaxFirmnessActive) {
    effectiveTone = 'maximum_firmness';
  }

  res.json({
    tasks,
    subtasks: enrichedSubtasks,
    taxes,
    missedCount,
    effectiveTone,
    virtualTime
  });
});

// Mark subtask as complete
schedulerRouter.post('/scheduler/subtask/complete', requireLocalIdentity, (req: AuthenticatedRequest, res) => {
  const { subtaskId } = req.body;
  const subtask = store.getDoc('subtasks', subtaskId) as Subtask;

  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });
  if (subtask.userId !== req.userId) return res.status(403).json({ error: 'Unauthorized' });

  // Update status to completed
  store.updateDoc('subtasks', subtaskId, { status: 'completed' });

  // Check if all subtasks for the task are completed
  const taskId = subtask.taskId;
  const allSubtasks = store.query('subtasks', s => s.taskId === taskId) as Subtask[];
  const allCompleted = allSubtasks.every(s => s.status === 'completed' || s.status === 'missed');
  if (allCompleted) {
    store.updateDoc('tasks', taskId, { status: 'completed' });
  }

  res.json({ success: true, subtask });
});

// Mark subtask as missed/abandoned
schedulerRouter.post('/scheduler/subtask/miss', requireLocalIdentity, (req: AuthenticatedRequest, res) => {
  const { subtaskId } = req.body;
  const subtask = store.getDoc('subtasks', subtaskId) as Subtask;

  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });
  if (subtask.userId !== req.userId) return res.status(403).json({ error: 'Unauthorized' });

  store.updateDoc('subtasks', subtaskId, { status: 'missed' });

  // Handle tax consequences
  const profile = store.getDoc('profiles', req.userId!);
  const virtualTime = VirtualClock.getVirtualTime();
  const d = new Date(virtualTime);
  d.setHours(23, 59, 59, 999);
  const virtualMidnight = d.getTime();

  let taxType: 'shorten_next_block' | 'lock_element' | 'max_firmness' = 'shorten_next_block';
  if (profile?.tone === 'neutral') {
    taxType = 'lock_element';
  } else if (profile?.tone === 'firm') {
    taxType = 'max_firmness';
  }

  const taxId = uuidv4();
  const newTax = {
    id: taxId,
    userId: req.userId,
    type: taxType,
    targetElement: taxType === 'lock_element' ? 'settings_and_warp' : undefined,
    expiresAt: virtualMidnight,
    active: true
  };
  store.setDoc('taxes', taxId, newTax);

  res.json({ success: true, tax: newTax });
});

// Reset database for a clean demo
schedulerRouter.post('/scheduler/reset', requireLocalIdentity, (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  
  // Find and remove tasks/subtasks/taxes for this user
  const tasks = store.query('tasks', t => t.userId === userId);
  const subtasks = store.query('subtasks', s => s.userId === userId);
  const taxes = store.query('taxes', t => t.userId === userId);

  tasks.forEach(t => store.setDoc('tasks', t.id, undefined));
  subtasks.forEach(s => store.setDoc('subtasks', s.id, undefined));
  taxes.forEach(t => store.setDoc('taxes', t.id, undefined));

  VirtualClock.reset();

  res.json({ success: true });
});

// Stateless Accountability Cron check
schedulerRouter.post('/accountability/cron-check', (req, res) => {
  try {
    const profiles = store.getCollection('profiles');
    const virtualTime = VirtualClock.getVirtualTime();
    const results: any[] = [];

    profiles.forEach(profile => {
      const result = AccountabilityEngine.checkAndApplyPenalties(profile.id, virtualTime);
      results.push({ userId: profile.id, ...result });
    });

    res.json({ success: true, virtualTime, resultsCount: results.length, results });
  } catch (error: any) {
    console.error('Stateless cron check error:', error);
    res.status(500).json({ error: error?.message || 'Cron check failed' });
  }
});
