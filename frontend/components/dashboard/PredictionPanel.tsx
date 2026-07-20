"use client";

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { Brain, Cpu, Play, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { apiService } from "@/services/api";

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
  datasetId?: number;
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

function FeatureImportanceChart({ importances }: { importances: { feature: string; importance: number }[] }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || importances.length === 0) return;
    const chart = echarts.init(chartRef.current);

    const names = importances.map((i) => i.feature).reverse();
    const values = importances.map((i) => i.importance * 100).reverse();

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", formatter: "{b}: {c}%" },
      grid: { left: 120, right: 30, top: 10, bottom: 20 },
      xAxis: {
        type: "value",
        axisLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10, formatter: "{value}%" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      },
      yAxis: {
        type: "category",
        data: names,
        axisLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      series: [
        {
          type: "bar",
          data: values,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#38bdf8" },
              { offset: 1, color: "#818cf8" },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
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
  }, [importances]);

  return <div ref={chartRef} style={{ width: "100%", height: 220 }} />;
}

export default function PredictionPanel({ datasetId, forecast, trainingHistory, loading }: PredictionPanelProps) {
  const [trainingTask, setTrainingTask] = useState<string>("auto");
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainResult, setTrainResult] = useState<any>(null);
  const [trainError, setTrainError] = useState<string | null>(null);

  const handleRunAutoML = async () => {
    if (!datasetId) return;
    setIsTraining(true);
    setTrainError(null);
    try {
      const res = await apiService.trainMlModel(datasetId, trainingTask);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "AutoML training failed.");
      }
      const data = await res.json();
      setTrainResult(data);
    } catch (e: any) {
      setTrainError(e.message || "Training error occurred.");
    } finally {
      setIsTraining(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-80 bg-brand-surface/40 border border-white/5 rounded-xl" />
        <div className="h-64 bg-brand-surface/40 border border-white/5 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AutoML Trainer Control Console */}
      <div className="bg-gradient-to-br from-brand-surface/80 to-brand-surface/30 border border-white/10 rounded-xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Universal AI & AutoML Dataset Trainer
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase font-mono tracking-wider">
                  Auto Task
                </span>
              </h3>
              <p className="text-xs text-white/50">
                Train algorithms across Classification, Regression, Clustering, and Anomaly tasks with complex feature engineering.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={trainingTask}
              onChange={(e) => setTrainingTask(e.target.value)}
              className="bg-black/40 text-white text-xs border border-white/15 rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
            >
              <option value="auto">Auto Task Detection</option>
              <option value="regression">Regression (Predict Target)</option>
              <option value="classification">Classification (Categories)</option>
              <option value="segmentation">Clustering (Segmentation)</option>
              <option value="anomaly">Anomaly Detection</option>
            </select>

            <button
              onClick={handleRunAutoML}
              disabled={isTraining || !datasetId}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              {isTraining ? <Sparkles className="animate-spin" size={14} /> : <Play size={14} />}
              {isTraining ? "Training AI..." : "Run AutoML"}
            </button>
          </div>
        </div>

        {trainError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 mb-3">
            {trainError}
          </div>
        )}

        {trainResult && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block">Champion Model</span>
                <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1 mt-0.5">
                  <Trophy size={12} className="text-amber-400" />
                  {trainResult.champion_model}
                </span>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block">Inferred Task</span>
                <span className="text-xs font-semibold text-white mt-0.5 capitalize">{trainResult.task_type}</span>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block">Features Extracted</span>
                <span className="text-xs font-semibold text-emerald-400 mt-0.5">{trainResult.features_used} Features</span>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block">Target Metric</span>
                <span className="text-xs font-semibold text-purple-300 mt-0.5">{trainResult.target_col || "Unsupervised"}</span>
              </div>
            </div>

            {trainResult.feature_importances && trainResult.feature_importances.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-white/80 mb-2 flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-400" />
                  Top Feature Importances & Model Explainability
                </h4>
                <FeatureImportanceChart importances={trainResult.feature_importances} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Graph 1: Forecast with Confidence Band */}
      {forecast ? (
        <div className="bg-brand-surface/40 border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white">
            {forecast.target_column} — {forecast.model_type} forecast
          </h3>
          <p className="text-xs text-white/40 mb-2">Historical values and projected future values</p>
          <ForecastChart forecast={forecast} />
        </div>
      ) : (
        <div className="bg-brand-surface/40 border border-white/5 rounded-xl p-8 text-center">
          <Target className="mx-auto mb-3 text-white/20" size={32} />
          <p className="text-sm text-white/50">
            No forecast model trained for this dataset yet. Run AutoML above to train your AI on complex data!
          </p>
        </div>
      )}

      {/* Reasoning card */}
      {forecast?.explanation && (
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
      )}
    </div>
  );
}

