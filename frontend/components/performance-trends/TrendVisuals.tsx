import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { Calendar, RefreshCw } from "lucide-react";

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
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [timeFilter, setTimeFilter] = useState<"all" | "90" | "30">("all");

  useEffect(() => {
    if (loading || !trends || !chartRef.current) return;

    // Filter data based on selected time window
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

    // Format dates to look nice on X axis (e.g. MMM DD)
    const formattedDates = dates.map(d => {
      try {
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return d.split(" ")[0] || d;
        return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } catch (e) {
        return d;
      }
    });

    const isCurrency = ["revenue", "sales", "price", "amount"].some((k) =>
      (trends.metric || "").toLowerCase().includes(k)
    );

    const chart = echarts.init(chartRef.current);

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#12141c",
        borderColor: "rgba(255, 255, 255, 0.08)",
        textStyle: {
          color: "#f3f4f6",
          fontFamily: "Inter, sans-serif",
          fontSize: 12
        },
        formatter: (params: any) => {
          let html = `<div class="p-1 font-sans"><p class="text-[10px] text-brand-muted mb-1 font-mono">${params[0].name}</p>`;
          params.forEach((p: any) => {
            const valFormatted = isCurrency
              ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p.value)
              : new Intl.NumberFormat("en-US").format(p.value);
            html += `<div class="flex items-center justify-between gap-4 mt-1">
              <span class="flex items-center gap-1.5 text-xs text-gray-300">
                <span class="w-2 h-2 rounded-full" style="background-color: ${p.color}"></span>
                ${p.seriesName}
              </span>
              <span class="text-xs font-bold text-white font-mono">${valFormatted}</span>
            </div>`;
          });
          html += `</div>`;
          return html;
        }
      },
      grid: {
        top: "12%",
        left: "3%",
        right: "3%",
        bottom: "15%",
        containLabel: true
      },
      xAxis: {
        type: "category",
        data: formattedDates,
        boundaryGap: chartType === "bar",
        axisLine: {
          lineStyle: {
            color: "rgba(255, 255, 255, 0.05)"
          }
        },
        axisLabel: {
          color: "rgba(255, 255, 255, 0.4)",
          fontFamily: "Inter, sans-serif",
          fontSize: 10,
          margin: 12
        },
        axisTick: {
          show: false
        }
      },
      yAxis: {
        type: "value",
        splitLine: {
          lineStyle: {
            color: "rgba(255, 255, 255, 0.03)",
            type: "dashed"
          }
        },
        axisLabel: {
          color: "rgba(255, 255, 255, 0.4)",
          fontFamily: "Inter, sans-serif",
          fontSize: 10,
          formatter: (val: number) => {
            if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
            return val.toString();
          }
        }
      },
      dataZoom: [
        {
          type: "inside",
          start: 0,
          end: 100
        },
        {
          show: false,
          type: "slider",
          top: "92%",
          start: 0,
          end: 100,
          height: 12,
          borderColor: "transparent",
          fillerColor: "rgba(99, 102, 241, 0.08)",
          handleSize: 0,
          moveHandleSize: 0
        }
      ],
      series: [
        {
          name: trends.metric || "Value",
          type: chartType === "area" ? "line" : "bar",
          data: values,
          smooth: 0.3,
          barMaxWidth: 24,
          itemStyle: {
            color: "#5063f4"
          },
          areaStyle: chartType === "area" ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(80, 99, 244, 0.25)" },
              { offset: 1, color: "rgba(80, 99, 244, 0.00)" }
            ])
          } : undefined,
          lineStyle: {
            width: 2.5,
            color: "#5063f4"
          },
          showSymbol: false
        },
        {
          name: "Trend Projection (SMA)",
          type: "line",
          data: movingAvg,
          smooth: 0.4,
          showSymbol: false,
          lineStyle: {
            width: 1.5,
            type: "dashed",
            color: "rgba(255, 255, 255, 0.25)"
          },
          itemStyle: {
            color: "rgba(255, 255, 255, 0.3)"
          }
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
  }, [trends, chartType, timeFilter, loading]);

  return (
    <div className="glass-panel p-6 h-[440px] flex flex-col justify-between">
      {/* Title & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Performance Analytics</h2>
          <p className="text-xs text-brand-muted">Timeline view of target business performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Chart Type Toggle */}
          <div className="flex p-0.5 rounded-lg bg-black/20 border border-white/5">
            <button
              onClick={() => setChartType("area")}
              className={`px-2.5 py-1 text-xs rounded-md transition-all font-medium ${
                chartType === "area"
                  ? "bg-brand-surface text-white shadow-md border border-white/5"
                  : "text-brand-muted hover:text-white"
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`px-2.5 py-1 text-xs rounded-md transition-all font-medium ${
                chartType === "bar"
                  ? "bg-brand-surface text-white shadow-md border border-white/5"
                  : "text-brand-muted hover:text-white"
              }`}
            >
              Bar
            </button>
          </div>

          {/* Time Window Filters */}
          <div className="flex p-0.5 rounded-lg bg-black/20 border border-white/5 font-mono text-[10px]">
            {(["all", "90", "30"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-2 py-1 rounded-md capitalize transition-all font-medium ${
                  timeFilter === filter
                    ? "bg-brand-surface text-brand-primary shadow-sm"
                    : "text-brand-muted hover:text-white"
                }`}
              >
                {filter === "all" ? "All Time" : `${filter}D`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Plot Area */}
      <div className="flex-1 mt-4 relative min-h-[220px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-primary" />
          </div>
        ) : !trends ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-brand-muted font-mono">
            No data loaded
          </div>
        ) : (
          <div ref={chartRef} className="w-full h-full" />
        )}
      </div>

      {/* AI Insight Box at bottom */}
      {aiTrendNote && !loading && (
        <div className="mt-4 bg-[#12141c]/50 border border-white/5 rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-300 flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white mr-1 font-mono text-[9px] tracking-wider uppercase bg-brand-primary/20 px-1.5 py-0.5 rounded">
              Trend projection
            </span>
            {aiTrendNote}
          </div>
        </div>
      )}
    </div>
  );
}
