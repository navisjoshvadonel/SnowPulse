"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface ColumnDef {
  name: string;
  role: string;
  null_count?: number;
}

interface DatasetSchema {
  row_count: number;
  column_count: number;
  columns: ColumnDef[];
}

interface DatasetProfileChartProps {
  schema: DatasetSchema | null;
  loading: boolean;
}

export default function DatasetProfileChart({ schema, loading }: DatasetProfileChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (loading || !chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }

    // Role mapping & counts
    const roleCounts: Record<string, number> = {
      "Metric / Target": 0,
      "Categorical": 0,
      "Geographic": 0,
      "Temporal / Date": 0,
      "Numeric Feature": 0,
    };

    if (schema && schema.columns) {
      schema.columns.forEach((col) => {
        const role = (col.role || "").toLowerCase();
        if (role === "metric") {
          roleCounts["Metric / Target"]++;
        } else if (role === "category" || role === "categorical") {
          roleCounts["Categorical"]++;
        } else if (role === "geo") {
          roleCounts["Geographic"]++;
        } else if (role === "date") {
          roleCounts["Temporal / Date"]++;
        } else {
          roleCounts["Numeric Feature"]++;
        }
      });
    } else {
      // Mock / Default fallback
      roleCounts["Metric / Target"] = 3;
      roleCounts["Categorical"] = 2;
      roleCounts["Geographic"] = 2;
      roleCounts["Temporal / Date"] = 1;
      roleCounts["Numeric Feature"] = 4;
    }

    const categories = Object.keys(roleCounts);
    const dataValues = categories.map((cat) => roleCounts[cat]);

    const chart = echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    chartInstance.current = chart;

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#12151e",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        textStyle: { color: "#f3f4f6", fontFamily: "Inter, sans-serif", fontSize: 11 },
        formatter: (params: any) => {
          const p = params[0];
          return `<div style="padding:2px 4px">
            <strong style="color:#fff">${p.name}</strong>: ${p.value} column${p.value > 1 ? "s" : ""}
          </div>`;
        },
      },
      grid: {
        top: "10%",
        left: "3%",
        right: "8%",
        bottom: "8%",
        containLabel: true,
      },
      xAxis: {
        type: "value",
        splitLine: {
          lineStyle: { color: "rgba(255,255,255,0.04)", type: "dashed" },
        },
        axisLabel: {
          color: "rgba(255,255,255,0.3)",
          fontFamily: "Inter, sans-serif",
          fontSize: 10,
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
        axisLabel: {
          color: "rgba(255,255,255,0.5)",
          fontFamily: "Inter, sans-serif",
          fontSize: 10,
        },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Columns",
          type: "bar",
          barMaxWidth: 16,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: (params: any) => {
              // Custom colors based on column role category
              const colors = [
                new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: "rgba(139, 92, 246, 0.4)" }, // Purple
                  { offset: 1, color: "rgba(139, 92, 246, 0.85)" },
                ]),
                new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: "rgba(80, 99, 244, 0.4)" }, // Blue
                  { offset: 1, color: "rgba(80, 99, 244, 0.85)" },
                ]),
                new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: "rgba(16, 185, 129, 0.4)" }, // Green
                  { offset: 1, color: "rgba(16, 185, 129, 0.85)" },
                ]),
                new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: "rgba(245, 158, 11, 0.4)" }, // Orange
                  { offset: 1, color: "rgba(245, 158, 11, 0.85)" },
                ]),
                new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: "rgba(107, 114, 128, 0.4)" }, // Grey
                  { offset: 1, color: "rgba(107, 114, 128, 0.85)" },
                ]),
              ];
              return colors[params.dataIndex % colors.length];
            },
          },
          label: {
            show: true,
            position: "right",
            color: "rgba(255,255,255,0.7)",
            fontSize: 10,
            fontFamily: "JetBrains Mono, monospace",
            formatter: (params: any) => (params.value > 0 ? `${params.value}` : ""),
          },
          data: dataValues,
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      chart.dispose();
      chartInstance.current = null;
      window.removeEventListener("resize", handleResize);
    };
  }, [schema, loading]);

  const rowCountFormatted = schema?.row_count ? new Intl.NumberFormat().format(schema.row_count) : "0";
  const colCountFormatted = schema?.column_count ? String(schema.column_count) : "0";

  return (
    <div
      className="rounded-xl p-5 flex flex-col"
      style={{
        background: "rgba(18,21,30,0.65)",
        border: "1px solid rgba(255,255,255,0.06)",
        height: "100%",
        minHeight: 280,
      }}
    >
      <div className="flex items-start justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-[14px] font-semibold text-white">Dataset Profile Index</h2>
          <p className="text-[11px] text-white/35 mt-0.5 font-sans">
            Column roles & types for current dataset schema
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono text-brand-primary block uppercase tracking-wider">Shape</span>
          <span className="text-[12px] font-bold text-white font-mono">
            {rowCountFormatted} × {colCountFormatted}
          </span>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div ref={chartRef} className="w-full h-full" />
        )}
      </div>
    </div>
  );
}
