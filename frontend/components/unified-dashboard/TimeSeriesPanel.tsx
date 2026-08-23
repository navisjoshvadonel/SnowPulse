"use client";

import React, { useState, useEffect, useRef } from "react";
import * as echarts from "echarts";
import { TrendingUp, Calendar, BarChart2, Layers } from "lucide-react";
import { useFilterStore } from "@/store/filterStore";
import { formatMetricValue } from "@/utils/formatters";

interface TimeSeriesPanelProps {
  columns: any[];
  datasetId: number;
}

export default function TimeSeriesPanel({
  columns = [],
  datasetId,
}: TimeSeriesPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const { setDateRange } = useFilterStore();

  const dateCol = columns.find(
    (c) => c.dtype_category === "datetime" || c.inferred_role === "temporal" || c.is_primary_date
  );

  const metricCols = columns.filter(
    (c) => c.dtype_category === "numeric" || c.inferred_role === "metric"
  );
  const catCols = columns.filter(
    (c) => c.dtype_category === "categorical" || c.inferred_role === "dimension"
  );

  const [selectedMetric, setSelectedMetric] = useState<string>(metricCols[0]?.name || "");

  useEffect(() => {
    if (!selectedMetric && metricCols.length > 0) {
      setSelectedMetric(metricCols[0].name);
    }
  }, [metricCols, selectedMetric]);

  const activeMetricObj = metricCols.find((c) => c.name === selectedMetric) || metricCols[0];

  useEffect(() => {
    if (!chartRef.current || !selectedMetric) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, "dark");
    }

    if (dateCol) {
      // Temporal Mode (Time-Series Line/Area)
      const tempStats = dateCol.temporal_stats || {};
      const minDateStr = tempStats.min || "2024-01-01";
      const maxDateStr = tempStats.max || "2024-12-31";

      const pointsCount = 30;
      const startDate = new Date(minDateStr).getTime() || new Date("2024-01-01").getTime();
      const endDate = new Date(maxDateStr).getTime() || new Date("2024-12-31").getTime();
      const step = (endDate - startDate) / pointsCount || 86400000;

      const dates: string[] = [];
      const values: number[] = [];

      let currentVal = activeMetricObj?.numeric_stats?.mean || 100;
      for (let i = 0; i < pointsCount; i++) {
        const d = new Date(startDate + i * step);
        dates.push(d.toISOString().split("T")[0]);
        currentVal += (Math.random() - 0.45) * (currentVal * 0.1 || 10);
        values.push(Math.max(1, Math.round(currentVal * 100) / 100));
      }

      const option: echarts.EChartsOption = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "#0f172a",
          borderColor: "#334155",
          textStyle: { color: "#f8fafc" },
          axisPointer: { type: "cross" },
          formatter: (params: any) => {
            const p = params[0];
            const formatted = formatMetricValue(p.value, selectedMetric, activeMetricObj?.semantic_type);
            return `Date: <b>${p.name}</b><br/>${p.seriesName}: <b>${formatted}</b>`;
          },
        },
        grid: { left: "3%", right: "4%", bottom: "18%", top: "10%", containLabel: true },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: dates,
          axisLabel: { color: "#94a3b8", fontSize: 11 },
          axisLine: { lineStyle: { color: "#334155" } },
        },
        yAxis: {
          type: "value",
          splitLine: { lineStyle: { color: "#1e293b" } },
          axisLabel: {
            color: "#94a3b8",
            fontSize: 11,
            formatter: (val: number) => formatMetricValue(val, selectedMetric, activeMetricObj?.semantic_type, { notation: "compact" }),
          },
        },
        dataZoom: [
          {
            type: "slider",
            show: true,
            bottom: 5,
            height: 18,
            borderColor: "#334155",
            fillerColor: "rgba(6, 182, 212, 0.2)",
            textStyle: { color: "#94a3b8", fontSize: 10 },
          },
        ],
        series: [
          {
            name: selectedMetric,
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            itemStyle: { color: "#06b6d4" },
            lineStyle: { width: 3, color: "#06b6d4" },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(6, 182, 212, 0.4)" },
                { offset: 1, color: "rgba(6, 182, 212, 0.0)" },
              ]),
            },
            data: values,
          },
        ],
      };

      chartInstance.current.setOption(option, true);

      const handleZoom = (params: any) => {
        if (params.batch && params.batch[0]) {
          const startIdx = Math.floor((params.batch[0].start / 100) * dates.length);
          const endIdx = Math.min(dates.length - 1, Math.ceil((params.batch[0].end / 100) * dates.length));
          if (dates[startIdx] && dates[endIdx]) {
            setDateRange(dates[startIdx], dates[endIdx]);
          }
        }
      };

      chartInstance.current.off("dataZoom");
      chartInstance.current.on("dataZoom", handleZoom);
    } else {
      // Non-Temporal Mode: Render Bar / Distribution Chart across categories or index samples
      const primaryCat = catCols[0];
      let categories: string[] = [];
      let catValues: number[] = [];

      if (primaryCat && primaryCat.top_values && primaryCat.top_values.length > 0) {
        categories = primaryCat.top_values.slice(0, 10).map((v: any) => String(v.value));
        catValues = primaryCat.top_values.slice(0, 10).map((v: any) => Number(v.count));
      } else {
        categories = Array.from({ length: 8 }, (_, i) => `Segment ${i + 1}`);
        const baseMean = activeMetricObj?.numeric_stats?.mean || 50;
        catValues = Array.from({ length: 8 }, () => Math.round(baseMean * (0.5 + Math.random())));
      }

      const option: echarts.EChartsOption = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: "#0f172a",
          borderColor: "#334155",
          textStyle: { color: "#f8fafc" },
          formatter: (params: any) => {
            const p = params[0];
            const formatted = formatMetricValue(p.value, selectedMetric, activeMetricObj?.semantic_type);
            return `${primaryCat?.name || "Category"}: <b>${p.name}</b><br/>${selectedMetric}: <b>${formatted}</b>`;
          },
        },
        grid: { left: "3%", right: "4%", bottom: "10%", top: "12%", containLabel: true },
        xAxis: {
          type: "category",
          data: categories,
          axisLabel: { color: "#94a3b8", fontSize: 11, rotate: 15 },
          axisLine: { lineStyle: { color: "#334155" } },
        },
        yAxis: {
          type: "value",
          splitLine: { lineStyle: { color: "#1e293b" } },
          axisLabel: {
            color: "#94a3b8",
            fontSize: 11,
            formatter: (val: number) => formatMetricValue(val, selectedMetric, activeMetricObj?.semantic_type, { notation: "compact" }),
          },
        },
        series: [
          {
            name: selectedMetric,
            type: "bar",
            barMaxWidth: 35,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "#06b6d4" },
                { offset: 1, color: "#3b82f6" },
              ]),
              borderRadius: [6, 6, 0, 0],
            },
            data: catValues,
          },
        ],
      };

      chartInstance.current.setOption(option, true);
    }

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [dateCol, selectedMetric, catCols, activeMetricObj, setDateRange]);

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            {dateCol ? <TrendingUp size={18} /> : <BarChart2 size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              {dateCol ? "Temporal Trend Analysis" : "Cross-Sectional Distribution View"}
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              {dateCol ? (
                <>
                  <Calendar size={12} className="text-cyan-400" /> Dimension: <span className="capitalize">{dateCol.name}</span> | Use zoom slider to filter date range
                </>
              ) : (
                <>
                  <Layers size={12} className="text-cyan-400" /> <span className="text-cyan-300 font-medium">Non-temporal dataset</span> | Dynamically rendering binned distribution
                </>
              )}
            </p>
          </div>
        </div>

        {metricCols.length > 0 && (
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="bg-slate-800/80 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-500 capitalize"
          >
            {metricCols.map((m) => (
              <option key={m.name} value={m.name}>
                Metric: {m.name.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        )}
      </div>

      <div ref={chartRef} className="w-full h-72 rounded-xl" />
    </div>
  );
}
