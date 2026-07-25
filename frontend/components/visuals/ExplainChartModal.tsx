"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Lightbulb, CheckCircle2 } from "lucide-react";

interface ExplainChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartTitle: string;
  explanation?: string;
}

export default function ExplainChartModal({
  isOpen,
  onClose,
  chartTitle,
  explanation = "This chart illustrates key distributional variance across primary dataset segments. Peak values indicate high concentration in top categories, while minor dips correspond to seasonal intake shifts.",
}: ExplainChartModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-[#12151e] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Sparkles className="text-purple-400" size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">AI Visual Explanation</h3>
                <p className="text-[11px] font-mono text-purple-300">{chartTitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/5">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Lightbulb size={14} className="text-amber-400" /> Key Takeaway
            </div>
            <p className="text-xs text-white/75 leading-relaxed font-sans">{explanation}</p>
          </div>

          <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 font-mono">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-400" /> Statistical confidence 98%
            </span>
            <span>Gemini 3.6 Flash Engine</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
