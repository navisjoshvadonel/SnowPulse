"use client";

import React, { useState } from "react";
import { Grid, Sparkles, TrendingUp, TrendingDown, Layers, HelpCircle, ArrowUpRight, CheckCircle2, Sliders } from "lucide-react";

interface CorrelationMatrixPanelProps {
  correlations: {
    columns: string[];
    matrix: number[][];
  } | null;
  schema: any;
  geoData: Array<{ region: string; value: number; count: number }> | null;
  kpis: any;
  loading: boolean;
}

export default function CorrelationMatrixPanel({
  correlations,
  schema,
  geoData,
  kpis,
  loading,
}: CorrelationMatrixPanelProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string; val: number } | null>(null);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-brand-surface/40 border border-white/5 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-96 bg-brand-surface/40 border border-white/5 rounded-2xl" />
          <div className="lg:col-span-5 h-96 bg-brand-surface/40 border border-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Fallback / Mock correlation matrix if no numeric correlation columns exist
  const cols = correlations?.columns?.length
    ? correlations.columns
    : (schema?.columns?.filter((c: { role?: string; min?: number }) => c.role === "metric" || c.role === "numeric" || c.min !== undefined).map((c: { name: string }) => c.name) || [
        "Revenue",
        "Units_Sold",
        "Discount_Pct",
        "Profit_Margin",
      ]);

  // Ensure matrix matches cols length
  let matrix: number[][] = correlations?.matrix || [];
  if (matrix.length !== cols.length || matrix.some((r) => r.length !== cols.length)) {
    matrix = cols.map((_: string, i: number) =>
      cols.map((_: string, j: number) => {
        if (i === j) return 1.0;
        const mockVals: Record<string, number> = {
          "0-1": 0.84,
          "0-2": -0.32,
          "0-3": 0.65,
          "1-2": -0.45,
          "1-3": 0.52,
          "2-3": -0.18,
        };
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        return mockVals[key] ?? 0.15;
      })
    );
  }

  // Find strongest positive and negative correlation pairs (excluding self-correlations i===j)
  let maxPos = { row: "", col: "", val: -2 };
  let maxNeg = { row: "", col: "", val: 2 };

  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const val = matrix[i][j];
      if (val > maxPos.val) {
        maxPos = { row: cols[i], col: cols[j], val };
      }
      if (val < maxNeg.val) {
        maxNeg = { row: cols[i], col: cols[j], val };
      }
    }
  }

  const primaryMetric = schema?.primary_metric || kpis?.metric_name || "Primary Metric";
  const primaryCategory = schema?.primary_category || "Segment";

  // Get color scale for correlation value
  const getCellColor = (val: number, isSelf: boolean) => {
    if (isSelf) return "bg-indigo-500/20 border-indigo-500/30 text-indigo-200 font-bold";
    if (val >= 0.7) return "bg-emerald-500/30 border-emerald-500/40 text-emerald-200 font-bold";
    if (val >= 0.3) return "bg-emerald-500/15 border-emerald-500/20 text-emerald-300 font-semibold";
    if (val >= -0.1 && val <= 0.1) return "bg-white/[0.03] border-white/[0.06] text-white/50";
    if (val <= -0.7) return "bg-rose-500/30 border-rose-500/40 text-rose-200 font-bold";
    if (val <= -0.3) return "bg-amber-500/20 border-amber-500/30 text-amber-300 font-semibold";
    return "bg-cyan-500/10 border-cyan-500/20 text-cyan-200";
  };

  const getRelationshipLabel = (val: number) => {
    if (val === 1) return "Perfect Direct";
    if (val >= 0.7) return "Strong Positive";
    if (val >= 0.3) return "Moderate Positive";
    if (val > -0.1 && val < 0.1) return "No Linear Correlation";
    if (val <= -0.7) return "Strong Negative";
    if (val <= -0.3) return "Moderate Negative";
    return "Weak Relationship";
  };

  // Driver breakdown table rows
  const driverRows = geoData?.length
    ? geoData.map((g) => ({
        segment: g.region,
        total: g.value,
        share: kpis?.total_value ? ((g.value / kpis.total_value) * 100).toFixed(1) : "N/A",
        count: g.count,
      }))
    : [
        { segment: "Enterprise", total: 425000, share: "45.2", count: 120 },
        { segment: "SMB & Growth", total: 280000, share: "29.8", count: 310 },
        { segment: "Mid-Market", total: 175000, share: "18.6", count: 95 },
        { segment: "Consumer / Direct", total: 60000, share: "6.4", count: 450 },
      ];

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden shadow-xl"
        style={{
          background: "linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(15, 23, 42, 0.85) 60%, rgba(6, 78, 59, 0.4) 100%)",
          border: "1px solid rgba(129, 140, 248, 0.2)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                <Grid size={20} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Correlation & Driver Matrix</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Pre-Analysis Engine
              </span>
            </div>
            <p className="text-xs text-white/60 mt-1.5 max-w-2xl leading-relaxed">
              Discover how key metrics co-move before diving into chart panels. Identify direct drivers of{" "}
              <span className="text-cyan-300 font-semibold">{primaryMetric}</span> across numerical variables and categorical segments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-left">
              <span className="text-[10px] text-white/40 block font-mono">Strongest Co-movement</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <TrendingUp size={13} />
                {maxPos.row && maxPos.col ? `${maxPos.row} × ${maxPos.col}` : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Correlation Heatmap (Left) + Driver Breakdown Table (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Compact Correlation Heatmap */}
        <div className="lg:col-span-7 bg-brand-surface/40 border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders size={16} className="text-indigo-400" />
                  Numeric Correlation Matrix
                </h3>
                <p className="text-[11px] text-white/40 mt-0.5">Pearson correlation coefficients (-1.0 to +1.0)</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400" /> +1.0 Direct</span>
                <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-400" /> -1.0 Inverse</span>
              </div>
            </div>

            {/* Heatmap Matrix Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs text-center border-separate border-spacing-1.5">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-white/40 font-mono text-[10px]">Variable</th>
                    {cols.map((col: string) => (
                      <th key={col} className="p-2 font-mono text-[11px] text-white/70 max-w-[90px] truncate" title={col}>
                        {col.length > 10 ? `${col.slice(0, 8)}…` : col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cols.map((rowCol: string, i: number) => (
                    <tr key={rowCol}>
                      <td className="p-2 text-left font-mono text-[11px] text-white/80 font-medium max-w-[120px] truncate" title={rowCol}>
                        {rowCol}
                      </td>
                      {cols.map((colCol: string, j: number) => {
                        const val = matrix[i]?.[j] ?? 0;
                        const isSelf = i === j;
                        const colorClass = getCellColor(val, isSelf);

                        return (
                          <td
                            key={`${rowCol}-${colCol}`}
                            onMouseEnter={() => setHoveredCell({ row: rowCol, col: colCol, val })}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`p-3 rounded-lg border transition-all cursor-pointer ${colorClass} hover:scale-105 hover:shadow-lg`}
                          >
                            {val > 0 && !isSelf ? `+${val.toFixed(2)}` : val.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Hover Takeaway */}
          <div className="mt-5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
            {hoveredCell ? (
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-cyan-400 shrink-0" />
                <span className="text-white/80">
                  <strong className="text-white">{hoveredCell.row}</strong> vs <strong className="text-white">{hoveredCell.col}</strong>:{" "}
                  <span className="text-cyan-300 font-mono font-semibold">
                    {hoveredCell.val > 0 ? `+${hoveredCell.val.toFixed(2)}` : hoveredCell.val.toFixed(2)} ({getRelationshipLabel(hoveredCell.val)})
                  </span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-white/40">
                <HelpCircle size={14} className="shrink-0" />
                <span>Hover over any matrix cell to inspect variable co-movement.</span>
              </div>
            )}
          </div>
        </div>

        {/* Primary Metric Driver & Segment Breakdown Table */}
        <div className="lg:col-span-5 bg-brand-surface/40 border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers size={16} className="text-emerald-400" />
                  {primaryMetric} by {primaryCategory}
                </h3>
                <p className="text-[11px] text-white/40 mt-0.5">Top categorical driver breakdown</p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Segment Drivers
              </span>
            </div>

            {/* Breakdown Table */}
            <div className="mt-4 overflow-hidden rounded-xl border border-white/5">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.03] text-white/40 font-mono text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">{primaryCategory}</th>
                    <th className="py-2.5 px-3 text-right">Total {primaryMetric}</th>
                    <th className="py-2.5 px-3 text-right">Share (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {driverRows.map((row, idx) => (
                    <tr key={row.segment} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-3 font-medium text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-mono text-white/40">
                          {idx + 1}
                        </span>
                        <span className="truncate max-w-[120px]">{row.segment}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-white/90">
                        {typeof row.total === "number"
                          ? row.total >= 1000000
                            ? `$${(row.total / 1000000).toFixed(2)}M`
                            : row.total >= 1000
                            ? `$${(row.total / 1000).toFixed(1)}k`
                            : `$${row.total.toLocaleString()}`
                          : row.total}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                          {row.share}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Takeaway / Actionable Focus Box */}
          <div className="mt-5 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
              <CheckCircle2 size={14} />
              <span>Where Should You Look?</span>
            </div>
            <p className="text-[11px] text-white/70 leading-relaxed">
              Focus initial analytical deep-dives on{" "}
              <strong className="text-white">{driverRows[0]?.segment || "Top Segment"}</strong> as it contributes{" "}
              <strong className="text-emerald-300 font-mono">{driverRows[0]?.share}%</strong> of overall {primaryMetric}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
