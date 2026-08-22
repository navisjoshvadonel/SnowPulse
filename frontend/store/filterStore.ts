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

export interface FilterStoreState {
  // Filter States
  selectedRegion: string | null;
  selectedCategory: string | null;
  dateRange: DateRange | null;
  brushedRange: [number, number] | null;
  selectedFilters: FilterCriterion[];
  activeCategoryValues: Record<string, string[]>;
  activeNumericRanges: Record<string, [number, number]>;
  activeBrush: any | null;

  // Actions
  setSelectedRegion: (region: string | null) => void;
  setSelectedCategory: (category: string | null) => void;
  setDateRange: (start?: string, end?: string) => void;
  setBrushedRange: (range: [number, number] | null) => void;
  setFilter: (key: string, value: any) => void;
  removeFilter: (columnOrKey: string) => void;
  clearFilters: () => void;
  toggleCategoryValue: (column: string, value: string) => void;
  setNumericRange: (column: string, range: [number, number] | null) => void;
}

export const useFilterStore = create<FilterStoreState>((set, get) => ({
  selectedRegion: null,
  selectedCategory: null,
  dateRange: null,
  brushedRange: null,
  selectedFilters: [],
  activeCategoryValues: {},
  activeNumericRanges: {},
  activeBrush: null,

  setSelectedRegion: (region) => {
    set((state) => {
      const updatedFilters = state.selectedFilters.filter((f) => f.column !== "region" && f.column !== "Region");
      if (region) {
        updatedFilters.push({
          column: "region",
          op: "==",
          value: region,
          label: `Region: ${region}`,
        });
      }
      return {
        selectedRegion: region,
        selectedFilters: updatedFilters,
      };
    });
  },

  setSelectedCategory: (category) => {
    set((state) => {
      const updatedFilters = state.selectedFilters.filter((f) => f.column !== "category" && f.column !== "Category");
      if (category) {
        updatedFilters.push({
          column: "category",
          op: "==",
          value: category,
          label: `Category: ${category}`,
        });
      }
      return {
        selectedCategory: category,
        selectedFilters: updatedFilters,
      };
    });
  },

  setDateRange: (start, end) => {
    set((state) => {
      const updatedFilters = state.selectedFilters.filter((f) => f.column !== "date");
      const dRange = start && end ? { start, end } : null;
      if (start && end) {
        updatedFilters.push({
          column: "date",
          op: "between",
          value: [start, end],
          label: `Date: ${start} to ${end}`,
        });
      }
      return {
        dateRange: dRange,
        selectedFilters: updatedFilters,
      };
    });
  },

  setBrushedRange: (range) => {
    set((state) => {
      const updatedFilters = state.selectedFilters.filter((f) => f.column !== "brushedRange");
      if (range) {
        updatedFilters.push({
          column: "brushedRange",
          op: "between",
          value: range,
          label: `Range: ${range[0]} - ${range[1]}`,
        });
      }
      return {
        brushedRange: range,
        activeBrush: range ? { range } : null,
        selectedFilters: updatedFilters,
      };
    });
  },

  setFilter: (key, value) => {
    if (key === "selectedRegion" || key === "region" || key === "Region") {
      get().setSelectedRegion(value);
    } else if (key === "selectedCategory" || key === "category" || key === "Category") {
      get().setSelectedCategory(value);
    } else if (key === "dateRange" || key === "date") {
      if (value && typeof value === "object") {
        get().setDateRange(value.start, value.end);
      } else {
        get().setDateRange(undefined, undefined);
      }
    } else if (key === "brushedRange" || key === "brush") {
      get().setBrushedRange(value);
    } else {
      set((state) => {
        const updatedFilters = state.selectedFilters.filter((f) => f.column !== key);
        if (value !== null && value !== undefined) {
          updatedFilters.push({
            column: key,
            op: "==",
            value,
            label: `${key}: ${String(value)}`,
          });
        }
        return { selectedFilters: updatedFilters };
      });
    }
  },

  removeFilter: (columnOrKey) => {
    set((state) => {
      let nextRegion = state.selectedRegion;
      let nextCat = state.selectedCategory;
      let nextDate = state.dateRange;
      let nextBrush = state.brushedRange;

      if (columnOrKey === "region" || columnOrKey === "Region" || columnOrKey === "selectedRegion") {
        nextRegion = null;
      }
      if (columnOrKey === "category" || columnOrKey === "Category" || columnOrKey === "selectedCategory") {
        nextCat = null;
      }
      if (columnOrKey === "date" || columnOrKey === "dateRange") {
        nextDate = null;
      }
      if (columnOrKey === "brushedRange" || columnOrKey === "brush") {
        nextBrush = null;
      }

      const nextCategoryValues = { ...state.activeCategoryValues };
      delete nextCategoryValues[columnOrKey];

      const nextNumericRanges = { ...state.activeNumericRanges };
      delete nextNumericRanges[columnOrKey];

      const updatedFilters = state.selectedFilters.filter(
        (f) => f.column !== columnOrKey && f.column !== columnOrKey.toLowerCase()
      );

      return {
        selectedRegion: nextRegion,
        selectedCategory: nextCat,
        dateRange: nextDate,
        brushedRange: nextBrush,
        selectedFilters: updatedFilters,
        activeCategoryValues: nextCategoryValues,
        activeNumericRanges: nextNumericRanges,
        activeBrush: nextBrush ? { range: nextBrush } : null,
      };
    });
  },

  clearFilters: () =>
    set({
      selectedRegion: null,
      selectedCategory: null,
      dateRange: null,
      brushedRange: null,
      selectedFilters: [],
      activeCategoryValues: {},
      activeNumericRanges: {},
      activeBrush: null,
    }),

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
    });
  },

  setNumericRange: (column, range) => {
    const nextRanges = { ...get().activeNumericRanges };
    let updatedFilters = get().selectedFilters.filter((f) => f.column !== column);

    if (range) {
      nextRanges[column] = range;
      updatedFilters.push({
        column,
        op: "between",
        value: range,
        label: `${column}: ${range[0]} - ${range[1]}`,
      });
    } else {
      delete nextRanges[column];
    }

    set({
      activeNumericRanges: nextRanges,
      selectedFilters: updatedFilters,
    });
  },
}));
