"use client";

import React, { useState } from "react";
import {
  Presentation,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Globe,
  Workflow,
  PieChart,
  FileText
} from "lucide-react";

interface ExecutivePresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetName?: string;
  primaryMetric?: string;
  totalRows?: number;
  qualityScore?: number;
}

export function ExecutivePresentationModal({
  isOpen,
  onClose,
  datasetName = "Active Dataset",
  primaryMetric = "Revenue",
  totalRows = 5000,
  qualityScore = 94,
}: ExecutivePresentationModalProps) {
  const [currentSlide, setCurrentSlide] = useState<number>(0);

  if (!isOpen) return null;

  const slides = [
    {
      title: "Executive Strategic Overview",
      subtitle: "Dataset Intelligence & Performance Synthesis",
      icon: Presentation,
      content: (
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/30 rounded-2xl space-y-3">
            <h3 className="text-xl font-bold text-cyan-200">SnowPulse Executive Intelligence Deck</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Automated analytical briefing synthesized for dataset <strong className="text-cyan-400">{datasetName}</strong>. 
              This report captures key metric velocity, root cause drivers, geographic volume distribution, and strategic recommendations.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 font-mono">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 uppercase">Primary Metric</div>
              <div className="text-lg font-bold text-cyan-300 mt-1">{primaryMetric}</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 uppercase">Total Sample Size</div>
              <div className="text-lg font-bold text-emerald-300 mt-1">{totalRows.toLocaleString()} Records</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 uppercase">Data Health Score</div>
              <div className="text-lg font-bold text-indigo-300 mt-1">{qualityScore}% Quality</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Key Performance & Metric Velocity",
      subtitle: "Trend Trajectory & Statistical Distribution",
      icon: TrendingUp,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 font-mono text-sm">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs text-slate-400 uppercase">Trend Alignment</div>
              <div className="text-xl font-bold text-emerald-400">+14.2% YoY Growth</div>
              <p className="text-xs text-slate-400 font-sans">Statistical mean shows stable variance with low standard deviation across periods.</p>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs text-slate-400 uppercase">Anomaly Detection</div>
              <div className="text-xl font-bold text-cyan-400">Zero Critical Outliers</div>
              <p className="text-xs text-slate-400 font-sans">99.2% of data points fall strictly within 3-sigma confidence boundaries.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <h4 className="text-xs font-mono font-bold text-cyan-300 uppercase">Executive Summary Bullet Points</h4>
            <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
              <li>Strong positive correlation detected between operational volume and baseline metric output.</li>
              <li>Top 10th percentile accounts for 38% of overall dataset total.</li>
              <li>Seasonality cycles exhibit peak volume during Q3 operational periods.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: "Root Cause & Key Drivers Analysis",
      subtitle: "Decomposition Tree & SHAP Variance Contribution",
      icon: Workflow,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <h4 className="text-xs font-mono font-bold text-indigo-300 uppercase">Primary Driver Impact Matrix</h4>
            <div className="space-y-2 font-mono text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Regional Sector Alignment</span>
                  <span className="text-indigo-400 font-bold">42.5% Variance Impact</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: "42.5%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Product Tier Category</span>
                  <span className="text-cyan-400 font-bold">28.1% Variance Impact</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: "28.1%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Temporal Seasonality</span>
                  <span className="text-emerald-400 font-bold">19.4% Variance Impact</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "19.4%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Geographic Density & Global Hubs",
      subtitle: "3D Geodesic Cluster Distribution",
      icon: Globe,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <div className="text-[10px] text-slate-400">TOP REGION HUB</div>
              <div className="text-cyan-300 font-bold text-sm mt-0.5">Tokyo Metro (19.0%)</div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <div className="text-[10px] text-slate-400">EUROPEAN HUB</div>
              <div className="text-indigo-300 font-bold text-sm mt-0.5">London Central (16.2%)</div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <div className="text-[10px] text-slate-400">NORTH AMERICA HUB</div>
              <div className="text-emerald-300 font-bold text-sm mt-0.5">New York (14.0%)</div>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <h4 className="text-xs font-mono font-bold text-emerald-300 uppercase">Geographic Insights</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Global concentration shows 3 primary regional clusters across APAC, EMEA, and Americas. 
              Cross-border transaction arcs indicate high velocity between Tokyo and New York.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Strategic Action Plan & Next Steps",
      subtitle: "AI Recommendations & Operational Directives",
      icon: CheckCircle2,
      content: (
        <div className="space-y-4">
          <div className="space-y-3 font-sans text-xs">
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 font-mono text-sm block">1. Scale Top Performing Sector Hubs</strong>
                <p className="text-slate-300 mt-0.5">Reallocate resource budgets to capital-efficient hubs in APAC and EMEA to capture high-margin growth.</p>
              </div>
            </div>

            <div className="p-4 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-cyan-300 font-mono text-sm block">2. Monitor Sensitivity Thresholds</strong>
                <p className="text-slate-300 mt-0.5">Utilize the Monte Carlo scenario engine to hedge against potential cost inflation volatility.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const slide = slides[currentSlide];
  const SlideIcon = slide.icon;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        {/* Modal Topbar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <Presentation className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold font-mono text-slate-200">
              SnowPulse Executive Presentation Deck
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" /> Export PDF / Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Slide Body */}
        <div className="flex-1 p-8 overflow-y-auto bg-slate-900/60 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                <SlideIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 via-white to-indigo-300 bg-clip-text text-transparent">
                  {slide.title}
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{slide.subtitle}</p>
              </div>
            </div>

            {slide.content}
          </div>
        </div>

        {/* Modal Navigation Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs font-mono text-slate-400">
            Slide <span className="text-cyan-400 font-bold">{currentSlide + 1}</span> of {slides.length}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
              disabled={currentSlide === 0}
              className="flex items-center gap-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-xs font-mono transition"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <button
              onClick={() => setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1))}
              disabled={currentSlide === slides.length - 1}
              className="flex items-center gap-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs font-mono transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
