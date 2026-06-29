export interface ClockState {
  offsetMs: number;
}

let state: ClockState = {
  offsetMs: 0
};

export const VirtualClock = {
  getVirtualTime(): number {
    return Date.now() + state.offsetMs;
  },

  setOffset(offsetMs: number): void {
    state.offsetMs = offsetMs;
  },

  getOffset(): number {
    return state.offsetMs;
  },

  advanceBy(ms: number): void {
    state.offsetMs += ms;
  },

  reset(): void {
    state.offsetMs = 0;
  }
};
