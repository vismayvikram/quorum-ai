import { Subtask } from '../../../src/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  traceMessage: string;
}

export const DAGValidator = {
  validate(subtasks: Partial<Subtask>[], totalDeadlineDurationMinutes: number): ValidationResult {
    const errors: string[] = [];
    
    // 1. Check for missing IDs or duplicate IDs
    const ids = new Set<string>();
    subtasks.forEach((st, i) => {
      if (!st.id) errors.push(`Subtask at index ${i} missing ID.`);
      else if (ids.has(st.id)) errors.push(`Duplicate ID found: ${st.id}`);
      else ids.add(st.id);
    });

    // 2. Check for dangling dependencies
    subtasks.forEach(st => {
      if (st.dependencies) {
        st.dependencies.forEach(depId => {
          if (!ids.has(depId)) {
            errors.push(`Subtask ${st.id} has dangling dependency: ${depId}`);
          }
        });
      }
    });

    // 3. Cycle detection (Kahn's algorithm)
    if (this.hasCycles(subtasks)) {
      errors.push('Cycle detected in dependencies.');
    }

    // 4. Duration bounds check
    const totalEst = subtasks.reduce((sum, st) => sum + (st.estimatedDuration || 0), 0);
    if (totalEst > totalDeadlineDurationMinutes && totalDeadlineDurationMinutes > 0) {
      errors.push(`Total estimated duration (${totalEst}m) exceeds available time before deadline (${totalDeadlineDurationMinutes}m).`);
    }

    const traceMessage = errors.length === 0
      ? `DAG Validator — Structure verified: 0 cycles, total duration (${totalEst} mins) is within deadline bounds.`
      : `DAG Validator — Structure invalid: ${errors.join('; ')}`;

    return {
      isValid: errors.length === 0,
      errors,
      traceMessage
    };
  },

  hasCycles(subtasks: Partial<Subtask>[]): boolean {
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    subtasks.forEach(st => {
      if (st.id) {
        adj.set(st.id, []);
        inDegree.set(st.id, 0);
      }
    });

    subtasks.forEach(st => {
      if (st.id && st.dependencies) {
        st.dependencies.forEach(dep => {
          if (adj.has(dep)) {
            adj.get(dep)!.push(st.id as string);
            inDegree.set(st.id as string, (inDegree.get(st.id as string) || 0) + 1);
          }
        });
      }
    });

    const queue: string[] = [];
    inDegree.forEach((val, key) => {
      if (val === 0) queue.push(key);
    });

    let count = 0;
    while (queue.length > 0) {
      const node = queue.shift()!;
      count++;
      const neighbors = adj.get(node) || [];
      for (const next of neighbors) {
        inDegree.set(next, inDegree.get(next)! - 1);
        if (inDegree.get(next) === 0) {
          queue.push(next);
        }
      }
    }

    return count !== subtasks.length;
  }
};
