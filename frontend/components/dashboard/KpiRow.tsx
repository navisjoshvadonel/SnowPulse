"use client";

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(res => res.json()).catch(() => null);

// Mock data to fallback on
const mockKpiData = [
  { id: "datasets", label: "Datasets ingested", value: 142, delta: 12.5, sparkline: [10, 15, 20, 18, 25, 30, 42] },
  { id: "vector", label: "Vector index size", value: 45.2, suffix: "GB", delta: 5.2, sparkline: [20, 22, 25, 30, 32, 38, 45.2] },
  { id: "queries", label: "AI queries/hr", value: 8940, delta: -2.4, sparkline: [9500, 9200, 8800, 9100, 8500, 8700, 8940] },
  { id: "latency", label: "Avg API latency", value: 112, suffix: "ms", delta: -15.2, isInverse: true, sparkline: [150, 145, 130, 140, 125, 118, 112] }
];

// ECharts Sparkline Component
function Sparkline({ data, color }: { data: number[], color: string }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    const chart = echarts.init(chartRef.current);
    
    chart.setOption({
      grid: { left: 0, right: 0, top: 5, bottom: 0 },
      xAxis: { type: "category", show: false, boundaryGap: false },
      yAxis: { type: "value", show: false, min: "dataMin" },
      series: [{
        data,
        type: "line",
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2, color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${color}80` }, // 50% opacity
            { offset: 1, color: `${color}00` }  // 0% opacity
          ])
        }
      }]
    });
    
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartRef.current);
    
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [data, color]);

  return <div ref={chartRef} className="w-full h-10" />;
}

// CountUp Hook
function useCountUp(endValue: number, duration = 1000) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing out quint
      const easeOut = 1 - Math.pow(1 - progress, 5);
      
      setValue(endValue * easeOut);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(tick);
      } else {
        setValue(endValue);
      }
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [endValue, duration]);

  // Format based on magnitude or decimals
  return endValue % 1 === 0 ? Math.round(value) : value.toFixed(1);
}

export default function KpiRow() {
  const { data } = useSWR('/api/metrics/summary', fetcher, { 
    fallbackData: mockKpiData,
    refreshInterval: 15000 
  });
  
  const kpis = data || mockKpiData;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi: any) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const animatedValue = useCountUp(kpi.value);
        
        // Determine delta color logic
        const isPositive = kpi.delta > 0;
        const isGood = kpi.isInverse ? !isPositive : isPositive;
        const DeltaIcon = isPositive ? ArrowUpRight : ArrowDownRight;
        
        return (
          <div key={kpi.id} className="glass-panel p-5 flex flex-col justify-between bg-white/[0.02] border border-white/[0.08] rounded-2xl relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] text-white/50 font-medium">{kpi.label}</span>
              <div className={`flex items-center gap-0.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${isGood ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                <DeltaIcon className="w-3 h-3" />
                <span>{Math.abs(kpi.delta)}%</span>
              </div>
            </div>
            
            {/* Value & Sparkline */}
            <div className="flex items-end justify-between mt-2">
              <div className="flex items-baseline gap-1 z-10">
                <span className="text-[32px] font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">
                  {animatedValue}
                </span>
                {kpi.suffix && (
                  <span className="text-sm font-semibold text-white/60 mb-2">{kpi.suffix}</span>
                )}
              </div>
              
              <div className="w-[45%] z-0 relative top-2">
                <Sparkline data={kpi.sparkline} color={isGood ? "#34d399" : "#8b5cf6"} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
