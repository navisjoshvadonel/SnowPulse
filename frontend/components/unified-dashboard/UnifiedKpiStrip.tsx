"use client";

import React from "react";
import { Database, ShieldCheck, AlertTriangle, TrendingUp, Layers } from "lucide-react";

interface UnifiedKpiStripProps {
  totalRows: number;
  filteredRows?: number;
  qualityReport?: any;
  primaryMetricName?: string;
  primaryMetricStats?: any;
  columnCount?: number;
}

export default function UnifiedKpiStrip({
  totalRows = 0,
  filteredRows,
  qualityReport,
  primaryMetricName = "Volume",
  primaryMetricStats,
  columnCount = 0,
}: UnifiedKpiStripProps) {
  const healthScore = qualityReport?.health_score ?? 98.5;
  const nullPct = qualityReport?.total_null_pct ?? 0.0;
  const displayRows = filteredRows !== undefined ? filteredRows : totalRows;

  const metricMean = primaryMetricStats?.mean ?? null;
  const metricMin = primaryMetricStats?.min ?? null;
  const metricMax = primaryMetricStats?.max ?? null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* KPI 1: Dataset Volume & Filtered Count */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-xl flex items-center justify-between relative overflow-hidden group hover:border-cyan-500/40 transition-all">
        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors" />
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Total Ingested Records
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-slate-100">{displayRows.toLocaleString()}</h3>
            {filteredRows !== undefined && filteredRows !== totalRows && (
              <span className="text-xs text-cyan-400 font-medium font-mono">
                ({((filteredRows / totalRows) * 100).toFixed(0)}%)
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Layers size={12} className="text-slate-400" /> Across {columnCount} dataset columns
          </p>
        </div>
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
          <Database size={22} />
        </div>
      </div>

      {/* KPI 2: Data Health & Quality Score */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-xl flex items-center justify-between relative overflow-hidden group hover:border-emerald-500/40 transition-all">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Data Quality Score
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-emerald-400">{healthScore.toFixed(1)}/100</h3>
            <span className="text-xs text-emerald-400 font-medium">Optimal</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {qualityReport?.data_quality_issues?.length || 0} issues flagged
          </p>
        </div>
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
          <ShieldCheck size={22} />
        </div>
      </div>

      {/* KPI 3: Null & Missing Density */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-xl flex items-center justify-between relative overflow-hidden group hover:border-amber-500/40 transition-all">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Missing Density
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-slate-100">{nullPct.toFixed(1)}%</h3>
            <span className="text-xs text-amber-400 font-medium">Null Cells</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {qualityReport?.total_null_cells?.toLocaleString() || 0} missing values
          </p>
        </div>
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
          <AlertTriangle size={22} />
        </div>
      </div>

      {/* KPI 4: Primary Metric Average / Range */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-xl flex items-center justify-between relative overflow-hidden group hover:border-indigo-500/40 transition-all">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 truncate max-w-[150px]">
            Primary: {primaryMetricName.replace(/_/g, " ")}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-indigo-300">
              {metricMean !== null ? metricMean.toLocaleString() : "N/A"}
            </h3>
            <span className="text-xs text-indigo-400 font-medium">Avg</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Range: [{metricMin ?? 0} - {metricMax ?? 0}]
          </p>
        </div>
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
          <TrendingUp size={22} />
        </div>
      </div>
    </div>
  );
}
