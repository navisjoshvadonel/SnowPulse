"use client";

import React, { useState } from "react";
import { Code2, Terminal, Check, Copy, X } from "lucide-react";
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
        className="p-1 text-white/40 hover:text-cyan-400 transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        title="View Logic & Query Lineage"
        aria-label={`View logic and query lineage for ${metricName}`}
        aria-expanded={open}
        aria-haspopup="dialog"
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
            role="dialog"
            aria-label={`Calculation lineage for ${metricName}`}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Terminal size={12} className="text-cyan-400" /> Calculation Lineage: {metricName}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyCode}
                  aria-label="Copy SQL query to clipboard"
                  className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 rounded px-1 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={11} className="text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close lineage popover"
                  className="p-0.5 text-white/40 hover:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
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
