"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface AnomalyBarChartProps {
  anomalies: any[] | null;
  loading: boolean;
}

export default function AnomalyBarChart({ anomalies, loading }: AnomalyBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (loading || !chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }

    const regions = ["North America", "Europe", "APAC", "LATAM", "MEA"];
    const highCounts: number[] = [];
    const mediumCounts: number[] = [];

    // Initialize mapping
    const counts: Record<string, { high: number; medium: number }> = {};
    regions.forEach((r) => {
      counts[r] = { high: 0, medium: 0 };
    });

    if (anomalies && anomalies.length > 0) {
      anomalies.forEach((a: any) => {
        let region = a.region || "North America";
        // Handle variations in region names
        if (region === "Global") region = "North America";
        
        const isHigh = a.severity === "High" || a.severity === "Critical" || (a.severity || "").toLowerCase().includes("critical") || (a.severity || "").toLowerCase().includes("high");
        const severityKey = isHigh ? "high" : "medium";
        
        if (!counts[region]) {
          counts[region] = { high: 0, medium: 0 };
        }
        counts[region][severityKey]++;
      });
    } else {
      // Visual placeholder data
      counts["North America"] = { high: 1, medium: 1 };
      counts["Europe"] = { high: 0, medium: 0 };
      counts["APAC"] = { high: 1, medium: 0 };
      counts["LATAM"] = { high: 1, medium: 0 };
      counts["MEA"] = { high: 0, medium: 1 };
    }

    regions.forEach((r) => {
      highCounts.push(counts[r].high);
      mediumCounts.push(counts[r].medium);
    });

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
          let html = `<div style="padding:4px 2px"><p style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:6px;font-family:'JetBrains Mono',monospace">${params[0].name}</p>`;
          params.forEach((p: any) => {
            if (p.value > 0) {
              html += `<div style="display:flex;align-items:center;gap:8px;margin-top:3px">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                <span style="color:rgba(255,255,255,0.7);font-size:11px">${p.seriesName}</span>
                <span style="color:#fff;font-weight:bold;font-size:11px;margin-left:auto">${p.value}</span>
              </div>`;
            }
          });
          html += `</div>`;
          return html;
        },
      },
      legend: {
        show: true,
        top: 0,
        right: 0,
        textStyle: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "Inter,sans-serif" },
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        data: ["Critical Alert", "Warning Alert"],
      },
      grid: {
        top: "15%",
        left: "3%",
        right: "6%",
        bottom: "5%",
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
        data: regions,
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
          name: "Critical Alert",
          type: "bar",
          stack: "total",
          barMaxWidth: 16,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(239, 68, 68, 0.4)" },
              { offset: 1, color: "rgba(239, 68, 68, 0.85)" },
            ]),
          },
          label: {
            show: true,
            position: "insideRight",
            color: "#fff",
            fontSize: 9,
            formatter: (params: any) => (params.value > 0 ? params.value : ""),
          },
          data: highCounts,
        },
        {
          name: "Warning Alert",
          type: "bar",
          stack: "total",
          barMaxWidth: 16,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(245, 158, 11, 0.4)" },
              { offset: 1, color: "rgba(245, 158, 11, 0.85)" },
            ]),
          },
          label: {
            show: true,
            position: "insideRight",
            color: "#fff",
            fontSize: 9,
            formatter: (params: any) => (params.value > 0 ? params.value : ""),
          },
          data: mediumCounts,
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
  }, [anomalies, loading]);

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
          <h2 className="text-[14px] font-semibold text-white">Anomaly Alerts Distribution</h2>
          <p className="text-[11px] text-white/35 mt-0.5 font-sans">Active critical and warning events by region</p>
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
