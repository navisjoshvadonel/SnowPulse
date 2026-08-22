"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useFilterStore } from "@/store/useFilterStore";

interface BarDataItem {
  name: string;
  value: number;
}

interface AutoBarChartProps {
  data: BarDataItem[];
  title?: string;
  categoryColumn?: string;
  metricColumn?: string;
  horizontal?: boolean;
  loading?: boolean;
}

export default function AutoBarChart({
  data,
  title = "Ranked Category Comparison",
  categoryColumn,
  metricColumn,
  horizontal = false,
  loading = false,
}: AutoBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || !data || data.length === 0 || !chartRef.current) return;

    const chart = echarts.init(chartRef.current, undefined, { renderer: "canvas" });

    const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 10);
    const categories = sorted.map((d) => d.name);
    const values = sorted.map((d) => d.value);

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      grid: {
        top: 24,
        right: 20,
        bottom: horizontal ? 24 : 40,
        left: horizontal ? 100 : 50,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#12151e",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        textStyle: { color: "#f3f4f6", fontFamily: "Inter, sans-serif", fontSize: 12 },
        formatter: (params: any) => {
          const item = params[0];
          return `<div style="padding:4px 6px">
            <strong style="color:#fff">${item.name}</strong><br/>
            <span style="color:rgba(255,255,255,0.6)">Value:</span> <strong>${Number(item.value).toLocaleString()}</strong>
          </div>`;
        },
      },
      xAxis: horizontal
        ? {
            type: "value",
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
            axisLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10 },
          }
        : {
            type: "category",
            data: categories,
            axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
            axisTick: { show: false },
            axisLabel: {
              color: "rgba(255,255,255,0.5)",
              fontSize: 10,
              rotate: categories.length > 5 ? 25 : 0,
              formatter: (val: string) => (val.length > 12 ? val.slice(0, 10) + "…" : val),
            },
          },
      yAxis: horizontal
        ? {
            type: "category",
            data: [...categories].reverse(),
            axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
            axisTick: { show: false },
            axisLabel: {
              color: "rgba(255,255,255,0.6)",
              fontSize: 11,
              formatter: (val: string) => (val.length > 14 ? val.slice(0, 12) + "…" : val),
            },
          }
        : {
            type: "value",
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
            axisLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10 },
          },
      series: [
        {
          name: metricColumn || "Value",
          type: "bar",
          data: horizontal ? [...values].reverse() : values,
          barWidth: horizontal ? "55%" : "40%",
          itemStyle: {
            borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(
              horizontal ? 0 : 0,
              horizontal ? 0 : 0,
              horizontal ? 1 : 0,
              horizontal ? 0 : 1,
              [
                { offset: 0, color: "#4f46e5" },
                { offset: 1, color: "#06b6d4" },
              ]
            ),
          },
          emphasis: {
            itemStyle: {
              color: new echarts.graphic.LinearGradient(
                horizontal ? 0 : 0,
                horizontal ? 0 : 0,
                horizontal ? 1 : 0,
                horizontal ? 0 : 1,
                [
                  { offset: 0, color: "#6366f1" },
                  { offset: 1, color: "#22d3ee" },
                ]
              ),
            },
          },
        },
      ],
    };

    chart.setOption(option);

    const handleChartClick = (params: any) => {
      if (params.name) {
        useFilterStore.getState().setSelectedCategory(params.name);
        if (categoryColumn) {
          useFilterStore.getState().toggleCategoryValue(categoryColumn, params.name);
        }
      }
    };

    chart.on("click", handleChartClick);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      chart.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [data, loading, title, horizontal, metricColumn, categoryColumn]);

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
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            {title}
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5 font-mono">
            {categoryColumn ? `Ranked by '${categoryColumn}'` : "Categorical volume comparison"}
            {metricColumn ? ` • Metric: ${metricColumn}` : ""}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
          Bar Chart
        </span>
      </div>

      <div className="flex-1 relative min-h-[220px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/30 font-mono">
            No data available for bar chart
          </div>
        ) : (
          <div ref={chartRef} className="w-full h-full" />
        )}
      </div>
    </div>
  );
}
