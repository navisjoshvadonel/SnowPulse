"use client";

import React, { useState } from "react";
import {
  Zap,
  Radio,
  Sparkles,
  ShieldCheck,
  Download,
  Brain,
  Sliders,
  CheckCircle2,
  Cpu,
  BarChart3,
  Activity,
  Layers,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type AiPersona = "financial" | "infrastructure" | "growth" | "anomaly";

interface AutoAiControlBarProps {
  onRunPipeline: () => void;
  onToggleStream: () => void;
  isStreaming: boolean;
  onHealData: () => void;
  onAutoForecast: () => void;
  onExportPdf: () => void;
  activePersona: AiPersona;
  onSelectPersona: (persona: AiPersona) => void;
  datasetName: string;
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStepName: string;
  scenarioMultiplier: number;
  onScenarioChange: (val: number) => void;
}

export default function AutoAiControlBar({
  onRunPipeline,
  onToggleStream,
  isStreaming,
  onHealData,
  onAutoForecast,
  onExportPdf,
  activePersona,
  onSelectPersona,
  datasetName,
  isAnalyzing,
  analysisProgress,
  analysisStepName,
  scenarioMultiplier,
  onScenarioChange,
}: AutoAiControlBarProps) {
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);

  const personas: { id: AiPersona; label: string; icon: string; desc: string }[] = [
    { id: "growth", label: "Executive Growth Strategist", icon: "🚀", desc: "Maximizes CAGR, conversion rates, and revenue density" },
    { id: "financial", label: "Financial & Cost Architect", icon: "💎", desc: "Optimizes MRR, ARR, margin variance, and unit economics" },
    { id: "infrastructure", label: "Infrastructure Reliability Sentinel", icon: "⚡", desc: "Monitors query latency, compute load, and throughput" },
    { id: "anomaly", label: "Autonomous Risk & Outlier Agent", icon: "🛡️", desc: "Detects statistical z-score anomalies & fraud signals" },
  ];

  const currentPersona = personas.find((p) => p.id === activePersona) || personas[0];

  return (
    <div className="mb-6 space-y-3">
      {/* Primary HUD Toolbar Container */}
      <div
        className="relative rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xl backdrop-blur-xl transition-all duration-300"
        style={{
          background: "linear-gradient(135deg, rgba(18, 22, 34, 0.85) 0%, rgba(13, 16, 26, 0.95) 100%)",
          border: "1px solid rgba(80, 99, 244, 0.2)",
          boxShadow: "0 12px 35px -10px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        }}
      >
        {/* Left Ticker Status & Active Dataset Info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-primary/30 to-brand-accent/20 border border-brand-primary/40 flex items-center justify-center text-brand-accent shadow-inner">
              <Brain size={20} className={isAnalyzing ? "animate-pulse text-brand-primary" : "text-brand-accent"} />
            </div>
            {isStreaming && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Enterprise AI Data Intelligence OS
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Activity size={10} className="animate-pulse" /> PRODUCTION READY
              </span>
            </div>
            <p className="text-[11px] text-white/45 flex items-center gap-1 mt-0.5">
              <span>Dataset:</span>
              <span className="font-semibold text-white/80">{datasetName}</span>
              <span className="text-white/20">•</span>
              <span>Model Engine:</span>
              <span className="text-brand-accent font-mono font-medium">Gemini 3.6 Flash + AutoML</span>
            </p>
          </div>
        </div>

        {/* Middle Quick Automation Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* 1. Run Full Auto-Analysis Pipeline */}
          <button
            onClick={onRunPipeline}
            disabled={isAnalyzing}
            className="relative overflow-hidden group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-lg"
            style={{
              background: "linear-gradient(90deg, #5063f4 0%, #7c3aed 100%)",
              boxShadow: "0 4px 15px rgba(80, 99, 244, 0.35)",
            }}
          >
            <Zap size={14} className={isAnalyzing ? "animate-spin" : "group-hover:scale-110 transition-transform"} />
            <span>{isAnalyzing ? "Analyzing Dataset..." : "⚡ Run Auto-Analysis"}</span>
          </button>

          {/* 2. Live Pulse Data Stream Toggle */}
          <button
            onClick={onToggleStream}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
              isStreaming
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Radio size={14} className={isStreaming ? "animate-pulse text-emerald-400" : ""} />
            <span>{isStreaming ? "Live Pulse: ON" : "Live Stream"}</span>
          </button>

          {/* 3. Auto AutoML Forecast */}
          <button
            onClick={onAutoForecast}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all cursor-pointer"
          >
            <Sparkles size={14} className="text-cyan-400" />
            <span>Auto-Forecast</span>
          </button>

          {/* 4. Self-Heal Dataset */}
          <button
            onClick={onHealData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-all cursor-pointer"
          >
            <ShieldCheck size={14} className="text-purple-400" />
            <span>Self-Heal Data</span>
          </button>

          {/* 5. Scenario Simulation */}
          <div className="relative">
            <button
              onClick={() => setShowScenarioMenu(!showScenarioMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <Sliders size={14} className="text-amber-400" />
              <span>Scenario: {(scenarioMultiplier * 100).toFixed(0)}%</span>
            </button>

            {showScenarioMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-xl p-3 z-30 shadow-2xl backdrop-blur-xl"
                style={{
                  background: "#121624",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                }}
              >
                <p className="text-[10px] uppercase font-bold text-amber-400 tracking-wider mb-2">
                  Interactive Projection Scenario
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: "Normal Baseline (100%)", val: 1.0 },
                    { label: "Optimistic Growth (+25%)", val: 1.25 },
                    { label: "Hyper-Growth Scale (+50%)", val: 1.5 },
                    { label: "Stress Test Downturn (-20%)", val: 0.8 },
                  ].map((s) => (
                    <button
                      key={s.val}
                      onClick={() => {
                        onScenarioChange(s.val);
                        setShowScenarioMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                        scenarioMultiplier === s.val
                          ? "bg-amber-500/20 text-amber-200 font-semibold"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{s.label}</span>
                      {scenarioMultiplier === s.val && <CheckCircle2 size={12} className="text-amber-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. AI Agent Persona Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPersonaMenu(!showPersonaMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
            >
              <span>{currentPersona.icon}</span>
              <span className="hidden sm:inline">{currentPersona.label.split(" ")[0]}</span>
              <ChevronRight size={12} className="text-white/40" />
            </button>

            {showPersonaMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-64 rounded-xl p-2 z-30 shadow-2xl backdrop-blur-xl"
                style={{
                  background: "#121624",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider px-2 py-1 mb-1">
                  Select AI Analyst Agent Persona
                </p>
                <div className="space-y-1">
                  {personas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectPersona(p.id);
                        setShowPersonaMenu(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg transition-all ${
                        activePersona === p.id
                          ? "bg-brand-primary/20 text-white border border-brand-primary/40"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                      </div>
                      <p className="text-[10px] text-white/40 mt-0.5 line-clamp-1">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 7. Export Report */}
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            title="Export Production Executive Deck"
          >
            <Download size={14} />
            <span className="hidden md:inline">Export Deck</span>
          </button>
        </div>
      </div>

      {/* Animated Automated Analysis Progress Bar */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl p-3.5 overflow-hidden"
            style={{
              background: "rgba(18, 22, 34, 0.9)",
              border: "1px solid rgba(80, 99, 244, 0.3)",
            }}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-brand-accent flex items-center gap-1.5">
                <Cpu size={14} className="animate-spin text-brand-primary" />
                {analysisStepName}
              </span>
              <span className="font-mono text-white/70">{analysisProgress}%</span>
            </div>

            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, #5063f4 0%, #06b6d4 50%, #10b981 100%)",
                  width: `${analysisProgress}%`,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
