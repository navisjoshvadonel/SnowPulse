"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface DonutItem {
  name: string;
  value: number;
}

interface DonutChartProps {
  data: DonutItem[] | null;
  loading: boolean;
  title?: string;
}

// Segment colors matching reference screenshot: blue, green, orange/yellow
const SEGMENT_COLORS = ["#5063f4", "#10b981", "#f59e0b", "#8b5cf6", "#6b7280"];

// Percentage distribution helper
function calcPercents(data: DonutItem[]): number[] {
  const total = data.reduce((s, d) => s + d.value, 0);
  return data.map((d) => Math.round((d.value / total) * 100));
}

// Compact number formatter
function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function DonutChart({ data, loading, title = "Top segment shares" }: DonutChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || !data || data.length === 0 || !chartRef.current) return;

    const chart = echarts.init(chartRef.current, undefined, { renderer: "canvas" });

    const total = data.reduce((s, d) => s + d.value, 0);
    const totalLabel = compactNum(total);

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#12151e",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        textStyle: { color: "#f3f4f6", fontFamily: "Inter, sans-serif", fontSize: 11 },
        formatter: (params: any) => {
          return `<div style="padding:2px 4px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color};margin-right:6px"></span>
            <strong>${params.name}</strong>: ${params.percent}%
          </div>`;
        },
      },
      legend: { show: false },
      series: [
        {
          name: title,
          type: "pie",
          radius: ["62%", "82%"],
          center: ["50%", "48%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 5,
            borderColor: "rgba(13,15,20,0.95)",
            borderWidth: 3,
          },
          label: {
            show: true,
            position: "center",
            formatter: () => `{val|${totalLabel}}\n{sub|Total Users}`,
            rich: {
              val: {
                fontSize: 22,
                fontWeight: "bold",
                color: "#ffffff",
                fontFamily: "Inter, sans-serif",
                lineHeight: 28,
              },
              sub: {
                fontSize: 10,
                color: "rgba(255,255,255,0.35)",
                fontFamily: "Inter, sans-serif",
                lineHeight: 16,
              },
            },
          },
          emphasis: {
            label: { show: true },
            itemStyle: {
              shadowBlur: 12,
              shadowColor: "rgba(80,99,244,0.4)",
            },
          },
          labelLine: { show: false },
          data: data.slice(0, 5),
          color: SEGMENT_COLORS,
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      chart.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [data, loading, title]);

  const percents = data && data.length > 0 ? calcPercents(data) : [];

  return (
    <div
      className="rounded-xl p-5 flex flex-col"
      style={{
        background: "rgba(18,21,30,0.65)",
        border: "1px solid rgba(255,255,255,0.06)",
        height: "100%",
      }}
    >
      {/* Title */}
      <p className="text-[14px] font-semibold text-white mb-3 flex-shrink-0">{title}</p>

      {/* Donut chart */}
      <div className="flex-1 relative min-h-0" style={{ minHeight: 200 }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/25 font-mono">
            No segments found
          </div>
        ) : (
          <div ref={chartRef} className="w-full h-full" />
        )}
      </div>

      {/* Legend list — like reference screenshot */}
      {!loading && data && data.length > 0 && (
        <div className="space-y-2 mt-4 flex-shrink-0">
          {data.slice(0, 5).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SEGMENT_COLORS[idx % SEGMENT_COLORS.length] }}
                />
                <span className="text-[12px] text-white/60 truncate">{item.name}</span>
              </div>
              <span className="text-[12px] font-semibold text-white/80 ml-3 flex-shrink-0">
                {percents[idx]}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
