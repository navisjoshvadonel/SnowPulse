"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Brain, Target } from "lucide-react";

interface ForecastData {
  target_column: string;
  model_type: string;
  future_dates: string[];
  forecast_values: number[];
  lower_bounds: number[];
  upper_bounds: number[];
  historical_dates: string[];
  historical_values: number[];
  explanation: string;
}

interface TrainingRun {
  timestamp: string;
  metrics: Record<string, number>;
}

interface PredictionPanelProps {
  forecast: ForecastData | null;
  trainingHistory: TrainingRun[];
  loading: boolean;
}

function ForecastChart({ forecast }: { forecast: ForecastData }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);

    const allDates = [...forecast.historical_dates, ...forecast.future_dates];
    const actualSeries = [
      ...forecast.historical_values,
      ...forecast.future_dates.map(() => null),
    ];
    const forecastSeries = [
      ...forecast.historical_dates.map(() => null),
      ...forecast.forecast_values,
    ];
    const lowerSeries = [
      ...forecast.historical_dates.map(() => null),
      ...forecast.lower_bounds,
    ];
    const upperSeries = [
      ...forecast.historical_dates.map(() => null),
      ...forecast.upper_bounds,
    ];

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      legend: {
        data: ["Actual", "Forecast", "Confidence range"],
        textStyle: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
        top: 0,
      },
      grid: { left: 45, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: "category",
        data: allDates,
        axisLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10 },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      },
      series: [
        {
          name: "Confidence range",
          type: "line",
          data: upperSeries,
          lineStyle: { opacity: 0 },
          areaStyle: { color: "rgba(167,139,250,0.12)" },
          stack: "confidence",
          symbol: "none",
        },
        {
          name: "Confidence range",
          type: "line",
          data: lowerSeries,
          lineStyle: { opacity: 0 },
          areaStyle: { color: "rgba(15,20,25,1)" },
          stack: "confidence",
          symbol: "none",
        },
        {
          name: "Actual",
          type: "line",
          data: actualSeries,
          color: "#38bdf8",
          symbol: "none",
          lineStyle: { width: 2 },
        },
        {
          name: "Forecast",
          type: "line",
          data: forecastSeries,
          color: "#a78bfa",
          symbol: "none",
          lineStyle: { width: 2, type: "dashed" },
        },
      ],
    };

    chart.setOption(option);
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [forecast]);

  return <div ref={chartRef} style={{ width: "100%", height: 280 }} />;
}

function ScoreChart({ trainingHistory }: { trainingHistory: TrainingRun[] }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || trainingHistory.length === 0) return;
    const chart = echarts.init(chartRef.current);

    const runs = trainingHistory.map((_, i) => `Run ${i + 1}`);
    const primaryMetricKey = Object.keys(trainingHistory[0]?.metrics || {})[0] || "score";
    const scores = trainingHistory.map((run) =>
      Number(((run.metrics[primaryMetricKey] ?? 0) * 100).toFixed(1))
    );

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      grid: { left: 45, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: "category",
        data: runs,
        axisLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10 },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10, formatter: "{value}%" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      },
      series: [
        {
          name: primaryMetricKey,
          type: "bar",
          data: scores,
          color: "#34d399",
          barWidth: "40%",
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        },
      ],
    };

    chart.setOption(option);
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [trainingHistory]);

  return <div ref={chartRef} style={{ width: "100%", height: 200 }} />;
}

export default function PredictionPanel({ forecast, trainingHistory, loading }: PredictionPanelProps) {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-80 bg-brand-surface/40 border border-white/5 rounded-xl" />
        <div className="h-64 bg-brand-surface/40 border border-white/5 rounded-xl" />
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="bg-brand-surface/40 border border-white/5 rounded-xl p-8 text-center">
        <Target className="mx-auto mb-3 text-white/20" size={32} />
        <p className="text-sm text-white/50">
          No forecast model trained for this dataset yet. Train one to see future predictions.
        </p>
      </div>
    );
  }

  const primaryMetricKey = Object.keys(trainingHistory[0]?.metrics || {})[0];

  return (
    <div className="space-y-6">
      {/* Graph 1: forecast with confidence band */}
      <div className="bg-brand-surface/40 border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white">
          {forecast.target_column} — {forecast.model_type} forecast
        </h3>
        <p className="text-xs text-white/40 mb-2">Historical values and projected future values</p>
        <ForecastChart forecast={forecast} />
      </div>

      {/* Graph 2: model score history */}
      <div className="bg-brand-surface/40 border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Model score by training run</h3>
        <p className="text-xs text-white/40 mb-4">
          {trainingHistory.length > 0
            ? `${primaryMetricKey} across each trained version`
            : "No training runs recorded yet"}
        </p>
        {trainingHistory.length > 0 ? (
          <ScoreChart trainingHistory={trainingHistory} />
        ) : (
          <div className="h-[120px] flex items-center justify-center text-xs text-white/30">
            Train a model to see score history here.
          </div>
        )}
      </div>

      {/* Reasoning card */}
      <div className="bg-brand-surface/40 border border-white/5 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center shrink-0">
            <Brain size={16} className="text-brand-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Why this forecast</h3>
            <p className="text-sm text-white/60 leading-relaxed">{forecast.explanation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
