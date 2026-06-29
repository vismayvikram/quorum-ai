import { store } from '../db/store';
import { Task, Subtask, Profile, Settings } from '../../src/types';

export interface MigrationConflict {
  type: 'profile' | 'task' | 'settings';
  itemId: string;
  title: string;
  localUpdatedAt: number;
  serverUpdatedAt: number;
}

export interface MigrationResult {
  success: boolean;
  hasConflicts: boolean;
  conflicts: MigrationConflict[];
  migratedCount: {
    tasks: number;
    subtasks: number;
    profile: boolean;
    settings: boolean;
  };
}

export const MigrationService = {
  /**
   * Compares anonymous data (from localId) with authenticated data (from authId).
   * If there are no conflicts or if forceMerge is true, performs the migration.
   * If conflicts are found, returns the details of the conflicts for client resolution.
   */
  migrate(localId: string, authId: string, forceMerge: boolean = false): MigrationResult {
    const result: MigrationResult = {
      success: false,
      hasConflicts: false,
      conflicts: [],
      migratedCount: { tasks: 0, subtasks: 0, profile: false, settings: false }
    };

    if (!localId || !authId || localId === authId) {
      return { ...result, success: true };
    }

    // 1. Fetch profiles
    const localProfile = store.getDoc('profiles', localId) as Profile | null;
    const serverProfile = store.getDoc('profiles', authId) as Profile | null;

    // 2. Fetch tasks & subtasks
    const localTasks = store.query('tasks', t => t.userId === localId) as Task[];
    const localSubtasks = store.query('subtasks', s => s.userId === localId) as Subtask[];

    const serverTasks = store.query('tasks', t => t.userId === authId) as Task[];
    
    // 3. Fetch settings
    const localSettings = store.getDoc('settings', localId) as Settings | null;
    const serverSettings = store.getDoc('settings', authId) as Settings | null;

    // --- CONFLICT DETECTION & MERGING ---

    let migrateProfile = false;
    let migrateSettings = false;
    const tasksToMigrate: Task[] = [];
    const subtasksToMigrate: Subtask[] = [];

    // Profile Merge Rule
    if (localProfile) {
      if (!serverProfile) {
        migrateProfile = true;
      } else {
        const localTime = localProfile.createdAt || 0; // fallback timestamp
        const serverTime = serverProfile.createdAt || 0;
        if (localTime > serverTime) {
          if (forceMerge) {
            migrateProfile = true;
          } else {
            result.hasConflicts = true;
            result.conflicts.push({
              type: 'profile',
              itemId: 'profile',
              title: 'Onboarding Context & Goals',
              localUpdatedAt: localTime,
              serverUpdatedAt: serverTime
            });
          }
        }
      }
    }

    // Settings Merge Rule
    if (localSettings) {
      if (!serverSettings) {
        migrateSettings = true;
      } else {
        // Assume default timestamp or 0
        const localTime = 1; // Since settings usually don't have updatedAt, check values
        const serverTime = 0;
        // If local settings differ from default and server is default, let's flag or migrate
        const localIsModified = localSettings.blockedWindows.length > 0 || localSettings.durationMultiplier !== 1.0;
        if (localIsModified) {
          if (forceMerge) {
            migrateSettings = true;
          } else {
            result.hasConflicts = true;
            result.conflicts.push({
              type: 'settings',
              itemId: 'settings',
              title: 'Focus Hours & Clock Block-outs',
              localUpdatedAt: localTime,
              serverUpdatedAt: serverTime
            });
          }
        }
      }
    }

    // Tasks & Subtasks Merge Rule
    localTasks.forEach(lt => {
      const matchingServerTask = serverTasks.find(st => st.id === lt.id);
      if (!matchingServerTask) {
        // Local-only task: always imported, never dropped
        tasksToMigrate.push(lt);
        // Find matching subtasks
        const matchingSubtasks = localSubtasks.filter(ls => ls.taskId === lt.id);
        subtasksToMigrate.push(...matchingSubtasks);
      } else {
        // Conflicting task: compare updatedAt
        const localTime = lt.createdAt || 0;
        const serverTime = matchingServerTask.createdAt || 0;
        if (localTime > serverTime) {
          if (forceMerge) {
            tasksToMigrate.push(lt);
            const matchingSubtasks = localSubtasks.filter(ls => ls.taskId === lt.id);
            subtasksToMigrate.push(...matchingSubtasks);
          } else {
            result.hasConflicts = true;
            result.conflicts.push({
              type: 'task',
              itemId: lt.id,
              title: `Task: ${lt.description.substring(0, 30)}...`,
              localUpdatedAt: localTime,
              serverUpdatedAt: serverTime
            });
          }
        }
      }
    });

    // If there are conflicts and we are not forcing a merge, do not perform write operations yet
    if (result.hasConflicts && !forceMerge) {
      return result;
    }

    // --- WRITE OPERATIONS (Transactional Batch Simulation) ---
    try {
      // Migrate Profile
      if (migrateProfile && localProfile) {
        store.setDoc('profiles', authId, {
          ...localProfile,
          id: authId
        });
        result.migratedCount.profile = true;
      }

      // Migrate Settings
      if (migrateSettings && localSettings) {
        store.setDoc('settings', authId, {
          ...localSettings,
          userId: authId
        });
        result.migratedCount.settings = true;
      }

      // Migrate Tasks & Subtasks
      tasksToMigrate.forEach(t => {
        store.setDoc('tasks', t.id, {
          ...t,
          userId: authId
        });
        result.migratedCount.tasks++;
      });

      subtasksToMigrate.forEach(s => {
        store.setDoc('subtasks', s.id, {
          ...s,
          userId: authId
        });
        result.migratedCount.subtasks++;
      });

      // Mark local anonymous items as migrated in store
      store.setDoc('profiles', localId, undefined);
      store.setDoc('settings', localId, undefined);
      localTasks.forEach(t => store.setDoc('tasks', t.id, undefined));
      localSubtasks.forEach(s => store.setDoc('subtasks', s.id, undefined));

      result.success = true;
      return result;
    } catch (e) {
      console.error('Migration execution failed', e);
      result.success = false;
      return result;
    }
  }
};
