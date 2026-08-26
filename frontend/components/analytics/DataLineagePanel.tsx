"use client";

import React, { useState } from "react";
import {
  Workflow,
  Database,
  Cpu,
  PieChart,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Layers,
  Table,
  Zap,
  CheckCircle2,
  FileCode2,
  Search
} from "lucide-react";

interface DataLineagePanelProps {
  datasetId?: number | null;
  datasetName?: string;
  columns?: any[];
}

export function DataLineagePanel({
  datasetId,
  datasetName = "Active Dataset",
  columns = [],
}: DataLineagePanelProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>("node-ingestion");

  // Inferred lineage nodes from dataset schema
  const metrics = columns.filter((c: any) => c.role === "numeric" || c.dtype_category === "numeric" || c.role === "metric");
  const dimensions = columns.filter((c: any) => c.role === "categorical" || c.role === "dimension" || c.dtype_category === "string");
  const dates = columns.filter((c: any) => c.role === "temporal" || c.dtype_category === "datetime" || c.is_primary_date);

  const lineageNodes = [
    {
      id: "node-ingestion",
      title: "Raw CSV Ingestion",
      type: "source",
      icon: Database,
      badge: `${columns.length || 8} Columns Ingested`,
      color: "from-blue-600/20 to-cyan-600/20 border-cyan-500/40 text-cyan-300",
      details: {
        description: `Source data ingested into Polars vectorized engine. Total active columns: ${columns.length}.`,
        upstream: "External File Upload / MinIO S3",
        downstream: ["Polars Schema Parser", "Vectorized Aggregator"],
      },
    },
    {
      id: "node-schema",
      title: "Polars Schema Parser",
      type: "transform",
      icon: Table,
      badge: `${metrics.length} Metrics · ${dimensions.length} Dimensions`,
      color: "from-indigo-600/20 to-purple-600/20 border-indigo-500/40 text-indigo-300",
      details: {
        description: `Automated zero-copy data type inference. Classified ${metrics.length} metrics, ${dimensions.length} categorical dimensions, and ${dates.length} temporal series.`,
        upstream: ["Raw CSV Ingestion"],
        downstream: ["Calculated Fields Generator", "Anomaly Detector", "Visual Canvas"],
      },
    },
    {
      id: "node-calc",
      title: "AI Calculated Fields",
      type: "transform",
      icon: FileCode2,
      badge: "LLM Synthesized DAX / LOD",
      color: "from-amber-600/20 to-orange-600/20 border-amber-500/40 text-amber-300",
      details: {
        description: "Dynamic AI-generated vectorized expressions evaluating formulas across dataset rows in-memory.",
        upstream: ["Polars Schema Parser"],
        downstream: ["KPI Overview Strip", "Sensitivity Simulator"],
      },
    },
    {
      id: "node-spatial",
      title: "3D Geodesic Engine",
      type: "analytics",
      icon: Layers,
      badge: "WGS84 Arc & Towers",
      color: "from-emerald-600/20 to-teal-600/20 border-emerald-500/40 text-emerald-300",
      details: {
        description: "Projects regional location values to 3D heat points, density towers, and cross-border arc flows.",
        upstream: ["Polars Schema Parser"],
        downstream: ["3D Spatial Geo-Heatmap Panel"],
      },
    },
    {
      id: "node-tree",
      title: "SHAP Decomposition Tree",
      type: "analytics",
      icon: Workflow,
      badge: "Variance Splitter",
      color: "from-rose-600/20 to-pink-600/20 border-rose-500/40 text-rose-300",
      details: {
        description: "Splits metric variance hierarchically to isolate root causes and bottleneck drivers.",
        upstream: ["Polars Schema Parser"],
        downstream: ["Root Cause Decomposition Visual"],
      },
    },
    {
      id: "node-canvas",
      title: "Unified BI Dashboard Canvas",
      type: "output",
      icon: PieChart,
      badge: "Live Cross-Filtered Cards",
      color: "from-cyan-600/20 to-emerald-600/20 border-cyan-400 text-cyan-200",
      details: {
        description: "Unified cross-filtered dashboard canvas rendering live charts, Monte Carlo scenarios, and executive insights.",
        upstream: ["Polars Schema Parser", "AI Calculated Fields", "3D Geodesic Engine", "SHAP Decomposition Tree"],
        downstream: ["Executive Presentation Deck", "PDF Export"],
      },
    },
  ];

  const activeNodeData = lineageNodes.find((n) => n.id === selectedNode) || lineageNodes[0];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-lg transition-all duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 text-indigo-400 shadow-inner">
            <Workflow className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">
                Dynamic Data Lineage & Impact Analysis Map
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-semibold">
                Tableau Catalog / Power BI Lineage+ ⚡
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Trace end-to-end data flow from raw CSV ingestion $\rightarrow$ schema parsing $\rightarrow$ AI calculated fields $\rightarrow$ active visual widgets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Dependency Graph: Active ({lineageNodes.length} Nodes)</span>
        </div>
      </div>

      {/* DAG Architecture Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Flow Diagram */}
        <div className="lg:col-span-8 bg-slate-950/80 border border-slate-800 rounded-xl p-4 overflow-x-auto relative">
          <div className="text-[10px] font-mono text-slate-400 mb-3 flex items-center justify-between">
            <span>DATA PIPELINE IMPACT FLOW (Click any node to inspect dependencies)</span>
            <span className="text-cyan-400">← Source to Output →</span>
          </div>

          <div className="flex flex-col gap-4 min-w-[650px] relative py-2">
            {/* Level 1: Ingestion */}
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-mono text-slate-400 uppercase w-24 shrink-0">1. Ingestion</div>
              <div className="flex-1">
                <button
                  onClick={() => setSelectedNode("node-ingestion")}
                  className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition ${
                    selectedNode === "node-ingestion" ? "ring-2 ring-cyan-400 scale-[1.01]" : ""
                  } bg-gradient-to-r ${lineageNodes[0].color}`}
                >
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">{lineageNodes[0].title}</div>
                      <div className="text-[10px] opacity-80">{datasetName}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700">
                    {lineageNodes[0].badge}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex justify-center text-slate-600">
              <ArrowRight className="w-5 h-5 rotate-90" />
            </div>

            {/* Level 2: Schema Engine */}
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-mono text-slate-400 uppercase w-24 shrink-0">2. Schema</div>
              <div className="flex-1">
                <button
                  onClick={() => setSelectedNode("node-schema")}
                  className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition ${
                    selectedNode === "node-schema" ? "ring-2 ring-indigo-400 scale-[1.01]" : ""
                  } bg-gradient-to-r ${lineageNodes[1].color}`}
                >
                  <div className="flex items-center gap-3">
                    <Table className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">{lineageNodes[1].title}</div>
                      <div className="text-[10px] opacity-80">Polars In-Memory Vector Engine</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700">
                    {lineageNodes[1].badge}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex justify-center text-slate-600">
              <ArrowRight className="w-5 h-5 rotate-90" />
            </div>

            {/* Level 3: Transformations & AI Analytics */}
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-mono text-slate-400 uppercase w-24 shrink-0">3. Analytics</div>
              <div className="flex-1 grid grid-cols-3 gap-2">
                {lineageNodes.slice(2, 5).map((node) => {
                  const NodeIcon = node.icon;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node.id)}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition ${
                        selectedNode === node.id ? "ring-2 ring-cyan-400 scale-[1.01]" : ""
                      } bg-gradient-to-r ${node.color}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <NodeIcon className="w-4 h-4 shrink-0" />
                        <span className="font-bold text-xs truncate">{node.title}</span>
                      </div>
                      <span className="text-[9px] font-mono opacity-80 truncate">{node.badge}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center text-slate-600">
              <ArrowRight className="w-5 h-5 rotate-90" />
            </div>

            {/* Level 4: Dashboard Output Canvas */}
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-mono text-slate-400 uppercase w-24 shrink-0">4. Output</div>
              <div className="flex-1">
                <button
                  onClick={() => setSelectedNode("node-canvas")}
                  className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition ${
                    selectedNode === "node-canvas" ? "ring-2 ring-emerald-400 scale-[1.01]" : ""
                  } bg-gradient-to-r ${lineageNodes[5].color}`}
                >
                  <div className="flex items-center gap-3">
                    <PieChart className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">{lineageNodes[5].title}</div>
                      <div className="text-[10px] opacity-80">Interactive Dashboard & Slide Deck Generator</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700">
                    {lineageNodes[5].badge}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Node Inspector Sidebar */}
        <div className="lg:col-span-4 bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Node Inspector & Impact Analysis
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase">Selected Node</div>
              <div className="text-cyan-300 font-bold text-sm">{activeNodeData.title}</div>
              <div className="text-slate-300 text-[11px] leading-relaxed mt-1">
                {activeNodeData.details.description}
              </div>
            </div>

            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <ArrowRight className="w-3 h-3 text-indigo-400 rotate-180" /> Upstream Dependencies
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.isArray(activeNodeData.details.upstream) ? (
                  activeNodeData.details.upstream.map((dep, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-[10px] text-indigo-300">
                      {dep}
                    </span>
                  ))
                ) : (
                  <span className="px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-[10px] text-indigo-300">
                    {activeNodeData.details.upstream}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <ArrowRight className="w-3 h-3 text-emerald-400" /> Downstream Impact
              </div>
              <div className="flex flex-wrap gap-1">
                {activeNodeData.details.downstream.map((dep, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-[10px] text-emerald-300">
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
