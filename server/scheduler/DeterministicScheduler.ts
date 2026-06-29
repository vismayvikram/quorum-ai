import { Subtask, Profile, Settings } from '../../src/types';

interface FocusRange {
  start: number;
  end: number;
}

/**
 * Deterministically schedules a set of subtasks within focus hours,
 * avoiding blocked windows and respecting DAG dependencies.
 */
export const DeterministicScheduler = {
  schedule(
    subtasks: Partial<Subtask>[],
    profile: Profile,
    settings: Settings,
    startVirtualTime: number,
    timezoneOffsetMinutes: number = 0
  ): Subtask[] {
    // 1. Sort subtasks topologically or by order to ensure dependencies are scheduled first.
    // Since we validated they are cycle-free, we can schedule them in topological order.
    const scheduled: Subtask[] = [];
    const unscheduled = [...subtasks] as Subtask[];

    // Focus hours parsing (default to 09:00 - 17:00 if not specified)
    const focusWindow = profile.focusHours?.[0] || { start: '09:00', end: '17:00' };

    // Get focus range for a given timestamp's day
    const getFocusRange = (timestamp: number): FocusRange => {
      // Shift UTC timestamp to user's local time zone
      const localTimestamp = timestamp - timezoneOffsetMinutes * 60 * 1000;
      const localDate = new Date(localTimestamp);
      const [sH, sM] = focusWindow.start.split(':').map(Number);
      const [eH, eM] = focusWindow.end.split(':').map(Number);

      const y = localDate.getUTCFullYear();
      const m = localDate.getUTCMonth();
      const d = localDate.getUTCDate();

      const localStartUTC = Date.UTC(y, m, d, sH, sM, 0, 0);
      const localEndUTC = Date.UTC(y, m, d, eH, eM, 0, 0);

      // Shift back to UTC timestamps
      const start = localStartUTC + timezoneOffsetMinutes * 60 * 1000;
      const end = localEndUTC + timezoneOffsetMinutes * 60 * 1000;
      return { start, end };
    };

    // Helper to check if a block [start, end] overlaps with any blocked window
    const overlapsBlocked = (start: number, end: number): boolean => {
      if (!settings.blockedWindows) return false;
      return settings.blockedWindows.some(b => {
        // Overlap condition: start < b.end AND end > b.start
        return start < b.end && end > b.start;
      });
    };

    // Keep track of scheduled subtask end times to satisfy dependencies
    const completedTimes = new Map<string, number>();
    // Global cursor for the user to prevent overlapping independent tasks
    let globalCursor = startVirtualTime;
    const focusWindowWidth = (focusWindow.end.split(':').map(Number)[0] * 60 + focusWindow.end.split(':').map(Number)[1]) - 
                             (focusWindow.start.split(':').map(Number)[0] * 60 + focusWindow.start.split(':').map(Number)[1]);
    const focusWindowMs = focusWindowWidth * 60 * 1000;

    // We process tasks one by one. To handle dependencies safely, we schedule
    // a task only after its dependencies have been scheduled and their end times are known.
    while (unscheduled.length > 0) {
      // Find a subtask whose dependencies are all scheduled
      const readyIndex = unscheduled.findIndex(st => {
        if (!st.dependencies || st.dependencies.length === 0) return true;
        return st.dependencies.every(depId => completedTimes.has(depId));
      });

      if (readyIndex === -1) {
        // Fallback if there is a cycle we missed, just take the first one
        console.warn("Scheduler detected possible dependency cycle or missing dependency. Falling back.");
        break;
      }

      const st = unscheduled.splice(readyIndex, 1)[0];

      // Earliest start time is the max of (startVirtualTime, all dependency end times, and the global cursor)
      let earliestStart = Math.max(startVirtualTime, globalCursor);
      if (st.dependencies && st.dependencies.length > 0) {
        st.dependencies.forEach(depId => {
          const depEnd = completedTimes.get(depId) || startVirtualTime;
          if (depEnd > earliestStart) {
            earliestStart = depEnd;
          }
        });
      }

      // Find the first valid slot for this subtask
      let cursor = earliestStart;
      const durationMs = (st.estimatedDuration || 15) * 60 * 1000;
      
      // If the task itself is longer than the entire focus window, we MUST ignore focus hours for this task
      // or it will never be scheduled.
      const taskTooLongForFocus = durationMs > focusWindowMs;
      
      let slotFound = false;
      let assignedStart = 0;
      let assignedEnd = 0;
      let ignoreFocus = taskTooLongForFocus;
      let ignoreBlocked = false;
      let attempt = 1;

      // Search up to 30 days ahead to prevent infinite loops
      const maxSearchTime = cursor + 30 * 24 * 60 * 60 * 1000;

      while (cursor < maxSearchTime && !slotFound) {
        if (!ignoreFocus) {
          const focus = getFocusRange(cursor);

          // If cursor is past today's focus hours, move to tomorrow's focus start
          if (cursor >= focus.end) {
            const tomorrowFocus = getFocusRange(cursor + 24 * 60 * 60 * 1000);
            cursor = tomorrowFocus.start;
            continue;
          }

          // If cursor is before today's focus hours, move to today's focus start
          if (cursor < focus.start) {
            cursor = focus.start;
            continue;
          }

          // Proposed slot
          const proposedEnd = cursor + durationMs;

          // If proposed slot extends past the end of focus hours, push to next day's focus start
          if (proposedEnd > focus.end) {
            const tomorrowFocus = getFocusRange(cursor + 24 * 60 * 60 * 1000);
            cursor = tomorrowFocus.start;
            continue;
          }
          
          // Check if overlaps with any blocked window
          if (!ignoreBlocked && overlapsBlocked(cursor, proposedEnd)) {
            const blockingWindow = settings.blockedWindows.find(b => cursor < b.end && proposedEnd > b.start);
            if (blockingWindow) {
              cursor = blockingWindow.end;
            } else {
              cursor += 60000;
            }
            continue;
          }

          // Slot is fully valid!
          assignedStart = cursor;
          assignedEnd = proposedEnd;
          slotFound = true;
        } else {
          // Ignore focus hours mode (for over-long tasks or as fallback)
          const proposedEnd = cursor + durationMs;
          if (!ignoreBlocked && overlapsBlocked(cursor, proposedEnd)) {
            const blockingWindow = settings.blockedWindows.find(b => cursor < b.end && proposedEnd > b.start);
            if (blockingWindow) {
              cursor = blockingWindow.end;
            } else {
              cursor += 60000;
            }
            continue;
          }
          assignedStart = cursor;
          assignedEnd = proposedEnd;
          slotFound = true;
        }

        // Dual-mode fallback check
        if (!slotFound && cursor + durationMs >= maxSearchTime) {
          if (attempt === 1) {
            attempt = 2;
            ignoreBlocked = true;
            cursor = earliestStart;
          } else if (attempt === 2) {
            attempt = 3;
            ignoreFocus = true;
            cursor = earliestStart;
          }
        }
      }

      if (slotFound) {
        st.assignedSlot = {
          start: assignedStart,
          end: assignedEnd
        };
        st.softDeadline = assignedEnd;
        scheduled.push(st);
        completedTimes.set(st.id, assignedEnd);
        globalCursor = assignedEnd; // Update global cursor to prevent overlap
      } else {
        console.error(`Failed to find schedule slot for subtask ${st.id}`);
      }
    }

    return scheduled;
  }
};
