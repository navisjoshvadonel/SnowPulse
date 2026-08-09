"use client";

import React, { useEffect, useState } from "react";
import {
  Hash, Calendar, Tag, MapPin, AlertCircle, CheckCircle,
  Sparkles, Mail, Globe, Phone, DollarSign, TrendingUp,
  TrendingDown, Minus, Info, AlertTriangle, Layers, Zap,
  Activity, PieChart, ShieldAlert, Cpu
} from "lucide-react";
import { apiService } from "@/services/api";

interface DetectedSignal {
  id: string;
  signal_type: string;
  title: string;
  description: string;
  columns: string[];
  severity_score: number;
  statistical_significance: number;
  business_relevance: number;
  details: Record<string, any>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColumnInfo {
  name: string;
  null_count: number;
  null_percentage: number;
  role: string;
  dtype_category?: string;
  semantic_type?: string;
  cardinality?: number;
  cardinality_ratio?: number;
  is_primary_metric?: boolean;
  is_primary_date?: boolean;
  is_primary_category?: boolean;
  is_primary_geo?: boolean;
  min?: number;
  max?: number;
  mean?: number;
  skew?: number;
}

interface DatasetSchema {
  dataset_id: number;
  name: string;
  description: string | null;
  row_count: number;
  column_count: number;
  date_range: { start: string; end: string } | null;
  primary_metric: string | null;
  primary_date: string | null;
  primary_category: string | null;
  columns: ColumnInfo[];
}

interface DatasetOverviewPanelProps {
  schema: DatasetSchema | null;
  loading: boolean;
}

// ─── Icon maps ────────────────────────────────────────────────────────────────

const ROLE_ICON: Record<string, React.ElementType> = {
  metric: Hash, numeric: Hash, target: Hash, identifier: Hash, id: Hash,
  date: Calendar, temporal: Calendar,
  category: Tag, categorical: Tag, dimension: Tag, text: Tag,
  geo: MapPin, geospatial: MapPin,
};

const ROLE_COLOR: Record<string, string> = {
  metric:      "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  numeric:     "text-sky-400 bg-sky-500/10 border-sky-500/20",
  target:      "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  date:        "text-violet-400 bg-violet-500/10 border-violet-500/20",
  temporal:    "text-violet-400 bg-violet-500/10 border-violet-500/20",
  category:    "text-amber-400 bg-amber-500/10 border-amber-500/20",
  categorical: "text-white/60 bg-white/5 border-white/10",
  dimension:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
  geo:         "text-rose-400 bg-rose-500/10 border-rose-500/20",
  geospatial:  "text-rose-400 bg-rose-500/10 border-rose-500/20",
  identifier:  "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  text:        "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

const SEMANTIC_BADGE: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  email:        { icon: Mail,       label: "Email",    color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  currency:     { icon: DollarSign, label: "Currency", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  url:          { icon: Globe,      label: "URL",      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  phone:        { icon: Phone,      label: "Phone",    color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  lat:          { icon: MapPin,     label: "Latitude", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  lng:          { icon: MapPin,     label: "Longitude",color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  date_string:  { icon: Calendar,   label: "Date str", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  boolean_flag: { icon: Info,       label: "Boolean",  color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
  postal:       { icon: MapPin,     label: "Postal",   color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
};

// ─── Skew indicator ───────────────────────────────────────────────────────────

function SkewBadge({ skew }: { skew: number }) {
  if (Math.abs(skew) < 0.5) return null;
  const right = skew > 0;
  const strong = Math.abs(skew) > 1;
  const Icon = strong ? (right ? TrendingUp : TrendingDown) : Minus;
  const label = strong
    ? (right ? "Right skewed" : "Left skewed")
    : (right ? "Slight right" : "Slight left");
  const color = strong
    ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
    : "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${color}`}>
      <Icon size={9} />
      {label}
    </span>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

const SIGNAL_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  outlier: { icon: AlertTriangle, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Outlier Spike" },
  multivariate_outlier: { icon: Layers, color: "text-purple-400 bg-purple-500/10 border-purple-500/20", label: "Multivariate Anomaly" },
  distribution_shift: { icon: TrendingUp, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", label: "Distribution Shift" },
  high_correlation: { icon: Zap, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "High Correlation" },
  inverse_relationship: { icon: Activity, color: "text-rose-400 bg-rose-500/10 border-rose-500/20", label: "Inverse Relationship" },
  missingness_cluster: { icon: ShieldAlert, color: "text-rose-400 bg-rose-500/10 border-rose-500/20", label: "Missingness Cluster" },
  category_imbalance: { icon: PieChart, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", label: "Category Imbalance" },
};

export default function DatasetOverviewPanel({ schema, loading }: DatasetOverviewPanelProps) {
  const [signals, setSignals] = useState<DetectedSignal[]>([]);
  const [loadingSignals, setLoadingSignals] = useState<boolean>(false);

  useEffect(() => {
    if (schema?.dataset_id) {
      setLoadingSignals(true);
      apiService.getDatasetSignals(schema.dataset_id)
        .then((res: any) => {
          if (res?.signals) {
            setSignals(res.signals);
          }
        })
        .catch((err: unknown) => console.error("Failed to fetch signals", err))
        .finally(() => setLoadingSignals(false));
    }
  }, [schema?.dataset_id]);

  if (loading || !schema) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-brand-surface/40 border border-white/5 rounded-xl" />
        <div className="h-64 bg-brand-surface/40 border border-white/5 rounded-xl" />
      </div>
    );
  }

  const missingCols = schema.columns.filter((c) => c.null_percentage > 0);
  const preprocessingNeeded = missingCols.length > 0;

  const summaryCards = [
    { label: "Rows",           value: schema.row_count.toLocaleString() },
    { label: "Columns",        value: schema.column_count.toString() },
    {
      label: "Date range",
      value: schema.date_range
        ? `${schema.date_range.start} → ${schema.date_range.end}`
        : "No date column detected",
    },
    { label: "Primary metric", value: schema.primary_metric || "None detected" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">{schema.name}</h2>
          {preprocessingNeeded ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle size={12} />
              Preprocessing Needed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle size={12} />
              Ready for Analysis
            </span>
          )}
        </div>

        {schema.description && (
          <div className="mt-3 flex items-start gap-2.5 bg-brand-primary/5 border border-brand-primary/10 rounded-lg p-3">
            <Sparkles className="text-brand-primary mt-0.5 shrink-0" size={16} />
            <p className="text-sm text-white/80 leading-relaxed font-medium">{schema.description}</p>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-brand-surface/40 border border-white/5 rounded-xl p-4">
            <div className="text-xs text-white/40 mb-1">{c.label}</div>
            <div className="text-sm font-semibold text-white truncate" title={c.value}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Automated Signals & Insights */}
      {(signals.length > 0 || loadingSignals) && (
        <div className="bg-brand-surface/40 border border-white/5 rounded-xl overflow-hidden p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="text-brand-primary" size={18} />
              <h3 className="text-sm font-semibold text-white">Automated Statistical Signals</h3>
            </div>
            <span className="text-[11px] text-brand-primary/80 font-mono bg-brand-primary/10 border border-brand-primary/20 px-2 py-0.5 rounded-full">
              Deterministic Engine · Top {signals.length} Surface Insights
            </span>
          </div>

          {loadingSignals ? (
            <div className="text-xs text-white/40 py-2">Scanning dataset for statistical signals...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {signals.map((sig) => {
                const meta = SIGNAL_META[sig.signal_type] || {
                  icon: Info,
                  color: "text-white/60 bg-white/5 border-white/10",
                  label: sig.signal_type
                };
                const Icon = meta.icon;

                return (
                  <div
                    key={sig.id}
                    className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${meta.color}`}>
                        <Icon size={11} />
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-white/40 font-mono" title={`Statistical significance: ${(sig.statistical_significance*100).toFixed(0)}%, Business relevance: ${(sig.business_relevance*100).toFixed(0)}%`}>
                        severity {(sig.severity_score * 100).toFixed(0)}%
                      </span>
                    </div>

                    <h4 className="text-xs font-medium text-white/90">{sig.title}</h4>
                    <p className="text-[11px] text-white/60 leading-normal">{sig.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Column table */}
      <div className="bg-brand-surface/40 border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Columns</h3>
          <span className="text-[11px] text-white/30 font-mono">
            {schema.columns.length} cols · profile v2.0
          </span>
        </div>
        <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto">
          {schema.columns.map((col) => {
            const Icon = ROLE_ICON[col.role] ?? Tag;
            const roleColor = ROLE_COLOR[col.role] ?? "text-white/60 bg-white/5 border-white/10";
            const semanticMeta = col.semantic_type && col.semantic_type !== "generic"
              ? SEMANTIC_BADGE[col.semantic_type]
              : null;
            const isPrimary = col.is_primary_metric || col.is_primary_date ||
              col.is_primary_category || col.is_primary_geo;

            return (
              <div
                key={col.name}
                className={`flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] ${isPrimary ? "bg-brand-primary/3" : ""}`}
              >
                {/* Left: badges + name */}
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${roleColor}`}>
                    <Icon size={11} />
                    {col.role}
                  </span>

                  {semanticMeta && (
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${semanticMeta.color}`}>
                      <semanticMeta.icon size={9} />
                      {semanticMeta.label}
                    </span>
                  )}

                  {isPrimary && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-brand-primary/30 text-brand-primary bg-brand-primary/10 shrink-0">
                      ★ primary
                    </span>
                  )}

                  <span className="text-sm text-white/85 truncate">{col.name}</span>
                </div>

                {/* Right: stats */}
                <div className="flex items-center gap-3 text-xs text-white/40 shrink-0 ml-2">
                  {col.skew !== undefined && col.skew !== null && (
                    <SkewBadge skew={col.skew} />
                  )}
                  {col.mean !== undefined && col.mean !== null && (
                    <span>avg {Number(col.mean).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  )}
                  {col.cardinality !== undefined && (
                    <span className="text-white/25 font-mono text-[10px]">{col.cardinality} uniq</span>
                  )}
                  {col.null_percentage > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-400/70">
                      <AlertCircle size={11} />
                      {col.null_percentage.toFixed(1)}% null
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
