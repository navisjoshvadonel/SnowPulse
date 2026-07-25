"use client";

import React from "react";
import { BookOpen, Sparkles, X, ExternalLink, Zap, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DocsChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DocsChangelogModal({ isOpen, onClose }: DocsChangelogModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl rounded-2xl p-6 overflow-hidden relative max-h-[85vh] flex flex-col"
          style={{ background: "#12151e", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Documentation & Release Notes</h3>
                <p className="text-xs text-white/40">Latest feature updates, API specs, and platform capabilities.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>

          {/* Release Highlights */}
          <div className="overflow-y-auto space-y-4 pr-1 flex-1">
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/20 via-indigo-900/20 to-blue-900/20 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-purple-400" /> SnowPulse v2.4.0 Release
                </span>
                <span className="text-[10px] font-mono text-purple-300/60">July 2026</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed mb-3">
                Introduced schema-agnostic dynamic analytics, non-blocking statistical descriptions, and interactive multi-environment switcher.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2 text-xs text-white/80">
                  <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Dynamic Profiler:</strong> Automatically detects numeric metrics, geo distribution, and target features across any CSV/Excel upload.</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/80">
                  <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Conditional ML Forecasting:</strong> Enables prediction panel specifically when continuous numeric target classes are identified.</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/80">
                  <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Multi-Tenant Envs:</strong> Instant context-switching between Production, Staging, and Local-Dev workspaces.</span>
                </div>
              </div>
            </div>

            {/* Quick Doc Links */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <a
                href="https://github.com/navisjoshvadonel/SnowPulse"
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">API Reference</p>
                  <p className="text-[10px] text-white/40">REST & FastAPI Endpoints</p>
                </div>
                <ExternalLink size={14} className="text-white/30 group-hover:text-purple-400 transition-colors" />
              </a>

              <a
                href="https://github.com/navisjoshvadonel/SnowPulse"
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">Architecture Guide</p>
                  <p className="text-[10px] text-white/40">Polars + ECharts Stack</p>
                </div>
                <ExternalLink size={14} className="text-white/30 group-hover:text-purple-400 transition-colors" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
