import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { RefreshCw } from "lucide-react";

interface DonutItem {
  name: string;
  value: number;
}

interface DonutChartProps {
  data: DonutItem[] | null;
  loading: boolean;
  title?: string;
}

export default function DonutChart({ data, loading, title = "Top segments" }: DonutChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || !data || !chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const isCurrency = data.some(item => 
      ["revenue", "sales", "price", "amount"].some(k => item.name.toLowerCase().includes(k)) ||
      item.value > 1000
    );

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#12141c",
        borderColor: "rgba(255, 255, 255, 0.08)",
        textStyle: {
          color: "#f3f4f6",
          fontFamily: "Inter, sans-serif",
          fontSize: 11
        },
        formatter: (params: any) => {
          const valFormatted = isCurrency
            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(params.value)
            : new Intl.NumberFormat("en-US").format(params.value);
          return `<div class="p-1 font-sans">
            <span class="text-[10px] text-brand-muted block font-mono">${params.seriesName}</span>
            <span class="flex items-center gap-1.5 mt-1 text-xs text-white">
              <span class="w-2 h-2 rounded-full" style="background-color: ${params.color}"></span>
              <strong>${params.name}</strong>: ${valFormatted} (${params.percent}%)
            </span>
          </div>`;
        }
      },
      legend: {
        show: false
      },
      series: [
        {
          name: title,
          type: "pie",
          radius: ["60%", "80%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: "#12141c",
            borderWidth: 2
          },
          label: {
            show: false,
            position: "center"
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: "bold",
              color: "#ffffff",
              formatter: "{b}\n{d}%"
            }
          },
          labelLine: {
            show: false
          },
          data: data,
          color: ["#5063f4", "#10b981", "#f59e0b", "#8b5cf6", "#6b7280"]
        }
      ]
    };

    chart.setOption(option);

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      chart.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [data, loading, title]);

  return (
    <div className="glass-panel p-5 h-full flex flex-col justify-between">
      <div>
        <p className="text-sm font-medium text-white mb-3">{title}</p>
      </div>

      <div className="flex-1 relative min-h-[140px] flex items-center justify-center">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin text-brand-primary" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-brand-muted font-mono">
            No segments found
          </div>
        ) : (
          <div ref={chartRef} className="w-full h-full" />
        )}
      </div>

      {/* Stylized legend items */}
      {!loading && data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] text-brand-muted font-mono">
          {data.slice(0, 4).map((item, idx) => {
            const colors = ["#5063f4", "#10b981", "#f59e0b", "#8b5cf6", "#6b7280"];
            return (
              <div key={idx} className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: colors[idx % colors.length] }}></span>
                <span className="truncate" title={item.name}>{item.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
