"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, CheckCircle } from "lucide-react";

interface KpiData {
  total_value: number;
  mean_value: number;
  std_dev: number;
  growth_rate: number;
  total_records: number;
  unique_categories: number;
  unique_regions: number;
  quality_score: number;
  metric_name: string;
}

interface KpiOverviewProps {
  kpis: KpiData | null;
  aiHeadline: string | null;
  loading: boolean;
}

// Inline sparkline SVG component — renders a mini trend path
function Sparkline({
  values,
  color,
  width = 80,
  height = 32,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = pts
    .map((p, i) => (i === 0 ? `M ${p}` : `L ${p}`))
    .join(" ");

  // Build area path (fill under curve)
  const areaD = `${pathD} L ${(width - 2).toFixed(1)},${height} L 2,${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-fill-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-fill-${color.replace("#", "")})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function KpiOverview({ kpis, aiHeadline, loading }: KpiOverviewProps) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="shimmer rounded-xl p-5"
            style={{
              background: "rgba(18,21,30,0.5)",
              border: "1px solid rgba(255,255,255,0.05)",
              height: 120,
            }}
          />
        ))}
      </div>
    );
  }

  const growth = kpis.growth_rate;
  const isPositive = growth >= 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  const formatCompact = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
    return val.toFixed(0);
  };

  // Generate deterministic-looking sparkline values from kpis
  const revenueSparkline = [0.6, 0.55, 0.7, 0.65, 0.8, 0.75, 0.9, 0.88, 1.0].map(
    (f) => kpis.total_value * f * 0.85
  );
  const nodeSparkline = [900, 1050, 980, 1200, 1100, 1350, 1280, 1600, kpis.total_records];
  const accuracySparkline = [95, 96, 95.5, 97, 96.8, 97.5, 97.8, 98, kpis.quality_score];
  const latencySparkline = [0.9, 0.8, 1.05, 0.95, 1.1, 0.85, 0.9, 0.95, 1.0].map(
    (f) => kpis.mean_value * f
  );

  const isCurrency = ["revenue", "sales", "price", "amount", "mrr", "cost"].some((k) =>
    (kpis.metric_name || "").toLowerCase().includes(k)
  );

  const metricTitle = kpis.metric_name 
    ? kpis.metric_name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) 
    : "Primary Metric";

  const cards = [
    {
      title: `Total ${metricTitle}`,
      value: isCurrency
        ? formatCurrency(kpis.total_value)
        : formatCompact(kpis.total_value),
      trend: `${isPositive ? "+" : ""}${growth.toFixed(1)}%`,
      trendLabel: "vs baseline",
      trendUp: isPositive,
      spark: revenueSparkline,
      sparkColor: isPositive ? "#10b981" : "#ef4444",
      icon: "📊",
    },
    {
      title: "Total Records",
      value: formatCompact(kpis.total_records),
      trend: "Size",
      trendLabel: "dataset rows",
      trendUp: true,
      spark: nodeSparkline,
      sparkColor: "#38bdf8",
      icon: "⬡",
    },
    {
      title: "Data Quality Score",
      value: `${kpis.quality_score.toFixed(1)}%`,
      trend: `+${(100 - kpis.quality_score).toFixed(1)}%`,
      trendLabel: "fill rate",
      trendUp: true,
      spark: accuracySparkline,
      sparkColor: "#10b981",
      icon: "⊙",
      badge: true,
    },
    {
      title: `Mean ${metricTitle}`,
      value: isCurrency
        ? formatCurrency(kpis.mean_value || 0)
        : formatCompact(kpis.mean_value || 0),
      trend: "Avg",
      trendLabel: "dataset mean",
      trendUp: true,
      spark: latencySparkline,
      sparkColor: "#5063f4",
      icon: "∑",
      isLatency: false,
    },
  ];

  return (
    <div className="space-y-3">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className="relative overflow-hidden interactive-element rounded-xl p-5 flex flex-col justify-between"
            style={{
              background: "rgba(18,21,30,0.65)",
              border: "1px solid rgba(255,255,255,0.06)",
              minHeight: 110,
            }}
          >
            {/* Title row */}
            <div className="flex items-start justify-between mb-1">
              <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider leading-tight">
                {card.title}
              </p>
              <span className="text-white/20 text-sm flex-shrink-0 ml-2">{card.icon}</span>
            </div>

            {/* Value */}
            <h3 className="text-[26px] font-bold text-white tracking-tight leading-none mb-1">
              {card.value}
            </h3>

            {/* Trend row */}
            <div className="flex items-center gap-1.5 text-[11px]">
              {card.isLatency ? (
                <>
                  <span className="flex items-center gap-1 text-brand-success font-semibold">
                    <CheckCircle size={11} />
                    {card.trend}
                  </span>
                  <span className="text-white/30">{card.trendLabel}</span>
                </>
              ) : (
                <>
                  <span
                    className={`flex items-center gap-0.5 font-semibold ${
                      card.trendUp ? "text-brand-success" : "text-brand-error"
                    }`}
                  >
                    {card.trendUp ? (
                      <ArrowUpRight size={12} />
                    ) : (
                      <ArrowDownRight size={12} />
                    )}
                    {card.trend}
                  </span>
                  <span className="text-white/30">{card.trendLabel}</span>
                </>
              )}
            </div>

            {/* Sparkline */}
            <div className="absolute bottom-0 right-0 opacity-70 pointer-events-none">
              <Sparkline values={card.spark} color={card.sparkColor} width={90} height={38} />
            </div>
          </div>
        ))}
      </div>

      {/* AI Headline */}
      {aiHeadline && (
        <div
          className="px-4 py-3 rounded-xl flex items-start gap-3"
          style={{
            background: "rgba(80,99,244,0.06)",
            border: "1px solid rgba(80,99,244,0.18)",
            borderLeft: "3px solid #5063f4",
          }}
        >
          <div className="mt-0.5 flex-shrink-0 w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            <span className="font-semibold text-white mr-1.5 font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded bg-brand-primary/20 border border-brand-primary/30">
              AI Insight
            </span>
            {aiHeadline}
          </p>
        </div>
      )}
    </div>
  );
}
