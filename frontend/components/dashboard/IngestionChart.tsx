"use client";

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";

// Utility to generate initial 24h data points
const generateInitialData = () => {
  const data = [];
  let now = new Date();
  for (let i = 24; i >= 0; i--) {
    let t = new Date(now.getTime() - i * 3600 * 1000);
    // Format: [timestamp, value]
    data.push([
      t.toISOString(),
      Math.floor(2000 + Math.random() * 3000 + Math.sin(i / 3) * 1000)
    ]);
  }
  return data;
};

export default function IngestionChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [data, setData] = useState<any[]>(generateInitialData());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!chartRef.current) return;
    
    chartInstance.current = echarts.init(chartRef.current);
    
    const option = {
      grid: { top: 30, right: 20, bottom: 30, left: 50 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(18, 20, 28, 0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff', fontSize: 12 },
        padding: [10, 15],
        formatter: (params: any) => {
          const point = params[0];
          const time = new Date(point.value[0]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const val = point.value[1].toLocaleString();
          return `
            <div style="font-family: monospace;">
              <div style="color: rgba(255,255,255,0.5); font-size: 10px; margin-bottom: 4px;">${time}</div>
              <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#34d399;"></span>
                ${val} <span style="color: rgba(255,255,255,0.4); font-weight: 400;">records/hr</span>
              </div>
            </div>
          `;
        }
      },
      xAxis: {
        type: 'time',
        splitLine: { show: false },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        splitLine: { 
          show: true, 
          lineStyle: { color: 'rgba(255,255,255,0.06)', type: 'dashed' } 
        },
        axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10 }
      },
      series: [
        {
          name: 'Throughput',
          type: 'line',
          showSymbol: false,
          smooth: true,
          lineStyle: { color: '#34d399', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(52, 211, 153, 0.25)' },
              { offset: 1, color: 'rgba(52, 211, 153, 0)' }
            ])
          },
          data: data
        }
      ]
    };
    
    chartInstance.current.setOption(option);
    
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulate WebSocket / SSE updates
  useEffect(() => {
    // In real implementation:
    // const ws = new WebSocket('ws://localhost:8000/ws/ingestion');
    // ws.onmessage = (e) => ...
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsConnected(true);
    const interval = setInterval(() => {
      const now = new Date().toISOString();
      const lastVal = data[data.length - 1][1];
      const newVal = Math.max(0, lastVal + (Math.random() - 0.5) * 500);
      
      const newDataPoint = [now, Math.floor(newVal)];
      
      setData(prev => {
        const next = [...prev, newDataPoint];
        if (next.length > 30) next.shift(); // keep sliding window
        return next;
      });
    }, 5000); // Poll every 5s for demo

    return () => clearInterval(interval);
  }, [data]);

  // Update chart when data changes
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.setOption({
        series: [{ data }]
      });
    }
  }, [data]);

  return (
    <div className="w-full glass-panel bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Ingestion throughput, 24h</h2>
        <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          {isConnected ? 'LIVE WS' : 'POLLING FALLBACK'}
        </div>
      </div>
      <div ref={chartRef} className="w-full h-[250px]" />
    </div>
  );
}
