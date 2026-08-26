"use client";

import { create } from "zustand";
import { UISchema } from "@/components/ai-insights/GenerativeChart";

export interface PinnedChart extends UISchema {
  id: string;
  pinnedAt: string;
  queryPrompt?: string;
}

interface PinnedChartState {
  pinnedCharts: PinnedChart[];
  pinChart: (schema: UISchema, queryPrompt?: string) => void;
  unpinChart: (id: string) => void;
  clearPinnedCharts: () => void;
  isPinned: (title: string) => boolean;
}

export const usePinnedChartStore = create<PinnedChartState>((set, get) => ({
  pinnedCharts: [],
  pinChart: (schema, queryPrompt) => {
    const existing = get().pinnedCharts.find((c) => c.title === schema.title);
    if (existing) return;

    const newChart: PinnedChart = {
      ...schema,
      id: `pinned-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      pinnedAt: new Date().toLocaleTimeString(),
      queryPrompt,
    };
    set((state) => ({ pinnedCharts: [newChart, ...state.pinnedCharts] }));
  },
  unpinChart: (id) => {
    set((state) => ({
      pinnedCharts: state.pinnedCharts.filter((c) => c.id !== id),
    }));
  },
  clearPinnedCharts: () => set({ pinnedCharts: [] }),
  isPinned: (title) => get().pinnedCharts.some((c) => c.title === title),
}));
