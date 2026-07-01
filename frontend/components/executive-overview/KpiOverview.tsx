import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

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

export default function KpiOverview({ kpis, aiHeadline, loading }: KpiOverviewProps) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-brand-surface/40 border border-white/5 rounded-xl p-4" />
        ))}
      </div>
    );
  }

  const formatValue = (val: number, name: string) => {
    const isCurrency = ["revenue", "sales", "price", "amount"].some((k) =>
      name.toLowerCase().includes(k)
    );
    if (isCurrency) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(val);
    }
    return new Intl.NumberFormat("en-US").format(val);
  };

  const growth = kpis.growth_rate;
  const isPositive = growth >= 0;

  const cards = [
    {
      title: `Queries today (${kpis.metric_name || "Revenue"})`,
      value: formatValue(kpis.total_value, kpis.metric_name || "Revenue"),
      trend: `${isPositive ? "+" : ""}${growth.toFixed(1)}%`,
      trendType: isPositive ? "success" : "error",
      trendText: "period change"
    },
    {
      title: "Avg. response time",
      value: `${kpis.mean_value.toFixed(1)}s`,
      trend: `${kpis.std_dev.toFixed(1)}s dev`,
      trendType: "neutral",
      trendText: "standard deviation"
    },
    {
      title: "Model accuracy",
      value: `${kpis.quality_score}%`,
      trend: "stable vs last week",
      trendType: "stable",
      trendText: ""
    },
    {
      title: "Active users",
      value: new Intl.NumberFormat("en-US").format(kpis.total_records),
      trend: `${kpis.unique_categories} segments`,
      trendType: "neutral",
      trendText: "unique categories"
    }
  ];

  return (
    <div className="space-y-4">
      {/* 4 Mockup-styled KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((card, idx) => {
          return (
            <div
              key={idx}
              className="glass-panel p-4 relative overflow-hidden group interactive-element bg-brand-surface"
            >
              <p className="text-[13px] text-brand-muted mb-1.5 font-medium">{card.title}</p>
              <h3 className="text-2xl font-semibold text-white tracking-tight">{card.value}</h3>
              
              <div className="flex items-center gap-1 mt-1 text-xs">
                {card.trendType === "success" && (
                  <span className="text-brand-success flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    {card.trend}
                  </span>
                )}
                {card.trendType === "error" && (
                  <span className="text-brand-error flex items-center gap-0.5">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {card.trend}
                  </span>
                )}
                {card.trendType === "neutral" && (
                  <span className="text-brand-primary flex items-center gap-0.5">
                    <Minus className="w-3.5 h-3.5" />
                    {card.trend}
                  </span>
                )}
                {card.trendType === "stable" && (
                  <span className="text-brand-muted flex items-center gap-0.5">
                    {card.trend}
                  </span>
                )}
                
                {card.trendText && (
                  <span className="text-[10px] text-brand-muted font-mono ml-1">{card.trendText}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Headline Summary Bar */}
      {aiHeadline && (
        <div className="glass-panel px-4 py-3 border-l-4 border-brand-primary flex items-start gap-3 bg-brand-surface/65">
          <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-brand-primary animate-ping" />
          <div className="text-xs text-gray-300 leading-relaxed font-sans">
            <span className="font-semibold text-white mr-1.5 font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded bg-brand-primary/20 border border-brand-primary/30">
              AI Insight
            </span>
            {aiHeadline}
          </div>
        </div>
      )}
    </div>
  );
}
