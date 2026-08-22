"use client";

import React from "react";
import { Filter, X, RefreshCw, ChevronDown } from "lucide-react";
import { useFilterStore } from "@/store/useFilterStore";

interface FilterSlicerBarProps {
  columns: any[];
  totalRows: number;
  filteredRows?: number;
}

export default function FilterSlicerBar({
  columns = [],
  totalRows = 0,
  filteredRows,
}: FilterSlicerBarProps) {
  const { filters, removeFilter, clearFilters, toggleCategoryValue } = useFilterStore();

  const categoricalCols = columns.filter(
    (c) => c.dtype_category === "categorical" || c.inferred_role === "dimension" || c.inferred_role === "geo"
  );

  const displayCount = filteredRows !== undefined ? filteredRows : totalRows;
  const filterActive = filters.length > 0;

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-xl mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Title & Status */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Filter size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-200">Cross-Filter Slicer Bar</h3>
              {filterActive && (
                <span className="px-2 py-0.5 text-xs font-medium bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30 animate-pulse">
                  Active Filters ({filters.length})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Showing <span className="text-cyan-400 font-medium">{displayCount.toLocaleString()}</span> / {totalRows.toLocaleString()} records
            </p>
          </div>
        </div>

        {/* Dynamic Categorical Slicers */}
        <div className="flex flex-wrap items-center gap-2">
          {categoricalCols.slice(0, 4).map((col) => {
            const topVals = col.top_values || [];
            if (!topVals || topVals.length === 0) return null;

            return (
              <div key={col.name} className="relative group">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-xs font-medium text-slate-300 transition-all">
                  <span className="capitalize">{col.name.replace(/_/g, " ")}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-2 z-50 hidden group-hover:block transition-all">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1 border-b border-slate-800 mb-1">
                    Filter by {col.name}
                  </div>
                  {topVals.map((item: any) => (
                    <button
                      key={item.value}
                      onClick={() => toggleCategoryValue(col.name, item.value)}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center justify-between transition-colors"
                    >
                      <span className="truncate">{item.value}</span>
                      <span className="text-[10px] text-slate-500">({item.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {filterActive && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-medium transition-all"
            >
              <RefreshCw size={12} /> Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Tags */}
      {filterActive && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Active Criteria:</span>
          {filters.map((f) => (
            <span
              key={f.column}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-medium shadow-sm"
            >
              {f.label || `${f.column} ${f.op} ${JSON.stringify(f.value)}`}
              <button
                onClick={() => removeFilter(f.column)}
                className="p-0.5 hover:bg-cyan-500/20 rounded text-cyan-400 hover:text-cyan-200 transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
