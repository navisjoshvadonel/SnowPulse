"use client";

import React, { useState } from "react";
import { Sliders, Sparkles, TrendingUp, AlertTriangle, RefreshCw, DollarSign, Layers } from "lucide-react";

interface SensitivityMatrixPanelProps {
  datasetId?: number | null;
  metricColumn?: string;
}

export function SensitivityMatrixPanel({
  datasetId,
  metricColumn = "Revenue",
}: SensitivityMatrixPanelProps) {
  const [priceDelta, setPriceDelta] = useState<number>(0); // -20% to +20%
  const [volumeDelta, setVolumeDelta] = useState<number>(0); // -20% to +20%
  const [baseMetricValue, setBaseMetricValue] = useState<number>(500000);

  // Generate 5x5 Sensitivity Matrix
  const priceSteps = [-10, -5, 0, 5, 10];
  const volumeSteps = [-10, -5, 0, 5, 10];

  const calculateScenarioValue = (pStep: number, vStep: number) => {
    const effectivePrice = 1 + (priceDelta + pStep) / 100;
    const effectiveVolume = 1 + (volumeDelta + vStep) / 100;
    return baseMetricValue * effectivePrice * effectiveVolume;
  };

  const currentScenarioVal = calculateScenarioValue(0, 0);
  const baselineDiff = currentScenarioVal - baseMetricValue;
  const baselinePct = (baselineDiff / baseMetricValue) * 100;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-lg transition-all duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 shadow-inner">
            <Sliders className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold bg-gradient-to-r from-amber-300 via-orange-200 to-yellow-300 bg-clip-text text-transparent">
                Multi-Variable Sensitivity & What-If Scenario Matrix
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                Power BI What-If Parameters+ ⚡
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Dual-axis scenario grid modeling dynamic metric output across price and volume sensitivity matrices
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 text-slate-300">
          <span>Target Metric: <strong className="text-amber-400">{metricColumn}</strong></span>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-950/80 p-4 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-300 font-semibold">Price Adjustment Sensitivity</span>
            <span className="text-amber-400 font-bold">{priceDelta >= 0 ? `+${priceDelta}%` : `${priceDelta}%`}</span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={1}
            value={priceDelta}
            onChange={(e) => setPriceDelta(Number(e.target.value))}
            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>-20% Discount</span>
            <span>Baseline 0%</span>
            <span>+20% Premium</span>
          </div>
        </div>

        <div className="bg-slate-950/80 p-4 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-300 font-semibold">Volume Growth Sensitivity</span>
            <span className="text-cyan-400 font-bold">{volumeDelta >= 0 ? `+${volumeDelta}%` : `${volumeDelta}%`}</span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={1}
            value={volumeDelta}
            onChange={(e) => setVolumeDelta(Number(e.target.value))}
            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>-20% Contraction</span>
            <span>Baseline 0%</span>
            <span>+20% Expansion</span>
          </div>
        </div>
      </div>

      {/* 5x5 Sensitivity Heatmap Table */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 overflow-x-auto">
        <div className="text-xs font-mono text-slate-400 mb-3 flex items-center justify-between">
          <span>5x5 SENSITIVITY MATRIX (Price Δ % vs Volume Δ %)</span>
          <span className="text-amber-400 font-bold">Scenario Outcome: ${Math.round(currentScenarioVal).toLocaleString()}</span>
        </div>

        <table className="w-full text-center text-xs font-mono border-collapse">
          <thead>
            <tr>
              <th className="p-2 border border-slate-800 bg-slate-900 text-slate-400">Price \ Volume</th>
              {volumeSteps.map((v) => (
                <th key={v} className="p-2 border border-slate-800 bg-slate-900 text-slate-300">
                  {v >= 0 ? `+${v}%` : `${v}%`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {priceSteps.map((p) => (
              <tr key={p}>
                <td className="p-2 border border-slate-800 bg-slate-900 font-bold text-slate-300">
                  {p >= 0 ? `+${p}%` : `${p}%`}
                </td>
                {volumeSteps.map((v) => {
                  const val = calculateScenarioValue(p, v);
                  const diffPct = ((val - baseMetricValue) / baseMetricValue) * 100;
                  const isCurrent = p === 0 && v === 0;

                  let bgClass = "bg-slate-900/60 text-slate-300";
                  if (diffPct > 10) bgClass = "bg-emerald-950/80 border-emerald-500/40 text-emerald-300 font-bold";
                  else if (diffPct > 0) bgClass = "bg-teal-950/60 border-teal-500/30 text-teal-300";
                  else if (diffPct < -10) bgClass = "bg-rose-950/80 border-rose-500/40 text-rose-300 font-bold";
                  else if (diffPct < 0) bgClass = "bg-amber-950/60 border-amber-500/30 text-amber-300";

                  return (
                    <td
                      key={v}
                      className={`p-3 border border-slate-800 transition ${bgClass} ${
                        isCurrent ? "ring-2 ring-amber-400 font-bold scale-[1.02]" : ""
                      }`}
                    >
                      <div>${Math.round(val).toLocaleString()}</div>
                      <div className="text-[9px] opacity-80 mt-0.5">{diffPct >= 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
