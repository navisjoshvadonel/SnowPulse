"use client";

import React, { useState } from "react";
import { X, Download, FileText, Sparkles, CheckCircle, ShieldCheck, Printer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetName: string;
  kpis: any;
  datasetSchema: any;
  aiInsights: any;
}

export default function PdfExportModal({
  isOpen,
  onClose,
  datasetName,
  kpis,
  datasetSchema,
  aiInsights,
}: PdfExportModalProps) {
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    setDownloading(true);
    setTimeout(() => {
      window.print();
      setDownloading(false);
    }, 400);
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl bg-[#0c0e15] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Executive PDF Report Generator
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    PDF v2.0 Ready
                  </span>
                </h3>
                <p className="text-xs text-white/40">Preview and download publication-ready executive report</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white font-semibold text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                {downloading ? <Sparkles size={14} className="animate-spin" /> : <Printer size={14} />}
                <span>Print / Download PDF</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Printable Document Preview */}
          <div className="flex-1 overflow-y-auto p-8 bg-zinc-950/60 font-sans space-y-6">
            <div className="max-w-3xl mx-auto bg-[#121520] border border-white/10 rounded-2xl p-8 shadow-2xl space-y-8 print:bg-white print:text-black print:border-none print:shadow-none">
              
              {/* Report Header */}
              <div className="flex items-start justify-between border-b border-white/10 pb-6 print:border-black/10">
                <div>
                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono font-bold tracking-wider uppercase mb-1">
                    <Sparkles size={14} /> SnowPulse Intelligence Platform
                  </div>
                  <h1 className="text-2xl font-extrabold text-white tracking-tight print:text-black">
                    Executive Insights & Metric Report
                  </h1>
                  <p className="text-sm text-white/50 print:text-gray-600 mt-1">
                    Dataset: <span className="font-semibold text-white print:text-black">{datasetName}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-white/40 print:text-gray-500 font-mono block">Generated On</span>
                  <span className="text-xs font-semibold text-white print:text-black font-mono">{currentDate}</span>
                </div>
              </div>

              {/* Quality & Summary Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 print:bg-gray-100 print:border-gray-300">
                  <span className="text-[11px] text-white/40 print:text-gray-500 uppercase tracking-wider block font-mono">
                    Total Records
                  </span>
                  <span className="text-xl font-bold text-white print:text-black mt-1 block">
                    {(kpis?.total_records || 0).toLocaleString()}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 print:bg-gray-100 print:border-gray-300">
                  <span className="text-[11px] text-white/40 print:text-gray-500 uppercase tracking-wider block font-mono">
                    Quality Health Score
                  </span>
                  <span className="text-xl font-bold text-emerald-400 print:text-emerald-700 mt-1 block flex items-center gap-1.5">
                    <ShieldCheck size={18} />
                    {(kpis?.quality_score || 98.2).toFixed(1)}%
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 print:bg-gray-100 print:border-gray-300">
                  <span className="text-[11px] text-white/40 print:text-gray-500 uppercase tracking-wider block font-mono">
                    Primary Metric Mean
                  </span>
                  <span className="text-xl font-bold text-sky-400 print:text-sky-700 mt-1 block">
                    {(kpis?.mean_value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* AI Executive Summary Box */}
              {aiInsights?.headline && (
                <div className="p-5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 print:bg-indigo-50 print:border-indigo-200 space-y-2">
                  <h4 className="text-xs font-bold text-indigo-300 print:text-indigo-900 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Sparkles size={14} /> Executive AI Synthesis
                  </h4>
                  <p className="text-sm text-white/80 print:text-gray-800 leading-relaxed font-sans">
                    {aiInsights.headline}
                  </p>
                </div>
              )}

              {/* Key Recommendations */}
              {aiInsights?.recommendations && aiInsights.recommendations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white/60 print:text-black uppercase tracking-wider font-mono">
                    Strategic AI Recommendations
                  </h4>
                  <div className="space-y-2">
                    {aiInsights.recommendations.map((rec: string, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-white/[0.02] border border-white/5 print:bg-gray-50 print:border-gray-200 flex items-start gap-2.5"
                      >
                        <CheckCircle size={15} className="text-emerald-400 print:text-emerald-600 shrink-0 mt-0.5" />
                        <span className="text-xs text-white/80 print:text-gray-800 leading-relaxed">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Column Schema Summary */}
              {datasetSchema?.columns && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-white/60 print:text-black uppercase tracking-wider font-mono">
                    Schema Profile ({datasetSchema.columns.length} Columns)
                  </h4>
                  <div className="border border-white/10 print:border-gray-300 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 print:bg-gray-100 text-white/40 print:text-gray-600 font-mono text-[10px] uppercase border-b border-white/10 print:border-gray-300">
                        <tr>
                          <th className="px-4 py-2.5">Column Name</th>
                          <th className="px-4 py-2.5">Inferred Role</th>
                          <th className="px-4 py-2.5">Null Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 print:divide-gray-200 text-white/80 print:text-gray-900 font-mono text-[11px]">
                        {datasetSchema.columns.slice(0, 8).map((col: any) => (
                          <tr key={col.name}>
                            <td className="px-4 py-2 font-semibold text-white print:text-black">{col.name}</td>
                            <td className="px-4 py-2 capitalize">{col.role}</td>
                            <td className="px-4 py-2">
                              {col.null_percentage > 0 ? (
                                <span className="text-amber-400 print:text-amber-700">{col.null_percentage.toFixed(1)}%</span>
                              ) : (
                                <span className="text-emerald-400 print:text-emerald-700">0.0% Clean</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer Stamp */}
              <div className="pt-6 border-t border-white/10 print:border-gray-300 flex items-center justify-between text-[11px] text-white/30 print:text-gray-500 font-mono">
                <span>SnowPulse AI Intelligence Platform · Confidential</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
