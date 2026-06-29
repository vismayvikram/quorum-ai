import { Subtask } from '../types';

export interface ParentTaskSummary {
  total: number;
  completed: number;
  missed: number;
  upcoming: number;
  accumulatedDelayMinutes: number; // Sum of overrun for missed tasks
  progressPercentage: number;
}

/**
 * Computes aggregate statistics for a parent task based on its subtasks.
 * No AI or backend calls required; operates on existing in-memory data.
 */
export function getParentTaskSummary(parentTaskId: string, allSubtasks: Subtask[], virtualTime: number): ParentTaskSummary {
  const taskSubtasks = allSubtasks.filter(st => st.taskId === parentTaskId);
  
  const stats = {
    total: taskSubtasks.length,
    completed: 0,
    missed: 0,
    upcoming: 0,
    accumulatedDelayMinutes: 0,
  };

  taskSubtasks.forEach(st => {
    if (st.status === 'completed') {
      stats.completed++;
    } else if (st.status === 'missed') {
      stats.missed++;
      // If it missed, calculate how much it went over its scheduled end
      if (st.assignedSlot) {
        const delayMs = Math.max(0, virtualTime - st.assignedSlot.end);
        stats.accumulatedDelayMinutes += Math.floor(delayMs / (60 * 1000));
      }
    } else {
      stats.upcoming++;
    }
  });

  const progressPercentage = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  return {
    ...stats,
    progressPercentage
  };
}
