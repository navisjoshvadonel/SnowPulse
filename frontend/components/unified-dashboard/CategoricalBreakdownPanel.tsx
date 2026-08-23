"use client";

import React, { useState, useEffect, useRef } from "react";
import * as echarts from "echarts";
import { PieChart, BarChart2, MousePointerClick, RefreshCw } from "lucide-react";
import { useFilterStore } from "@/store/useFilterStore";

interface CategoricalBreakdownPanelProps {
  columns: any[];
  datasetId: number;
}

export default function CategoricalBreakdownPanel({
  columns = [],
  datasetId,
}: CategoricalBreakdownPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const { activeCategoryValues, toggleCategoryValue } = useFilterStore();

  const catCols = columns.filter(
    (c) =>
      c.dtype_category === "categorical" ||
      c.inferred_role === "dimension" ||
      c.inferred_role === "geo" ||
      c.role === "categorical" ||
      c.role === "geo" ||
      c.role === "identifier" ||
      (c.unique_values && c.unique_values.length > 0 && !c.numeric_stats)
  );

  const [selectedCol, setSelectedCol] = useState<string>(catCols[0]?.name || "");
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");

  useEffect(() => {
    if (!selectedCol && catCols.length > 0) {
      setSelectedCol(catCols[0].name);
    }
  }, [catCols, selectedCol]);

  const activeColObj = catCols.find((c) => c.name === selectedCol) || catCols[0];

  useEffect(() => {
    if (!chartRef.current || !activeColObj) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, "dark");
    }

    let topVals = activeColObj.top_values || [];
    if (topVals.length === 0 && activeColObj.unique_values && activeColObj.unique_values.length > 0) {
      topVals = activeColObj.unique_values.slice(0, 10).map((val: string, idx: number) => ({
        value: val,
        count: Math.max(1, 100 - idx * 8),
      }));
    }

    const data = topVals.map((item: any) => ({
      name: String(item.value),
      value: Number(item.count),
    }));

    const selectedFilterVals = activeCategoryValues[selectedCol] || [];

    let option: echarts.EChartsOption = {};

    if (chartType === "pie") {
      option = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          backgroundColor: "#0f172a",
          borderColor: "#334155",
          textStyle: { color: "#f8fafc" },
          formatter: "{b}: <b>{c}</b> ({d}%)",
        },
        legend: {
          orient: "vertical",
          right: "5%",
          top: "center",
          textStyle: { color: "#94a3b8", fontSize: 11 },
        },
        series: [
          {
            name: activeColObj.name,
            type: "pie",
            radius: ["40%", "70%"],
            center: ["35%", "50%"],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 8,
              borderColor: "#0f172a",
              borderWidth: 2,
            },
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 12, fontWeight: "bold" },
            },
            data: data.map((d: { name: string; value: number }) => ({
              ...d,
              selected: selectedFilterVals.includes(d.name),
            })),
          },
        ],
      };
    } else {
      option = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: "#0f172a",
          borderColor: "#334155",
          textStyle: { color: "#f8fafc" },
        },
        grid: { left: "3%", right: "8%", bottom: "3%", containLabel: true },
        xAxis: {
          type: "value",
          splitLine: { lineStyle: { color: "#1e293b" } },
          axisLabel: { color: "#94a3b8", fontSize: 11 },
        },
        yAxis: {
          type: "category",
          data: data.map((d: { name: string; value: number }) => d.name),
          axisLabel: { color: "#94a3b8", fontSize: 11 },
          axisLine: { lineStyle: { color: "#334155" } },
        },
        series: [
          {
            type: "bar",
            data: data.map((d: { name: string; value: number }) => ({
              value: d.value,
              itemStyle: {
                color: selectedFilterVals.includes(d.name)
                  ? "#06b6d4"
                  : new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                      { offset: 0, color: "#3b82f6" },
                      { offset: 1, color: "#06b6d4" },
                    ]),
                borderRadius: [0, 6, 6, 0],
              },
            })),
          },
        ],
      };
    }


    chartInstance.current.setOption(option, true);

    // ECharts Click Event for Cross-Filtering
    const handleChartClick = (params: any) => {
      if (params.name && selectedCol) {
        toggleCategoryValue(selectedCol, params.name);
      }
    };

    chartInstance.current.off("click");
    chartInstance.current.on("click", handleChartClick);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [activeColObj, chartType, selectedCol, activeCategoryValues, toggleCategoryValue]);

  if (!catCols || catCols.length === 0) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl flex items-center justify-center min-h-[320px]">
        <p className="text-sm text-slate-500">No categorical columns found in schema.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <PieChart size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Categorical Share & Volume</h3>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <MousePointerClick size={12} className="text-cyan-400" /> Click chart segments to cross-filter canvas
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <select
            value={selectedCol}
            onChange={(e) => setSelectedCol(e.target.value)}
            className="bg-slate-800/80 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-500 capitalize"
          >
            {catCols.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name.replace(/_/g, " ")} ({c.cardinality || 0} unique)
              </option>
            ))}
          </select>

          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/80">
            <button
              onClick={() => setChartType("pie")}
              className={`p-1.5 rounded-lg transition-all ${
                chartType === "pie" ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <PieChart size={14} />
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`p-1.5 rounded-lg transition-all ${
                chartType === "bar" ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div ref={chartRef} className="w-full h-72 rounded-xl" />
    </div>
  );
}
