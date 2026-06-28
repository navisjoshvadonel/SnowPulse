import React from "react";
import { TrendingUp, TrendingDown, Users, Activity, Percent, DollarSign } from "lucide-react";

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-brand-surface/40 border border-white/5 rounded-2xl p-5" />
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

  // Derive previous period estimate
  const previousRevenueVal = kpis.total_value / (1 + growth / 100);
  const revenueDifference = kpis.total_value - previousRevenueVal;

  const cards = [
    {
      title: `Total ${kpis.metric_name || "Revenue"}`,
      value: formatValue(kpis.total_value, kpis.metric_name || "Revenue"),
      icon: DollarSign,
      color: "text-brand-primary",
      bg: "bg-brand-primary/10",
      description: `${isPositive ? "+" : ""}${formatValue(revenueDifference, kpis.metric_name || "Revenue")} from prev period`,
    },
    {
      title: "Total Records / Transactions",
      value: new Intl.NumberFormat("en-US").format(kpis.total_records),
      icon: Users,
      color: "text-brand-success",
      bg: "bg-brand-success/10",
      description: `${kpis.unique_categories} unique segments tracked`,
    },
    {
      title: "Active Channels / Hubs",
      value: new Intl.NumberFormat("en-US").format(kpis.unique_regions || 4),
      icon: Activity,
      color: "text-brand-warning",
      bg: "bg-brand-warning/10",
      description: `Data confidence score: ${kpis.quality_score}%`,
    },
    {
      title: "Growth Velocity",
      value: `${growth.toFixed(1)}%`,
      icon: Percent,
      color: isPositive ? "text-brand-success" : "text-brand-error",
      bg: isPositive ? "bg-brand-success/10" : "bg-brand-error/10",
      description: isPositive ? "Accelerating expansion" : "Declining momentum",
    },
  ];

  return (
    <div className="space-y-4">
      {/* 4 large KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="glass-panel p-5 relative overflow-hidden group interactive-element"
            >
              {/* Background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/2 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-brand-muted">{card.title}</span>
                <div className={`p-2 rounded-xl ${card.bg} ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-2xl font-bold tracking-tight text-white">{card.value}</h3>
                <div className="flex items-center gap-1 mt-1 text-xs text-brand-muted font-mono">
                  {idx === 3 ? (
                    isPositive ? (
                      <TrendingUp className="w-3.5 h-3.5 text-brand-success" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-brand-error" />
                    )
                  ) : null}
                  <span>{card.description}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Headline Summary Bar */}
      {aiHeadline && (
        <div className="glass-panel px-5 py-4 border-l-4 border-brand-primary flex items-start gap-3">
          <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-brand-primary animate-ping" />
          <div className="text-sm text-gray-300 leading-relaxed font-sans">
            <span className="font-semibold text-white mr-1.5 font-mono text-[11px] tracking-wider uppercase px-2 py-0.5 rounded bg-brand-primary/20 border border-brand-primary/30">
              AI Insight
            </span>
            {aiHeadline}
          </div>
        </div>
      )}
    </div>
  );
}
