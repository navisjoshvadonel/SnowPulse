"use client";

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";

interface TrendData {
  dates: string[];
  values: number[];
  moving_average: number[];
  metric: string;
}

interface TrendVisualsProps {
  trends: TrendData | null;
  aiTrendNote: string | null;
  loading: boolean;
}

export default function TrendVisuals({ trends, aiTrendNote, loading }: TrendVisualsProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [timeFilter, setTimeFilter] = useState<"all" | "90" | "30">("all");

  useEffect(() => {
    if (loading || !trends || !chartRef.current) return;

    // Dispose previous instance
    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }

    let dates = [...trends.dates];
    let values = [...trends.values];
    let movingAvg = [...trends.moving_average];

    if (timeFilter === "90") {
      dates = dates.slice(-90);
      values = values.slice(-90);
      movingAvg = movingAvg.slice(-90);
    } else if (timeFilter === "30") {
      dates = dates.slice(-30);
      values = values.slice(-30);
      movingAvg = movingAvg.slice(-30);
    }

    const formattedDates = dates.map((d) => {
      try {
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return d.split(" ")[0] || d;
        return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } catch {
        return d;
      }
    });

    const isCurrency = ["revenue", "sales", "price", "amount"].some((k) =>
      (trends.metric || "").toLowerCase().includes(k)
    );

    const chart = echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    chartInstance.current = chart;

    // Use dual-series like the reference: Projected Revenue (blue) + Actual Intake (green)
    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#12151e",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        textStyle: { color: "#f3f4f6", fontFamily: "Inter, sans-serif", fontSize: 12 },
        formatter: (params: any) => {
          let html = `<div style="padding:4px 2px"><p style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:4px;font-family:'JetBrains Mono',monospace">${params[0].name}</p>`;
          params.forEach((p: any) => {
            const val = isCurrency
              ? new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(p.value)
              : new Intl.NumberFormat("en-US").format(p.value);
            html += `<div style="display:flex;align-items:center;gap:8px;margin-top:2px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
              <span style="color:rgba(255,255,255,0.7);font-size:11px">${p.seriesName}</span>
              <span style="color:#fff;font-weight:bold;font-size:11px;margin-left:auto">${val}</span>
            </div>`;
          });
          html += `</div>`;
          return html;
        },
      },
      legend: {
        show: true,
        bottom: 0,
        textStyle: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "Inter,sans-serif" },
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        data: ["Projected Revenue", "Actual Intake"],
      },
      grid: {
        top: "8%",
        left: "1%",
        right: "1%",
        bottom: "12%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: formattedDates,
        boundaryGap: chartType === "bar",
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
        axisLabel: {
          color: "rgba(255,255,255,0.3)",
          fontFamily: "Inter, sans-serif",
          fontSize: 10,
          margin: 10,
          interval: Math.max(1, Math.floor(dates.length / 8)),
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        splitLine: {
          lineStyle: { color: "rgba(255,255,255,0.04)", type: "dashed" },
        },
        axisLabel: {
          color: "rgba(255,255,255,0.3)",
          fontFamily: "Inter, sans-serif",
          fontSize: 10,
          formatter: (val: number) => {
            if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
            if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
            return String(val);
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      dataZoom: [{ type: "inside", start: 0, end: 100 }],
      series: [
        {
          name: "Projected Revenue",
          type: chartType === "area" ? "line" : "bar",
          data: movingAvg,
          smooth: 0.35,
          barMaxWidth: 20,
          itemStyle: { color: "#5063f4" },
          areaStyle:
            chartType === "area"
              ? {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: "rgba(80,99,244,0.35)" },
                    { offset: 1, color: "rgba(80,99,244,0.00)" },
                  ]),
                }
              : undefined,
          lineStyle: { width: 2, color: "#5063f4" },
          showSymbol: false,
        },
        {
          name: "Actual Intake",
          type: chartType === "area" ? "line" : "bar",
          data: values,
          smooth: 0.35,
          barMaxWidth: 20,
          itemStyle: { color: "#10b981" },
          areaStyle:
            chartType === "area"
              ? {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: "rgba(16,185,129,0.25)" },
                    { offset: 1, color: "rgba(16,185,129,0.00)" },
                  ]),
                }
              : undefined,
          lineStyle: { width: 2, color: "#10b981" },
          showSymbol: false,
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
  }, [trends, chartType, timeFilter, loading]);

  return (
    <div
      className="rounded-xl p-5 flex flex-col"
      style={{
        background: "rgba(18,21,30,0.65)",
        border: "1px solid rgba(255,255,255,0.06)",
        height: 420,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-shrink-0 mb-4">
        <div>
          <h2 className="text-[14px] font-semibold text-white">Performance Analytics</h2>
          <p className="text-[11px] text-white/35 mt-0.5">Timeline view of target business performance</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Chart type toggle */}
          <div
            className="flex p-0.5 rounded-lg gap-0.5"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {(["area", "bar"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-2.5 py-1 text-[11px] rounded-md transition-all font-medium cursor-pointer ${
                  chartType === type
                    ? "bg-brand-surface text-white"
                    : "text-white/35 hover:text-white/70"
                }`}
              >
                {type === "area" ? "Line" : "Bar"}
              </button>
            ))}
          </div>

          {/* Time filter */}
          <div
            className="flex p-0.5 rounded-lg gap-0.5"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {(["all", "90", "30"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-2 py-1 text-[11px] rounded-md font-mono transition-all cursor-pointer ${
                  timeFilter === filter
                    ? "bg-brand-surface text-brand-primary"
                    : "text-white/35 hover:text-white/70"
                }`}
              >
                {filter === "all" ? "All" : `${filter}D`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative min-h-0">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
          </div>
        ) : !trends ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/25 font-mono">
            No trend data available
          </div>
        ) : (
          <div ref={chartRef} className="w-full h-full" />
        )}
      </div>

      {/* AI Note */}
      {aiTrendNote && !loading && (
        <div
          className="mt-3 px-3 py-2 rounded-lg text-[11px] text-white/50 leading-relaxed flex-shrink-0"
          style={{ background: "rgba(80,99,244,0.06)", border: "1px solid rgba(80,99,244,0.12)" }}
        >
          <span className="text-brand-primary font-semibold mr-1.5">↗ Trend:</span>
          {aiTrendNote}
        </div>
      )}
    </div>
  );
}
