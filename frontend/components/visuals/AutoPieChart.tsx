"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useFilterStore } from "@/store/useFilterStore";

interface PieDataItem {
  name: string;
  value: number;
}

interface AutoPieChartProps {
  data: PieDataItem[];
  title?: string;
  categoryColumn?: string;
  metricColumn?: string;
  loading?: boolean;
}

const PIE_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#64748b", // Slate
];

export default function AutoPieChart({
  data,
  title = "Category Distribution",
  categoryColumn,
  metricColumn,
  loading = false,
}: AutoPieChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || !data || data.length === 0 || !chartRef.current) return;

    const chart = echarts.init(chartRef.current, undefined, { renderer: "canvas" });

    const total = data.reduce((s, d) => s + d.value, 0);

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#12151e",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        textStyle: { color: "#f3f4f6", fontFamily: "Inter, sans-serif", fontSize: 12 },
        formatter: (params: any) => {
          const percent = total > 0 ? ((params.value / total) * 100).toFixed(1) : "0";
          return `<div style="padding:4px 6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color};margin-right:6px"></span>
            <strong style="color:#fff">${params.name}</strong><br/>
            <span style="color:rgba(255,255,255,0.6)">Share:</span> <strong>${percent}%</strong><br/>
            <span style="color:rgba(255,255,255,0.6)">Value:</span> <strong>${Number(params.value).toLocaleString()}</strong>
          </div>`;
        },
      },
      legend: {
        orient: "vertical",
        right: "5%",
        top: "center",
        textStyle: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter, sans-serif" },
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        formatter: (name: string) => {
          const item = data.find((d) => d.name === name);
          if (!item || total === 0) return name;
          const pct = ((item.value / total) * 100).toFixed(0);
          return `${name.length > 14 ? name.slice(0, 12) + "…" : name} (${pct}%)`;
        },
      },
      series: [
        {
          name: title,
          type: "pie",
          radius: ["40%", "72%"],
          center: ["35%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: "rgba(13,15,20,0.9)",
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 15,
              shadowColor: "rgba(99, 102, 241, 0.5)",
            },
            label: {
              show: true,
              fontSize: 12,
              fontWeight: "bold",
              color: "#ffffff",
              formatter: "{b}: {d}%",
            },
          },
          data: data,
          color: PIE_COLORS,
        },
      ],
    };

    chart.setOption(option);

    const handleChartClick = (params: any) => {
      if (params.name && categoryColumn) {
        useFilterStore.getState().toggleCategoryValue(categoryColumn, params.name);
      }
    };

    const handleLegendSelect = (params: any) => {
      if (params.name && categoryColumn) {
        useFilterStore.getState().toggleCategoryValue(categoryColumn, params.name);
      }
    };

    chart.on("click", handleChartClick);
    chart.on("legendselectchanged", handleLegendSelect);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      chart.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [data, loading, title, categoryColumn]);

  return (
    <div
      className="rounded-xl p-5 flex flex-col h-full"
      style={{
        background: "rgba(18,21,30,0.65)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            {title}
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5 font-mono">
            {categoryColumn ? `Grouped by '${categoryColumn}'` : "Percentage share breakdown"}
            {metricColumn ? ` • Metric: ${metricColumn}` : ""}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          Pie Chart
        </span>
      </div>

      <div className="flex-1 relative min-h-[220px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/30 font-mono">
            No categorical values available
          </div>
        ) : (
          <div ref={chartRef} className="w-full h-full" />
        )}
      </div>
    </div>
  );
}
