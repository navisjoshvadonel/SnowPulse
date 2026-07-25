"use client";

import React, { useState } from "react";
import { Code2, HelpCircle, Terminal, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CalculationLineagePopoverProps {
  metricName: string;
  polarsQuery?: string;
  sqlQuery?: string;
}

export default function CalculationLineagePopover({
  metricName,
  polarsQuery = `df.group_by('dimension').agg(pl.col('${metricName}').sum())`,
  sqlQuery = `SELECT dimension, SUM(${metricName}) FROM current_dataset GROUP BY dimension;`,
}: CalculationLineagePopoverProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(sqlQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 text-white/40 hover:text-cyan-400 transition-colors cursor-pointer"
        title="View Logic & Query Lineage"
      >
        <Code2 size={13} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            className="absolute left-0 mt-1 z-50 w-80 p-3 rounded-xl bg-[#12151e] border border-white/10 shadow-2xl space-y-2.5"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Terminal size={12} className="text-cyan-400" /> Calculation Lineage: {metricName}
              </span>
              <button onClick={copyCode} className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300">
                {copied ? "Copied SQL" : "Copy SQL"}
              </button>
            </div>

            <div>
              <span className="text-[9px] font-mono text-white/40 uppercase">Polars Streaming Execution</span>
              <pre className="mt-1 p-2 rounded-lg bg-black/40 text-[10px] font-mono text-cyan-300 overflow-x-auto border border-white/5">
                {polarsQuery}
              </pre>
            </div>

            <div>
              <span className="text-[9px] font-mono text-white/40 uppercase">Standard SQL Equivalent</span>
              <pre className="mt-1 p-2 rounded-lg bg-black/40 text-[10px] font-mono text-purple-300 overflow-x-auto border border-white/5">
                {sqlQuery}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
