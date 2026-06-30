export type Tone = 'gentle' | 'neutral' | 'firm' | 'maximum_firmness';
export type TaskType = 'execution' | 'learning_goal';

export interface TimeWindow {
  start: string; // HH:mm format
  end: string;   // HH:mm format
}

export interface Profile {
  id: string; // The UUID
  email?: string;
  goals: string;
  context: string;
  tone: Tone;
  focusHours: TimeWindow[];
  createdAt: number;
}

export interface Task {
  id: string;
  userId: string;
  description: string;
  deadline: number; // timestamp
  priority: number; // 1-10
  createdAt: number;
  status: 'active' | 'completed' | 'abandoned';
}

export interface Subtask {
  id: string;
  taskId: string;
  userId: string;
  title: string;
  estimatedDuration: number; // minutes
  dependencies: string[]; // subtask IDs
  order: number;
  taskType: TaskType;
  status: 'pending' | 'completed' | 'missed';
  softDeadline?: number; // timestamp
  gracePeriodMinutes: number;
  assignedSlot?: {
    start: number; // timestamp
    end: number;   // timestamp
  };
  urgencyScore?: number;
  urgencyBand?: 'green' | 'amber' | 'red';
  urgencyBreakdown?: UrgencyBreakdown;
  missedFlagged?: boolean;
}

export interface UrgencyFactor {
  raw: string;
  weighted: number;
  weight: number;
}

export interface UrgencyBreakdown {
  timePressure: UrgencyFactor;
  priority: UrgencyFactor;
  dependency: UrgencyFactor;
  historicalRisk: UrgencyFactor;
}

export interface Settings {
  userId: string;
  blockedWindows: { start: number; end: number; label: string }[];
  durationMultiplier: number; // Default 1.0
  developerTimeControlsEnabled: boolean;
}

export interface TaxEffect {
  id: string;
  userId: string;
  type: 'shorten_next_block' | 'lock_element' | 'max_firmness';
  targetElement?: string;
  expiresAt: number; // virtual midnight timestamp
  active: boolean;
}
