"use client";

import React from "react";
import { useFilterStore } from "@/store/filterStore";
import { Filter, X, Trash2 } from "lucide-react";

export const FilterChipBar: React.FC = () => {
  const {
    selectedRegion,
    selectedCategory,
    dateRange,
    brushedRange,
    selectedFilters,
    activeCategoryValues,
    activeNumericRanges,
    removeFilter,
    clearFilters,
  } = useFilterStore();

  const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

  if (selectedRegion) {
    chips.push({
      id: "selectedRegion",
      label: `Region: ${selectedRegion}`,
      onRemove: () => removeFilter("selectedRegion"),
    });
  }

  if (selectedCategory) {
    chips.push({
      id: "selectedCategory",
      label: `Category: ${selectedCategory}`,
      onRemove: () => removeFilter("selectedCategory"),
    });
  }

  if (dateRange?.start && dateRange?.end) {
    chips.push({
      id: "dateRange",
      label: `Date: ${dateRange.start} → ${dateRange.end}`,
      onRemove: () => removeFilter("dateRange"),
    });
  }

  if (brushedRange) {
    chips.push({
      id: "brushedRange",
      label: `Range: [${brushedRange[0]}, ${brushedRange[1]}]`,
      onRemove: () => removeFilter("brushedRange"),
    });
  }

  Object.entries(activeCategoryValues).forEach(([col, values]) => {
    if (values.length > 0) {
      chips.push({
        id: col,
        label: `${col}: ${values.join(", ")}`,
        onRemove: () => removeFilter(col),
      });
    }
  });

  Object.entries(activeNumericRanges).forEach(([col, r]) => {
    chips.push({
      id: col,
      label: `${col}: ${r[0]} - ${r[1]}`,
      onRemove: () => removeFilter(col),
    });
  });

  selectedFilters.forEach((f, idx) => {
    if (
      f.column !== "region" &&
      f.column !== "category" &&
      f.column !== "date" &&
      f.column !== "brushedRange" &&
      !activeCategoryValues[f.column] &&
      !activeNumericRanges[f.column]
    ) {
      chips.push({
        id: f.column || `filter-${idx}`,
        label: f.label || `${f.column} ${f.op} ${JSON.stringify(f.value)}`,
        onRemove: () => removeFilter(f.column),
      });
    }
  });

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-6 p-3 rounded-xl border border-cyan-500/20 bg-slate-950/70 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-cyan-950/20 transition-all duration-300">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mr-1">
          <Filter className="w-3.5 h-3.5 animate-pulse" />
          <span>Active Filters ({chips.length}):</span>
        </div>

        {chips.map((chip) => (
          <span
            key={chip.id}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 hover:border-cyan-400 hover:text-white transition-colors duration-150 group shadow-sm"
          >
            <span>{chip.label}</span>
            <button
              onClick={chip.onRemove}
              className="text-cyan-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-full p-0.5 transition-all"
              title="Remove filter"
              aria-label={`Remove filter ${chip.label}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <button
        onClick={clearFilters}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all duration-200 ml-auto"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Clear All</span>
      </button>
    </div>
  );
};
export default FilterChipBar;
