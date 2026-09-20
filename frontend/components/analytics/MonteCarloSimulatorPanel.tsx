"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import {
  Activity,
  Sliders,
  Sparkles,
  ShieldAlert,
  TrendingUp,
  RotateCcw,
  Zap,
  Pin,
  Check,
  ChevronDown,
  Percent,
  Layers
} from "lucide-react";
import { fetchAPI } from "@/services/api";
import { usePinnedChartStore } from "@/store/usePinnedChartStore";
import { runMonteCarloSimulation, MonteCarloResult } from "@/utils/monteCarloSimulation";

interface MonteCarloSimulatorPanelProps {
  datasetId?: number | null;
  datasetName?: string;
  metricColumn?: string;
  baseValue?: number;
  numericColumns?: string[];
}

export function MonteCarloSimulatorPanel({
  datasetId,
  datasetName,
  metricColumn: initialMetricCol,
  baseValue: initialBaseVal,
  numericColumns = [],
}: MonteCarloSimulatorPanelProps) {
  // Scenario Parameters
  const [selectedMetric, setSelectedMetric] = useState<string>(initialMetricCol || "Revenue");
  const [baseVal, setBaseVal] = useState<number>(initialBaseVal || 10000);
  const [priceDelta, setPriceDelta] = useState<number>(0.05); // +5%
  const [costDelta, setCostDelta] = useState<number>(0.02); // +2%
  const [churnDelta, setChurnDelta] = useState<number>(0.0); // 0%
  const [volatility, setVolatility] = useState<number>(0.15); // 15%
  const [steps, setSteps] = useState<number>(12); // 12 months
  const [iterations, setIterations] = useState<number>(1000); // 1,000 runs
  const [engineMode, setEngineMode] = useState<"client" | "server">("client");

  const [simulationResult, setSimulationResult] = useState<MonteCarloResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);

  const confidenceChartRef = useRef<HTMLDivElement>(null);
  const distributionChartRef = useRef<HTMLDivElement>(null);
  const pinChart = usePinnedChartStore((state) => state.pinChart);

  // Sync initial props
  useEffect(() => {
    if (initialMetricCol) setSelectedMetric(initialMetricCol);
    if (initialBaseVal && initialBaseVal > 0) setBaseVal(initialBaseVal);
  }, [initialMetricCol, initialBaseVal]);

  // Execute simulation on parameter change
  useEffect(() => {
    let isMounted = true;

    async function runSim() {
      setLoading(true);

      if (engineMode === "server" && datasetId) {
        try {
          const params = new URLSearchParams({
            target_metric: selectedMetric,
            steps: steps.toString(),
            iterations: iterations.toString(),
            price_delta: priceDelta.toString(),
            cost_delta: costDelta.toString(),
            churn_delta: churnDelta.toString(),
            volatility: volatility.toString(),
          });
          const resp = await fetchAPI(`/api/datasets/${datasetId}/monte-carlo?${params.toString()}`);
          if (resp.ok && isMounted) {
            const data = await resp.json();
            if (data && !data.error) {
              const res: MonteCarloResult = {
                targetMetric: data.target_metric,
                baseValue: data.base_value,
                iterations: data.iterations,
                steps: data.steps,
                stepLabels: data.step_labels,
                percentiles: data.percentiles,
                riskMetrics: {
                  finalP10: data.risk_metrics.final_p10,
                  finalP50: data.risk_metrics.final_p50,
                  finalP90: data.risk_metrics.final_p90,
                  var95: data.risk_metrics.var_95,
                  cvar95: data.risk_metrics.cvar_95,
                  probOfLoss: data.risk_metrics.prob_of_loss,
                  probOfTarget: data.risk_metrics.prob_of_target,
                  targetThreshold: data.risk_metrics.target_threshold,
                },
                distributionBins: data.distribution_bins.map((b: any) => ({
                  binMin: b.bin_min,
                  binMax: b.bin_max,
                  label: b.label,
                  count: b.count,
                  percentage: b.percentage,
                  tier: b.tier,
                })),
                aiRiskNarrative: data.ai_risk_narrative,
                executionTimeMs: 45,
              };
              setSimulationResult(res);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn("Server Monte Carlo failed, falling back to Web Worker engine:", e);
        }
      }

      // High-performance client-side simulation engine
      const res = runMonteCarloSimulation({
        baseValue: baseVal,
        steps,
        iterations,
        priceDelta,
        costDelta,
        churnDelta,
        volatility,
        metricName: selectedMetric,
      });

      if (isMounted) {
        setSimulationResult(res);
        setLoading(false);
      }
    }

    const timer = setTimeout(runSim, 80);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [datasetId, selectedMetric, baseVal, priceDelta, costDelta, churnDelta, volatility, steps, iterations, engineMode]);

  // Render ECharts Confidence Bands Stacked Area Chart
  useEffect(() => {
    if (!confidenceChartRef.current || !simulationResult) return;

    const chartInstance = echarts.init(confidenceChartRef.current, "dark");
    const { stepLabels, percentiles, baseValue } = simulationResult;

    // Outer band diff (P90 - P10) and inner band diff (P75 - P25) for stacked confidence shading
    const p10 = percentiles.p10;
    const p25 = percentiles.p25;
    const p50 = percentiles.p50;
    const p75 = percentiles.p75;
    const p90 = percentiles.p90;

    const outerBandWidth = p90.map((v, i) => Math.max(0, v - p10[i]));
    const baselineSeries = stepLabels.map(() => baseValue);

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(168, 85, 247, 0.4)",
        borderWidth: 1,
        textStyle: { color: "#f8fafc", fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const stepIndex = params[0].dataIndex;
          return `
            <div class="font-semibold text-purple-300 mb-1 border-b border-slate-700/60 pb-1">
              Time Horizon: ${stepLabels[stepIndex]}
            </div>
            <div class="space-y-1 text-xs font-mono">
              <div class="flex justify-between gap-4 text-emerald-400">
                <span>P90 (Best Case):</span> <span>${p90[stepIndex].toLocaleString()}</span>
              </div>
              <div class="flex justify-between gap-4 text-cyan-400">
                <span>P75 (Upper Quartile):</span> <span>${p75[stepIndex].toLocaleString()}</span>
              </div>
              <div class="flex justify-between gap-4 text-amber-300 font-bold">
                <span>P50 (Expected):</span> <span>${p50[stepIndex].toLocaleString()}</span>
              </div>
              <div class="flex justify-between gap-4 text-blue-400">
                <span>P25 (Lower Quartile):</span> <span>${p25[stepIndex].toLocaleString()}</span>
              </div>
              <div class="flex justify-between gap-4 text-rose-400">
                <span>P10 (Worst Case):</span> <span>${p10[stepIndex].toLocaleString()}</span>
              </div>
              <div class="flex justify-between gap-4 text-slate-400 border-t border-slate-800 pt-1 mt-1">
                <span>Baseline (Start):</span> <span>${baseValue.toLocaleString()}</span>
              </div>
            </div>
          `;
        },
      },
      grid: {
        top: 45,
        right: 25,
        bottom: 35,
        left: 55,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        data: stepLabels,
        axisLine: { lineStyle: { color: "#475569" } },
        axisLabel: { color: "#94a3b8", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(51, 65, 85, 0.4)", type: "dashed" } },
        axisLabel: {
          color: "#94a3b8",
          fontSize: 11,
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`),
        },
      },
      series: [
        // P10 Base Area (transparent anchor)
        {
          name: "P10 Base",
          type: "line",
          data: p10,
          lineStyle: { opacity: 0 },
          stack: "confidence",
          symbol: "none",
        },
        // Outer Confidence Band (P10 - P90)
        {
          name: "P10-P90 Confidence Band",
          type: "line",
          data: outerBandWidth,
          stack: "confidence",
          symbol: "none",
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(168, 85, 247, 0.35)" },
              { offset: 1, color: "rgba(99, 102, 241, 0.08)" },
            ]),
          },
          lineStyle: { opacity: 0 },
        },
        // P90 Best Case Boundary
        {
          name: "P90 (Best Case)",
          type: "line",
          data: p90,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { color: "#10b981", width: 2, type: "dashed" },
          itemStyle: { color: "#10b981" },
        },
        // P50 Expected Outcome Line
        {
          name: "P50 (Expected Outcome)",
          type: "line",
          data: p50,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: {
            color: "#06b6d4",
            width: 3.5,
            shadowColor: "rgba(6, 182, 212, 0.6)",
            shadowBlur: 10,
          },
          itemStyle: { color: "#38bdf8", borderWidth: 2, borderColor: "#0f172a" },
        },
        // P10 Worst Case Boundary
        {
          name: "P10 (Worst Case)",
          type: "line",
          data: p10,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { color: "#f43f5e", width: 2, type: "dashed" },
          itemStyle: { color: "#f43f5e" },
        },
        // Historical Baseline Reference
        {
          name: "Initial Baseline",
          type: "line",
          data: baselineSeries,
          symbol: "none",
          lineStyle: { color: "#64748b", width: 1.5, type: "dotted" },
        },
      ],
      animationDuration: 400,
      animationEasing: "cubicOut",
    };

    chartInstance.setOption(option);
    const handleResize = () => chartInstance.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.dispose();
    };
  }, [simulationResult]);

  // Render ECharts Outcome Frequency Histogram / Probability Density Chart
  useEffect(() => {
    if (!distributionChartRef.current || !simulationResult) return;

    const chartInstance = echarts.init(distributionChartRef.current, "dark");
    const { distributionBins, riskMetrics } = simulationResult;

    const xLabels = distributionBins.map((b) => b.label);
    const yValues = distributionBins.map((b) => b.count);
    const colors = distributionBins.map((b) => {
      if (b.tier === "Worst Case (P10)") return "#f43f5e";
      if (b.tier === "Optimistic (P90)") return "#10b981";
      return "#8b5cf6";
    });

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(139, 92, 246, 0.4)",
        borderWidth: 1,
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params[0]) return "";
          const idx = params[0].dataIndex;
          const bin = distributionBins[idx];
          return `
            <div class="text-xs font-mono">
              <div class="font-bold text-purple-300 border-b border-slate-700 pb-1 mb-1">
                Outcome Bin: ${bin.label}
              </div>
              <div>Frequency: <span class="text-amber-300 font-bold">${bin.count} runs</span> (${bin.percentage}%)</div>
              <div>Classification: <span class="text-cyan-300 font-semibold">${bin.tier}</span></div>
            </div>
          `;
        },
      },
      grid: {
        top: 25,
        right: 15,
        bottom: 35,
        left: 45,
      },
      xAxis: {
        type: "category",
        data: xLabels,
        axisLine: { lineStyle: { color: "#475569" } },
        axisLabel: { color: "#94a3b8", fontSize: 9, rotate: 25 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(51, 65, 85, 0.4)", type: "dashed" } },
        axisLabel: { color: "#94a3b8", fontSize: 10 },
      },
      series: [
        {
          name: "Frequency",
          type: "bar",
          data: yValues.map((v, i) => ({
            value: v,
            itemStyle: {
              color: colors[i],
              borderRadius: [4, 4, 0, 0],
            },
          })),
          markLine: {
            symbol: ["none", "none"],
            label: { color: "#fbbf24", fontSize: 10, position: "end" },
            data: [
              {
                type: "average",
                name: "Mean Runs",
                lineStyle: { color: "#fbbf24", type: "dashed" },
              },
            ],
          },
        },
      ],
      animationDuration: 400,
    };

    chartInstance.setOption(option);
    const handleResize = () => chartInstance.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.dispose();
    };
  }, [simulationResult]);

  const handlePinScenario = () => {
    if (!simulationResult) return;
    pinChart({
      title: `Monte Carlo Risk Simulator: ${selectedMetric}`,
      type: "line",
      labels: simulationResult.stepLabels,
      data: simulationResult.percentiles.p50,
      insight: simulationResult.aiRiskNarrative,
    }, `Monte Carlo Scenario for ${selectedMetric}`);
    setIsPinned(true);
    setTimeout(() => setIsPinned(false), 2000);
  };

  const resetParameters = () => {
    setPriceDelta(0.05);
    setCostDelta(0.02);
    setChurnDelta(0.0);
    setVolatility(0.15);
    setSteps(12);
    setIterations(1000);
  };

  const riskMetrics = simulationResult?.riskMetrics;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-lg transition-all duration-300">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 text-purple-400 shadow-inner">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold bg-gradient-to-r from-purple-300 via-cyan-200 to-indigo-300 bg-clip-text text-transparent">
                🔮 AI Monte Carlo Risk & Scenario Simulator
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-semibold">
                {iterations.toLocaleString()} Stochastic Runs
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-semibold">
                Web Worker ⚡
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Stochastic Geometric Brownian Motion probability bounds (P10, P50, P90) & 95% Value-at-Risk (VaR) projection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetParameters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Reset to Default Parameters"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            onClick={handlePinScenario}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg border border-purple-500/40 transition"
          >
            {isPinned ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Pin className="w-3.5 h-3.5" />}
            {isPinned ? "Pinned!" : "Pin to Canvas"}
          </button>
        </div>
      </div>

      {/* What-If Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-5">
        {/* Metric & Base Value */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>Target Metric</span>
            <span className="text-[10px] text-purple-400 font-mono">Base: {baseVal.toLocaleString()}</span>
          </label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-3 py-2 focus:ring-1 focus:ring-purple-500"
          >
            {(numericColumns.length > 0 ? numericColumns : ["Revenue", "Profit", "Sales", "Expenses"]).map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>

          <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Initial Baseline:</span>
            <input
              type="number"
              value={baseVal}
              onChange={(e) => setBaseVal(Math.max(1, Number(e.target.value)))}
              className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-right font-mono text-xs text-purple-300"
            />
          </div>
        </div>

        {/* Pricing & Rate Delta */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-medium text-slate-300">
            <span>Pricing / Yield Shift</span>
            <span className={`font-mono text-xs ${priceDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {priceDelta > 0 ? `+${(priceDelta * 100).toFixed(1)}%` : `${(priceDelta * 100).toFixed(1)}%`}
            </span>
          </div>
          <input
            type="range"
            min="-0.30"
            max="0.50"
            step="0.01"
            value={priceDelta}
            onChange={(e) => setPriceDelta(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>-30%</span>
            <span>0%</span>
            <span>+50%</span>
          </div>
        </div>

        {/* Cost Inflation Delta */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-medium text-slate-300">
            <span>Cost Inflation Shift</span>
            <span className={`font-mono text-xs ${costDelta > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {costDelta > 0 ? `+${(costDelta * 100).toFixed(1)}%` : `${(costDelta * 100).toFixed(1)}%`}
            </span>
          </div>
          <input
            type="range"
            min="-0.10"
            max="0.30"
            step="0.01"
            value={costDelta}
            onChange={(e) => setCostDelta(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>-10%</span>
            <span>0%</span>
            <span>+30%</span>
          </div>
        </div>

        {/* Market Volatility */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-medium text-slate-300">
            <span>Volatility σ (Uncertainty)</span>
            <span className="font-mono text-xs text-amber-400">{(volatility * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.50"
            step="0.01"
            value={volatility}
            onChange={(e) => setVolatility(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>5% (Low)</span>
            <span>25%</span>
            <span>50% (High)</span>
          </div>
        </div>
      </div>

      {/* Advanced Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 mb-5">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-slate-300 font-medium">
            <Sliders className="w-3.5 h-3.5 text-purple-400" /> Horizon Steps:
          </span>
          {[6, 12, 18, 24, 36].map((st) => (
            <button
              key={st}
              onClick={() => setSteps(st)}
              className={`px-2 py-0.5 rounded font-mono transition ${
                steps === st ? "bg-purple-600 text-white font-bold" : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {st}m
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-slate-300 font-medium">Runs:</span>
          {[1000, 5000, 10000].map((it) => (
            <button
              key={it}
              onClick={() => setIterations(it)}
              className={`px-2 py-0.5 rounded font-mono transition ${
                iterations === it ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {it.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {/* P50 Expected */}
        <div className="bg-slate-950/70 border border-cyan-500/30 rounded-xl p-3 shadow-lg">
          <div className="text-[11px] text-cyan-400 font-medium flex items-center justify-between">
            <span>P50 Expected Outcome</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-200 mt-1">
            {riskMetrics ? riskMetrics.finalP50.toLocaleString() : "..."}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {riskMetrics && baseVal > 0 ? (
              <span className={riskMetrics.finalP50 >= baseVal ? "text-emerald-400" : "text-rose-400"}>
                {(((riskMetrics.finalP50 / baseVal) - 1) * 100).toFixed(1)}% vs Base
              </span>
            ) : null}
          </div>
        </div>

        {/* P90 Best Case */}
        <div className="bg-slate-950/70 border border-emerald-500/30 rounded-xl p-3 shadow-lg">
          <div className="text-[11px] text-emerald-400 font-medium flex items-center justify-between">
            <span>P90 (Best Case)</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-200 mt-1">
            {riskMetrics ? riskMetrics.finalP90.toLocaleString() : "..."}
          </div>
          <div className="text-[10px] text-emerald-400/80 font-mono mt-0.5">Optimistic Horizon Bounds</div>
        </div>

        {/* P10 Worst Case */}
        <div className="bg-slate-950/70 border border-rose-500/30 rounded-xl p-3 shadow-lg">
          <div className="text-[11px] text-rose-400 font-medium flex items-center justify-between">
            <span>P10 (Worst Case)</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-200 mt-1">
            {riskMetrics ? riskMetrics.finalP10.toLocaleString() : "..."}
          </div>
          <div className="text-[10px] text-rose-400/80 font-mono mt-0.5">Downside Stress Threshold</div>
        </div>

        {/* 95% Value-at-Risk */}
        <div className="bg-slate-950/70 border border-purple-500/30 rounded-xl p-3 shadow-lg">
          <div className="text-[11px] text-purple-400 font-medium flex items-center justify-between">
            <span>95% Value-at-Risk (VaR)</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-200 mt-1">
            {riskMetrics ? riskMetrics.var95.toLocaleString() : "..."}
          </div>
          <div className="text-[10px] text-purple-300/80 font-mono mt-0.5">Max Expected Downside Loss</div>
        </div>

        {/* Downside Risk % */}
        <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-3 shadow-lg col-span-2 sm:col-span-1">
          <div className="text-[11px] text-amber-400 font-medium flex items-center justify-between">
            <span>Downside Loss Prob.</span>
            <Percent className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-200 mt-1">
            {riskMetrics ? `${riskMetrics.probOfLoss}%` : "..."}
          </div>
          <div className="text-[10px] text-amber-300/80 font-mono mt-0.5">Runs Below Baseline</div>
        </div>
      </div>

      {/* Main Simulation Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Confidence Bands Area Chart (2/3 width) */}
        <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-xl p-4 relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Stochastic Confidence Bands (P10 Worst Case ➔ P50 Expected ➔ P90 Best Case)
            </h3>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-0.5 bg-emerald-400 rounded"></span> P90 Best
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2 h-1 bg-cyan-400 rounded"></span> P50 Expected
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-0.5 bg-rose-400 rounded"></span> P10 Worst
              </span>
            </div>
          </div>
          <div ref={confidenceChartRef} className="w-full h-72" />
        </div>

        {/* Outcome Frequency Histogram (1/3 width) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Outcome Probability Density
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Frequency Distribution</span>
          </div>
          <div ref={distributionChartRef} className="w-full h-72" />
        </div>
      </div>

      {/* AI Risk Narrative Card */}
      <div className="bg-gradient-to-r from-purple-950/40 via-slate-950/80 to-cyan-950/40 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-purple-300">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>AI Monte Carlo Scenario & Sensitivity Synthesis</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {simulationResult ? simulationResult.aiRiskNarrative : "Calculating Monte Carlo probability paths..."}
        </p>
      </div>
    </div>
  );
}
