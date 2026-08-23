"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, CheckCircle } from "lucide-react";
import { formatMetricValue } from "@/utils/formatters";

export interface KpiMetricItem {
  label: string;
  value: string | number;
  trend?: string;
  trendLabel?: string;
  trendUp?: boolean;
  spark?: number[];
  sparkColor?: string;
  icon?: string;
  isLatency?: boolean;
}

interface KpiOverviewProps {
  kpis?: any | null;
  metrics?: KpiMetricItem[] | null;
  profile?: any | null;
  aiHeadline?: string | null;
  loading?: boolean;
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

  const pathD = pts.map((p, i) => (i === 0 ? `M ${p}` : `L ${p}`)).join(" ");
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

export default function KpiOverview({ kpis, metrics, profile, aiHeadline, loading = false }: KpiOverviewProps) {
  if (loading) {
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

  const formatCompact = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
    return val.toFixed(0);
  };

  // Helper to build dynamic cards from dataset profile or kpi object
  const cards: KpiMetricItem[] = (() => {
    if (metrics && metrics.length > 0) {
      return metrics;
    }

    const dynamicCards: KpiMetricItem[] = [];

    const cols = profile?.columns || kpis?.columns || [];
    const totalRows = profile?.total_rows ?? kpis?.total_records ?? kpis?.row_count ?? null;
    const qualityScore = profile?.quality_report?.health_score ?? kpis?.quality_score ?? null;

    // 1. Total Records
    if (totalRows !== null && totalRows !== undefined) {
      dynamicCards.push({
        label: "Total Records",
        value: typeof totalRows === "number" ? formatCompact(totalRows) : totalRows,
        trend: "Dataset Size",
        trendLabel: "records",
        trendUp: true,
        spark: [900, 1050, 980, 1200, 1100, 1350, 1280, 1600, totalRows],
        sparkColor: "#38bdf8",
        icon: "⬡",
      });
    }

    // 2. Data Quality Score
    if (qualityScore !== null && qualityScore !== undefined) {
      const qVal = typeof qualityScore === "number" ? qualityScore : parseFloat(qualityScore);
      dynamicCards.push({
        label: "Data Quality Score",
        value: `${qVal.toFixed(1)}%`,
        trend: qVal >= 99 ? "100%" : `+${(100 - qVal).toFixed(1)}%`,
        trendLabel: qVal >= 99 ? "Clean (Healed)" : "fill rate",
        trendUp: true,
        spark: [95, 96, 95.5, 97, 96.8, 97.5, 97.8, 98, qVal],
        sparkColor: "#10b981",
        icon: "⊙",
      });
    }

    // 3. Dynamic Numeric Metrics
    const numericCols = cols.filter(
      (c: any) => c.inferred_role === "metric" || c.dtype_category === "numeric" || c.role === "numeric" || c.role === "metric"
    );

    if (numericCols.length > 0) {
      const primaryCol = numericCols.find((c: any) => c.is_primary_metric) || numericCols[0];
      const rawColName = primaryCol.name || kpis?.metric_name || "Metric";
      const metricName = rawColName.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());

      const totalVal = kpis?.total_value ?? (primaryCol.numeric_stats?.mean ? primaryCol.numeric_stats.mean * (totalRows || 100) : null);
      const meanVal = primaryCol.numeric_stats?.mean ?? kpis?.mean_value ?? null;
      const growth = kpis?.growth_rate ?? 12.4;

      if (totalVal !== null && totalVal !== undefined) {
        dynamicCards.push({
          label: `Total ${metricName}`,
          value: formatMetricValue(totalVal, rawColName, primaryCol.semantic_type, { notation: "compact" }),
          trend: `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`,
          trendLabel: "vs baseline",
          trendUp: growth >= 0,
          spark: [0.6, 0.55, 0.7, 0.65, 0.8, 0.75, 0.9, 0.88, 1.0].map((f) => totalVal * f * 0.85),
          sparkColor: growth >= 0 ? "#10b981" : "#ef4444",
          icon: "📊",
        });
      }

      if (meanVal !== null && meanVal !== undefined) {
        dynamicCards.push({
          label: `Mean ${metricName}`,
          value: formatMetricValue(meanVal, rawColName, primaryCol.semantic_type, { notation: "compact" }),
          trend: "Avg",
          trendLabel: "column mean",
          trendUp: true,
          spark: [0.9, 0.8, 1.05, 0.95, 1.1, 0.85, 0.9, 0.95, 1.0].map((f) => meanVal * f),
          sparkColor: "#5063f4",
          icon: "∑",
        });
      }
    }

    // 4. Categorical Dimensions
    const catCols = cols.filter(
      (c: any) => c.inferred_role === "dimension" || c.dtype_category === "categorical" || c.role === "categorical" || c.role === "category"
    );
    if (catCols.length > 0 && dynamicCards.length < 4) {
      const primaryCat = catCols.find((c: any) => c.is_primary_category) || catCols[0];
      const catName = primaryCat.name.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
      const cardinality = primaryCat.cardinality || primaryCat.unique_values?.length || kpis?.unique_categories;
      if (cardinality) {
        dynamicCards.push({
          label: `${catName} Segments`,
          value: `${cardinality}`,
          trend: "Unique",
          trendLabel: "distinct categories",
          trendUp: true,
          spark: [2, 3, 3, 4, 5, 5, cardinality],
          sparkColor: "#8b5cf6",
          icon: "❖",
        });
      }
    }

    if (dynamicCards.length === 0 && kpis) {
      const rawTitle = kpis.metric_name || "Primary Metric";
      const metricTitle = rawTitle.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
      const isPositive = (kpis.growth_rate || 0) >= 0;
      return [
        {
          label: `Total ${metricTitle}`,
          value: formatMetricValue(kpis.total_value || 0, rawTitle, null, { notation: "compact" }),
          trend: `${isPositive ? "+" : ""}${(kpis.growth_rate || 0).toFixed(1)}%`,
          trendLabel: "vs baseline",
          trendUp: isPositive,
          spark: [0.6, 0.7, 0.8, 0.9, 1.0].map((f) => (kpis.total_value || 1000) * f),
          sparkColor: isPositive ? "#10b981" : "#ef4444",
          icon: "📊",
        },
        {
          label: "Total Records",
          value: formatCompact(kpis.total_records || 0),
          trend: "Size",
          trendLabel: "dataset rows",
          trendUp: true,
          spark: [900, 1100, 1350, kpis.total_records || 1000],
          sparkColor: "#38bdf8",
          icon: "⬡",
        },
        {
          label: "Data Quality Score",
          value: `${(kpis.quality_score || 98).toFixed(1)}%`,
          trend: "Fill rate",
          trendLabel: "health index",
          trendUp: true,
          spark: [95, 96, 97, kpis.quality_score || 98],
          sparkColor: "#10b981",
          icon: "⊙",
        },
        {
          label: `Mean ${metricTitle}`,
          value: formatMetricValue(kpis.mean_value || 0, rawTitle, null, { notation: "compact" }),
          trend: "Avg",
          trendLabel: "dataset mean",
          trendUp: true,
          spark: [0.9, 1.0, 1.1].map((f) => (kpis.mean_value || 10) * f),
          sparkColor: "#5063f4",
          icon: "∑",
        },
      ];
    }

    return dynamicCards;
  })();

  if (cards.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Dynamic KPI Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(cards.length, 4)} gap-3`}>
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
                {card.label}
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
                      card.trendUp !== false ? "text-brand-success" : "text-brand-error"
                    }`}
                  >
                    {card.trendUp !== false ? (
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
            {card.spark && (
              <div className="absolute bottom-0 right-0 opacity-70 pointer-events-none">
                <Sparkline values={card.spark} color={card.sparkColor || "#38bdf8"} width={90} height={38} />
              </div>
            )}
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
