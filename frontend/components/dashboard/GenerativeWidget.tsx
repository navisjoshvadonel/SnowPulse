"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Table, BarChart3, PieChart, Activity } from "lucide-react";

export interface GenerativeWidgetProps {
  payload: {
    columns: string[];
    data: any[];
    total_rows: number;
    title?: string;
  };
  type?: "auto" | "table" | "bar" | "line" | "pie";
}

export default function GenerativeWidget({ payload, type = "auto" }: GenerativeWidgetProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const { columns, data, title } = payload;

  // Determine categorical and numeric columns
  const numericCols = columns.filter((c) => typeof data[0]?.[c] === "number");
  const catCols = columns.filter((c) => typeof data[0]?.[c] === "string");

  // Heuristic to decide rendering type if auto
  let renderType = type;
  if (renderType === "auto") {
    if (data.length === 0) renderType = "table";
    else if (catCols.length === 1 && numericCols.length >= 1) {
      if (data.length > 20) renderType = "line";
      else renderType = "bar";
    } else {
      renderType = "table";
    }
  }

  useEffect(() => {
    if (renderType === "table" || !chartRef.current || data.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, "dark", { renderer: "canvas" });
    }

    const categoryCol = catCols[0] || columns[0];
    const xAxisData = data.map((row) => row[categoryCol]);
    
    const series = numericCols.map((col) => ({
      name: col,
      type: renderType,
      data: data.map((row) => row[col]),
      smooth: renderType === "line",
      itemStyle: { borderRadius: renderType === "bar" ? [4, 4, 0, 0] : 0 },
      emphasis: { focus: 'series' }
    }));

    if (renderType === "pie") {
       const pieData = data.map((row) => ({ name: row[categoryCol], value: row[numericCols[0]] }));
       chartInstance.current.setOption({
        backgroundColor: "transparent",
        tooltip: { trigger: "item" },
        series: [{ type: "pie", radius: ["40%", "70%"], data: pieData }]
       });
    } else {
      const option: echarts.EChartsOption = {
        backgroundColor: "transparent",
        tooltip: { trigger: "axis", backgroundColor: "rgba(10,10,15,0.9)", borderColor: "rgba(255,255,255,0.1)", textStyle: { color: "#fff" } },
        legend: { textStyle: { color: "#ffffff80" }, top: 0 },
        grid: { left: "3%", right: "4%", bottom: "3%", top: "15%", containLabel: true },
        xAxis: { type: "category", data: xAxisData, axisLabel: { color: "#ffffff60" } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } }, axisLabel: { color: "#ffffff60" } },
        series,
        color: ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"]
      };
      chartInstance.current.setOption(option);
    }

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderType, data, numericCols, catCols, columns]);

  return (
    <div className="w-full glass-panel bg-[#0a0a0f]/60 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-medium flex items-center gap-2">
          {renderType === "table" ? <Table className="w-4 h-4 text-blue-400" /> : 
           renderType === "bar" ? <BarChart3 className="w-4 h-4 text-violet-400" /> : 
           renderType === "pie" ? <PieChart className="w-4 h-4 text-orange-400" /> :
           <Activity className="w-4 h-4 text-emerald-400" />}
          {title || "Dynamic Insight"}
        </h3>
        <span className="text-xs text-white/40 font-mono">{payload.total_rows} rows analyzed</span>
      </div>

      {renderType === "table" ? (
        <div className="overflow-x-auto w-full max-h-[300px] custom-scrollbar">
          <table className="w-full text-left text-sm text-white/80 whitespace-nowrap">
            <thead className="bg-white/5 sticky top-0 backdrop-blur-md">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="px-4 py-2 font-medium text-white/60">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2 font-mono text-xs">{row[col]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={chartRef} className="w-full h-[300px]" />
      )}
    </div>
  );
}
