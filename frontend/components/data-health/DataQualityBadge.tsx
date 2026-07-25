"use client";

import React, { useState } from "react";
import { ShieldCheck, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DataQualityBadgeProps {
  healthScore?: number;
  duplicateRowsCount?: number;
  nullPct?: number;
  outlierColsCount?: number;
  issues?: string[];
}

export default function DataQualityBadge({
  healthScore = 96.5,
  duplicateRowsCount = 0,
  nullPct = 1.2,
  outlierColsCount = 1,
  issues = ["1 column contains statistical outliers"],
}: DataQualityBadgeProps) {
  const [open, setOpen] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 75) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-red-400 border-red-500/30 bg-red-500/10";
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${getScoreColor(
          healthScore
        )}`}
      >
        <ShieldCheck size={13} />
        <span>Data Health: {healthScore}%</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            className="absolute left-0 mt-2 z-50 w-72 p-3 rounded-2xl bg-[#12151e] border border-white/10 shadow-2xl space-y-2"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-400" /> Data Quality Audit
              </span>
              <span className="text-[10px] font-mono text-emerald-300 font-bold">{healthScore}% Grade A</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center py-1 font-mono">
              <div className="p-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-[9px] text-white/40 block">Duplicates</span>
                <span className="text-xs font-bold text-white">{duplicateRowsCount}</span>
              </div>
              <div className="p-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-[9px] text-white/40 block">Null Density</span>
                <span className="text-xs font-bold text-white">{nullPct}%</span>
              </div>
              <div className="p-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-[9px] text-white/40 block">Outliers</span>
                <span className="text-xs font-bold text-white">{outlierColsCount}</span>
              </div>
            </div>

            {issues.length > 0 && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <AlertCircle size={12} /> Proactive Health Advisories:
                </div>
                {issues.map((iss, idx) => (
                  <div key={idx} className="text-[10px] opacity-90 pl-3">
                    • {iss}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
