"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import * as echarts from "echarts";
import {
  GitFork,
  Sparkles,
  AlertTriangle,
  Layers,
  RefreshCw,
  Pin,
  Check,
  ChevronRight,
  ShieldAlert,
  ArrowRightLeft
} from "lucide-react";
import { apiService } from "@/services/api";
import { usePinnedChartStore } from "@/store/usePinnedChartStore";
import { useFilterStore } from "@/store/useFilterStore";

interface TreeNode {
  name: string;
  dimension: string;
  value: string;
  metric_name?: string;
  metric_value: number;
  mean_value?: number;
  impact_pct: number;
  delta_value: number;
  direction: "positive" | "negative" | "neutral";
  node_type?: string;
  record_count: number;
  is_bottleneck?: boolean;
  bottleneck_reason?: string;
  is_top_driver?: boolean;
  is_primary_root_cause_path?: boolean;
  children?: TreeNode[];
}

interface DecompositionTreeResponse {
  root: TreeNode;
  target_metric: string;
  decomposed_dimensions: string[];
  total_value: number;
  primary_root_cause_path: string[];
  summary_insight: string;
  error?: string;
}

interface DecompositionTreePanelProps {
  datasetId?: number;
}

export const DecompositionTreePanel: React.FC<DecompositionTreePanelProps> = ({ datasetId }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const [data, setData] = useState<DecompositionTreeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [targetMetric, setTargetMetric] = useState<string>("");
  const [maxDepth, setMaxDepth] = useState<number>(3);
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([]);
  const [pinned, setPinned] = useState<boolean>(false);
  const pinChart = usePinnedChartStore((state) => state.pinChart);

  // Fetch decomposition tree payload from backend
  const fetchDecompositionTree = async (metricOverride?: string) => {
    setLoading(true);
    try {
      let activeId = datasetId;
      if (!activeId) {
        const datasetsRes = await apiService.getDatasets();
        if (datasetsRes.ok) {
          const datasets = await datasetsRes.json();
          if (datasets && datasets.length > 0) {
            activeId = datasets[0].id;
          }
        }
      }

      if (!activeId) {
        setLoading(false);
        return;
      }

      if (availableMetrics.length === 0) {
        const schemaRes = await apiService.getDatasetSchema(activeId);
        if (schemaRes.ok) {
          const schema = await schemaRes.json();
          if (schema && schema.columns) {
            const numCols = schema.columns
              .filter((c: any) => c.dtype_category === "numeric" || c.role === "numeric")
              .map((c: any) => c.name);
            setAvailableMetrics(numCols);
            if (!targetMetric && schema.primary_metric) {
              setTargetMetric(schema.primary_metric);
            }
          }
        }
      }

      const activeMetric = metricOverride || targetMetric;
      const params = new URLSearchParams();
      if (activeMetric) params.append("target_metric", activeMetric);
      params.append("max_depth", maxDepth.toString());

      const res = await fetch(
        `http://localhost:8000/api/datasets/${activeId}/decomposition-tree?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        }
      );

      if (!res.ok) throw new Error("Failed to fetch decomposition tree");
      const json: DecompositionTreeResponse = await res.json();
      setData(json);
      if (json.target_metric && !targetMetric) {
        setTargetMetric(json.target_metric);
      }
    } catch (err) {
      console.error("Decomposition Tree fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecompositionTree();
  }, [datasetId, maxDepth]);

  const handleMetricChange = (metric: string) => {
    setTargetMetric(metric);
    fetchDecompositionTree(metric);
  };

  const handlePinToCanvas = () => {
    if (!data) return;
    pinChart(
      {
        type: "bar",
        title: `🌲 Root-Cause: ${data.target_metric}`,
        labels: data.primary_root_cause_path.length > 0 ? data.primary_root_cause_path : ["Root"],
        data: [data.total_value],
        insight: data.summary_insight,
      },
      `Decompose ${data.target_metric} across ${data.decomposed_dimensions.join(", ")}`
    );
    setPinned(true);
    setTimeout(() => setPinned(false), 2000);
  };

  // Render ECharts Tree
  useEffect(() => {
    if (!chartRef.current || !data || !data.root) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, "dark");
    }

    const transformNode = (node: TreeNode): any => {
      const isBottleneck = node.is_bottleneck || node.is_primary_root_cause_path;
      const isTopDriver = node.is_top_driver;

      let itemStyleColor = "#8b5cf6";
      let borderColor = "#a855f7";

      if (node.node_type === "root") {
        itemStyleColor = "#06b6d4";
        borderColor = "#22d3ee";
      } else if (isBottleneck && node.direction === "negative") {
        itemStyleColor = "#f43f5e";
        borderColor = "#fb7185";
      } else if (isTopDriver || node.direction === "positive") {
        itemStyleColor = "#10b981";
        borderColor = "#34d399";
      }

      return {
        name: node.name,
        value: node.metric_value,
        dimension: node.dimension,
        impact_pct: node.impact_pct,
        delta_value: node.delta_value,
        direction: node.direction,
        is_bottleneck: isBottleneck,
        bottleneck_reason: node.bottleneck_reason,
        itemStyle: {
          color: itemStyleColor,
          borderColor: borderColor,
          borderWidth: isBottleneck ? 3 : 1.5,
          shadowBlur: isBottleneck ? 15 : 6,
          shadowColor: itemStyleColor,
        },
        label: {
          show: true,
          position: node.children && node.children.length > 0 ? "left" : "right",
          verticalAlign: "middle",
          align: node.children && node.children.length > 0 ? "right" : "left",
          fontSize: 11,
          fontFamily: "monospace",
          color: isBottleneck ? "#fecdd3" : "#e2e8f0",
        },
        children: node.children ? node.children.map(transformNode) : [],
      };
    };

    const treeData = transformNode(data.root);

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(168, 85, 247, 0.4)",
        textStyle: { color: "#f8fafc", fontSize: 12 },
        formatter: (params: any) => {
          const d = params.data;
          const deltaStr = d.delta_value >= 0 ? `+${d.delta_value}` : `${d.delta_value}`;
          return `
            <div style="font-family: sans-serif; padding: 4px;">
              <div style="font-weight: bold; color: #c084fc; margin-bottom: 4px;">${d.name}</div>
              <div style="font-size: 11px; color: #94a3b8;">Dimension: <span style="color: #e2e8f0;">${d.dimension}</span></div>
              <div style="font-size: 11px; color: #94a3b8;">Impact Share: <span style="color: #38bdf8; font-weight: 600;">${d.impact_pct}%</span></div>
              <div style="font-size: 11px; color: #94a3b8;">Variance Delta: <span style="color: ${d.direction === "negative" ? "#f43f5e" : "#34d399"}; font-weight: 600;">${deltaStr}</span></div>
              ${d.bottleneck_reason ? `<div style="font-size: 10px; color: #f43f5e; margin-top: 4px; font-weight: 600;">⚠️ ${d.bottleneck_reason}</div>` : ""}
            </div>
          `;
        },
      },
      series: [
        {
          type: "tree",
          data: [treeData],
          top: "10%",
          left: "15%",
          bottom: "10%",
          right: "20%",
          symbolSize: (val: any, params: any) => (params.data.is_bottleneck ? 14 : 10),
          orient: "LR",
          edgeShape: "polyline",
          edgeForkPosition: "60%",
          initialTreeDepth: 3,
          lineStyle: {
            color: "rgba(168, 85, 247, 0.35)",
            width: 2,
            curveness: 0.5,
          },
          label: {
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            borderColor: "rgba(168, 85, 247, 0.2)",
            borderWidth: 1,
            borderRadius: 6,
            padding: [4, 8],
          },
          leaves: {
            label: {
              position: "right",
              verticalAlign: "middle",
              align: "left",
            },
          },
          expandAndCollapse: true,
          animationDuration: 550,
          animationEasing: "cubicOut",
        },
      ],
    };

    chartInstance.current.setOption(option, true);

    const handleTreeNodeClick = (params: any) => {
      if (params.data && params.data.dimension && params.data.name) {
        useFilterStore.getState().toggleCategoryValue(params.data.dimension, params.data.name);
      }
    };

    chartInstance.current.off("click");
    chartInstance.current.on("click", handleTreeNodeClick);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [data]);

  return (
    <div className="w-full bg-slate-950/80 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-purple-500/20 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600/30 to-indigo-600/30 border border-purple-500/30 text-purple-300 shadow-lg shadow-purple-500/20">
            <GitFork className="w-5 h-5 animate-pulse text-purple-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Autonomous Root-Cause Decomposition Tree
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> SHAP Variance
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Break down top-line drop factors across nested dimensions to isolate negative variance.
            </p>
          </div>
        </div>

        {/* Dynamic Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Target Metric Selector */}
          {availableMetrics.length > 0 && (
            <div className="flex items-center gap-1.5 bg-black/40 border border-purple-500/30 rounded-xl px-3 py-1.5 text-xs">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400 text-[11px]">Target:</span>
              <select
                value={targetMetric}
                onChange={(e) => handleMetricChange(e.target.value)}
                className="bg-transparent text-purple-200 outline-none cursor-pointer font-mono font-semibold text-xs"
              >
                {availableMetrics.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Depth Selector */}
          <div className="flex items-center gap-1.5 bg-black/40 border border-purple-500/30 rounded-xl px-3 py-1.5 text-xs">
            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400 text-[11px]">Levels:</span>
            <select
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="bg-transparent text-indigo-200 outline-none cursor-pointer font-mono font-semibold text-xs"
            >
              <option value={2} className="bg-slate-900 text-white">2 Levels</option>
              <option value={3} className="bg-slate-900 text-white">3 Levels</option>
              <option value={4} className="bg-slate-900 text-white">4 Levels</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchDecompositionTree()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-purple-500/30 text-purple-300 transition-all cursor-pointer hover:scale-105"
            title="Re-calculate Decomposition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
          </button>

          {/* Pin to Dashboard Button */}
          <button
            onClick={handlePinToCanvas}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
              pinned
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                : "bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/40 text-purple-200 hover:border-purple-400 hover:scale-105"
            }`}
          >
            {pinned ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Pin className="w-3.5 h-3.5 text-purple-400" />}
            {pinned ? "Pinned!" : "Pin to Dashboard"}
          </button>
        </div>
      </div>

      {/* Summary Insight Banner */}
      {data && data.summary_insight && (
        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-rose-950/40 border border-purple-500/30 flex items-start gap-2.5 relative z-10 shadow-inner">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div className="text-xs text-purple-200 leading-relaxed font-sans">
            <span className="font-semibold text-white">AI Synthesis:</span> {data.summary_insight}
          </div>
        </div>
      )}

      {/* Bottleneck Path Chain Pills */}
      {data && data.primary_root_cause_path && data.primary_root_cause_path.length > 0 && (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 relative z-10 scrollbar-none">
          <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-400 animate-pulse" /> Critical Drop Path:
          </span>
          {data.primary_root_cause_path.map((step, idx) => (
            <React.Fragment key={idx}>
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-[11px] font-mono whitespace-nowrap shadow-sm">
                {step}
              </span>
              {idx < data.primary_root_cause_path.length - 1 && (
                <ChevronRight className="w-3 h-3 text-rose-500/60 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ECharts Interactive Tree Container */}
      <div className="mt-4 h-[440px] w-full relative z-10">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-purple-300 font-mono animate-pulse">
              Calculating SHAP Variance & Building Root Cause Tree...
            </p>
          </div>
        ) : data && data.root ? (
          <div ref={chartRef} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
            No decomposition data available for selected metric.
          </div>
        )}
      </div>
    </div>
  );
};

export default DecompositionTreePanel;
