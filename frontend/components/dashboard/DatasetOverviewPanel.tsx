"use client";

import React from "react";
import { Hash, Calendar, Tag, MapPin, AlertCircle } from "lucide-react";

interface ColumnInfo {
  name: string;
  null_count: number;
  role: "metric" | "date" | "category" | "geo" | "numeric" | "categorical";
  min?: number;
  max?: number;
  mean?: number;
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

const ROLE_ICON: Record<ColumnInfo["role"], React.ElementType> = {
  metric: Hash,
  numeric: Hash,
  date: Calendar,
  category: Tag,
  categorical: Tag,
  geo: MapPin,
};

const ROLE_COLOR: Record<ColumnInfo["role"], string> = {
  metric: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  numeric: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  date: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  category: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  categorical: "text-white/60 bg-white/5 border-white/10",
  geo: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export default function DatasetOverviewPanel({ schema, loading }: DatasetOverviewPanelProps) {
  if (loading || !schema) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-brand-surface/40 border border-white/5 rounded-xl" />
        <div className="h-64 bg-brand-surface/40 border border-white/5 rounded-xl" />
      </div>
    );
  }

  const summaryCards = [
    { label: "Rows", value: schema.row_count.toLocaleString() },
    { label: "Columns", value: schema.column_count.toString() },
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
      <div>
        <h2 className="text-lg font-semibold text-white">{schema.name}</h2>
        {schema.description && (
          <p className="text-sm text-white/50 mt-1">{schema.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className="bg-brand-surface/40 border border-white/5 rounded-xl p-4"
          >
            <div className="text-xs text-white/40 mb-1">{c.label}</div>
            <div className="text-sm font-semibold text-white truncate" title={c.value}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-brand-surface/40 border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Columns</h3>
        </div>
        <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto">
          {schema.columns.map((col) => {
            const Icon = ROLE_ICON[col.role];
            return (
              <div
                key={col.name}
                className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${ROLE_COLOR[col.role]}`}
                  >
                    <Icon size={11} />
                    {col.role}
                  </span>
                  <span className="text-sm text-white/85 truncate">{col.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/40 shrink-0">
                  {col.mean !== undefined && (
                    <span>avg {col.mean.toLocaleString()}</span>
                  )}
                  {col.null_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-400/70">
                      <AlertCircle size={11} />
                      {col.null_count} nulls
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
