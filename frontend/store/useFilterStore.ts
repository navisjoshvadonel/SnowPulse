import { create } from "zustand";

export interface FilterCriterion {
  column: string;
  op: "==" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "between";
  value: any;
  label?: string;
}

export interface DateRange {
  start?: string;
  end?: string;
}

export interface BrushSelection {
  column?: string;
  range?: [number, number] | number[];
  indices?: number[];
  [key: string]: any;
}

interface FilterState {
  // Primary Store State
  selectedFilters: FilterCriterion[];
  filters: FilterCriterion[];
  activeBrush: BrushSelection | Record<string, [number, number]> | null;
  dateRange: DateRange | null;
  activeDateRange: DateRange | null;
  activeCategoryValues: Record<string, string[]>;
  activeNumericRanges: Record<string, [number, number]>;

  // Actions
  setSelectedFilters: (filters: FilterCriterion[]) => void;
  addFilter: (filter: FilterCriterion) => void;
  removeFilter: (column: string) => void;
  clearFilters: () => void;
  setActiveBrush: (brush: BrushSelection | Record<string, [number, number]> | null) => void;
  setDateRange: (start: string, end: string) => void;
  setNumericRange: (column: string, min: number, max: number) => void;
  toggleCategoryValue: (column: string, value: string) => void;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  selectedFilters: [],
  filters: [],
  activeBrush: null,
  dateRange: null,
  activeDateRange: null,
  activeCategoryValues: {},
  activeNumericRanges: {},

  setSelectedFilters: (newFilters) =>
    set({
      selectedFilters: newFilters,
      filters: newFilters,
    }),

  addFilter: (filter) =>
    set((state) => {
      const existingIdx = state.selectedFilters.findIndex((f) => f.column === filter.column);
      let updatedFilters = [...state.selectedFilters];
      if (existingIdx >= 0) {
        updatedFilters[existingIdx] = filter;
      } else {
        updatedFilters.push(filter);
      }
      return {
        selectedFilters: updatedFilters,
        filters: updatedFilters,
      };
    }),

  removeFilter: (column) =>
    set((state) => {
      const newCategoryValues = { ...state.activeCategoryValues };
      delete newCategoryValues[column];

      const newNumericRanges = { ...state.activeNumericRanges };
      delete newNumericRanges[column];

      const newFilters = state.selectedFilters.filter((f) => f.column !== column);

      return {
        selectedFilters: newFilters,
        filters: newFilters,
        activeCategoryValues: newCategoryValues,
        activeNumericRanges: newNumericRanges,
        activeBrush: state.activeBrush && (state.activeBrush as any)?.column === column ? null : state.activeBrush,
      };
    }),

  clearFilters: () =>
    set({
      selectedFilters: [],
      filters: [],
      activeBrush: null,
      dateRange: null,
      activeDateRange: null,
      activeCategoryValues: {},
      activeNumericRanges: {},
    }),

  setActiveBrush: (brush) => {
    set((state) => {
      let updatedFilters = [...state.selectedFilters];
      if (brush && (brush as any).column && (brush as any).range) {
        const col = (brush as any).column;
        const range = (brush as any).range;
        updatedFilters = updatedFilters.filter((f) => f.column !== col);
        updatedFilters.push({
          column: col,
          op: "between",
          value: range,
          label: `${col} brush: ${range[0]} - ${range[1]}`,
        });
      }
      return {
        activeBrush: brush,
        selectedFilters: updatedFilters,
        filters: updatedFilters,
      };
    });
  },

  setDateRange: (start, end) => {
    const rangeObj = { start, end };
    let updatedFilters = get().selectedFilters.filter(
      (f) => !(f.op === "between" && f.column === "date")
    );
    updatedFilters.push({
      column: "date",
      op: "between",
      value: [start, end],
      label: `Date: ${start} to ${end}`,
    });

    set({
      dateRange: rangeObj,
      activeDateRange: rangeObj,
      selectedFilters: updatedFilters,
      filters: updatedFilters,
    });
  },

  setNumericRange: (column, min, max) => {
    const nextNumericRanges = {
      ...get().activeNumericRanges,
      [column]: [min, max] as [number, number],
    };

    let updatedFilters = get().selectedFilters.filter((f) => f.column !== column);
    updatedFilters.push({
      column,
      op: "between",
      value: [min, max],
      label: `${column}: ${min.toFixed(1)} - ${max.toFixed(1)}`,
    });

    set({
      activeNumericRanges: nextNumericRanges,
      selectedFilters: updatedFilters,
      filters: updatedFilters,
    });
  },

  toggleCategoryValue: (column, value) => {
    const current = get().activeCategoryValues[column] || [];
    let updated: string[];
    if (current.includes(value)) {
      updated = current.filter((v) => v !== value);
    } else {
      updated = [...current, value];
    }

    const nextCategoryValues = {
      ...get().activeCategoryValues,
      [column]: updated,
    };

    let updatedFilters = get().selectedFilters.filter((f) => f.column !== column);
    if (updated.length > 0) {
      updatedFilters.push({
        column,
        op: "in",
        value: updated,
        label: `${column}: ${updated.join(", ")}`,
      });
    }

    set({
      activeCategoryValues: nextCategoryValues,
      selectedFilters: updatedFilters,
      filters: updatedFilters,
    });
  },
}));

