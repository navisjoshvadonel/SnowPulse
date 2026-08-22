"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { apiService } from "@/services/api";

interface OutlierAnomalyPanelProps {
  datasetId: number;
}

export default function OutlierAnomalyPanel({ datasetId }: OutlierAnomalyPanelProps) {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchSignals() {
      try {
        const res = await apiService.getDatasetSignals(datasetId);
        if (res.ok) {
          const data = await res.json();
          setSignals(data.signals || []);
        }
      } catch (err) {
        console.error("Failed to fetch signals:", err);
      } finally {
        setLoading(false);
      }
    }
    if (datasetId) fetchSignals();
  }, [datasetId]);

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
          <ShieldAlert size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Outliers & Anomaly Signals</h3>
          <p className="text-xs text-slate-400">Deterministic z-score & interquartile range detection</p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : signals.length === 0 ? (
        <div className="py-8 text-center bg-slate-950/30 rounded-xl border border-slate-800/60 p-4">
          <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-300">Zero Anomalies Detected</p>
          <p className="text-[11px] text-slate-500 mt-1">All numeric values fall within 3-sigma statistical thresholds.</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {signals.map((sig: any, idx: number) => (
            <div
              key={idx}
              className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex items-start gap-3 hover:border-amber-500/30 transition-colors"
            >
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 capitalize">
                    {sig.column || sig.type || "Statistical Flag"}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                    Impact: {sig.impact || "Medium"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{sig.description || sig.detail || JSON.stringify(sig)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
