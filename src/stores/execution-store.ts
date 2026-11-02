import { create } from "zustand";
import type { ExecutionStatus, RoundResult } from "@/types";

interface ExecutionStore {
  status: ExecutionStatus;
  currentRound: number;
  totalRounds: number;
  results: RoundResult[];
  captchaDetected: boolean;
  error: string | null;
  startTime: string | null;
  endTime: string | null;
  /** Number of pages in the form (multi-page support) */
  pageCount: number;

  // Actions
  start: (total: number, pageCount?: number) => void;
  addResult: (r: RoundResult) => void;
  setCurrentRound: (n: number) => void;
  setCaptcha: () => void;
  stop: () => void;
  complete: () => void;
  setError: (e: string) => void;
  reset: () => void;
}

const initialState = {
  status: "idle" as ExecutionStatus,
  currentRound: 0,
  totalRounds: 0,
  results: [],
  captchaDetected: false,
  error: null as string | null,
  startTime: null as string | null,
  endTime: null as string | null,
  pageCount: 1,
};

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  ...initialState,

  start: (total, pageCount = 1) =>
    set({
      ...initialState,
      status: "running",
      totalRounds: total,
      pageCount,
      startTime: new Date().toISOString(),
    }),

  addResult: (result) =>
    set((s) => ({
      results: [...s.results, result],
      currentRound: s.currentRound + 1,
      // Track pageCount from the first result
      pageCount: result.pageCount ?? s.pageCount,
    })),

  setCurrentRound: (n) => set({ currentRound: n }),

  setCaptcha: () =>
    set({ status: "captcha_blocked", captchaDetected: true, endTime: new Date().toISOString() }),

  stop: () => set({ status: "stopped", endTime: new Date().toISOString() }),

  complete: () => set({ status: "completed", endTime: new Date().toISOString() }),

  setError: (error) => set({ status: "error", error, endTime: new Date().toISOString() }),

  reset: () => set(initialState),
}));
