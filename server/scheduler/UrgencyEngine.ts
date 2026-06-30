import { Subtask, UrgencyBreakdown } from '../../src/types';

export const UrgencyEngine = {
  /**
   * Calculates the dynamic Urgency Score for a subtask at a given virtual timestamp.
   * 
   * Formula:
   *   Score = (W_TP * TP + W_NP * NP + W_DEP * DEP + W_RISK * RISK) * M_active
   */
  calculateUrgencyScore(
    subtask: Subtask,
    taskPriority: number,
    currentVirtualTime: number,
    allSubtasks: Subtask[]
  ): { score: number; breakdown: UrgencyBreakdown } {
    // Constant weights
    const W_TP = 0.50;
    const W_NP = 0.25;
    const W_DEP = 0.15;
    const W_RISK = 0.10;

    // 1. Timeline Pressure (TP)
    const deadline = subtask.softDeadline || (subtask.assignedSlot?.end) || currentVirtualTime;
    const timeRemainingMs = deadline - currentVirtualTime;
    let TP = 0;
    if (timeRemainingMs <= 0) {
      TP = 100;
    } else {
      const H = timeRemainingMs / (3600 * 1000); // remaining hours
      TP = 100 * Math.exp(-0.05 * H);
    }

    // 2. Normalized Priority (NP)
    // Scale priority 1-10 linearly to 0-100 scale: NP = (priority - 1) * 11.11
    const NP = Math.max(0, Math.min(100, (taskPriority - 1) * 11.11));

    // 3. Dependency Factor (DEP) & Active Blocking Multiplier (M_active)
    // Find uncompleted downstream subtasks that depend on this subtask
    // We can do a BFS/DFS or trace uncompleted dependents to find uncompleted subtasks blocked by this one
    const uncompletedSubtasks = allSubtasks.filter(st => st.status !== 'completed' && st.id !== subtask.id);
    
    // Check direct and indirect uncompleted dependents
    const blockedSubtaskIds = new Set<string>();
    const queue = [subtask.id];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      // Find uncompleted subtasks that list currentId in their dependencies
      for (const st of uncompletedSubtasks) {
        if (st.dependencies && st.dependencies.includes(currentId) && !blockedSubtaskIds.has(st.id)) {
          blockedSubtaskIds.add(st.id);
          queue.push(st.id);
        }
      }
    }

    const D_blocked = blockedSubtaskIds.size;
    const DEP = Math.min(100, D_blocked * 40);

    const M_active = D_blocked > 0 ? 1.25 : 1.0;

    // 4. Historical Risk (RISK)
    // User's historical failure rate in this task's category (subtask.taskType: 'execution' or 'learning_goal')
    const categorySubtasks = allSubtasks.filter(st => st.taskType === subtask.taskType);
    const missedCount = categorySubtasks.filter(st => st.status === 'missed').length;
    const completedOrMissedCount = categorySubtasks.filter(st => st.status === 'completed' || st.status === 'missed').length;
    
    // Default baseline if no history is 20%
    const RISK = completedOrMissedCount > 0 ? (missedCount / completedOrMissedCount) * 100 : 20;

    // Overall Score Calculation
    const score = (W_TP * TP + W_NP * NP + W_DEP * DEP + W_RISK * RISK) * M_active;

    // Clamp score to [0, 100] and round to 1 decimal place
    const finalScore = Math.max(0, Math.min(100, score));
    const roundedScore = Math.round(finalScore * 10) / 10;

    const roundOneDec = (num: number) => Math.round(num * 10) / 10;

    const remainingHours = timeRemainingMs / (3600 * 1000);
    const taskDuration = subtask.estimatedDuration || 0;

    const breakdown: UrgencyBreakdown = {
      timePressure: {
        raw: timeRemainingMs <= 0 
          ? "Overdue" 
          : `${remainingHours.toFixed(1)}h left for ${taskDuration}m task`,
        weighted: roundOneDec(W_TP * TP * M_active),
        weight: W_TP
      },
      priority: {
        raw: `${taskPriority}/10 priority`,
        weighted: roundOneDec(W_NP * NP * M_active),
        weight: W_NP
      },
      dependency: {
        raw: `${D_blocked} blocked tasks`,
        weighted: roundOneDec(W_DEP * DEP * M_active),
        weight: W_DEP
      },
      historicalRisk: {
        raw: `${Math.round(RISK)}% failure rate`,
        weighted: roundOneDec(W_RISK * RISK * M_active),
        weight: W_RISK
      }
    };

    return {
      score: roundedScore,
      breakdown
    };
  },

  /**
   * Translates the numeric urgency score to a visual urgency band.
   */
  getUrgencyBand(score: number): 'green' | 'amber' | 'red' {
    if (score < 30) {
      return 'green';
    } else if (score < 60) {
      return 'amber';
    } else {
      return 'red';
    }
  }
};
