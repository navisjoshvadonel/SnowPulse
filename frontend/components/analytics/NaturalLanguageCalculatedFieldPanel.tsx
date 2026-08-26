"use client";

import React, { useState } from "react";
import {
  Calculator,
  Sparkles,
  Code2,
  Table,
  Check,
  AlertCircle,
  Copy,
  Layers,
  TrendingUp,
  Sliders,
  Terminal,
  Zap,
  Plus
} from "lucide-react";
import { fetchAPI } from "@/services/api";

interface CalculatedFieldResult {
  status: string;
  field_name: string;
  calc_type: string;
  prompt: string;
  inferred_dtype: string;
  formula_code: string;
  dax_code: string;
  lod_code: string;
  ai_explanation: string;
  target_metric: string;
  stats: Record<string, any>;
  preview_sample: Array<Record<string, any>>;
  num_rows_affected: number;
}

interface NaturalLanguageCalculatedFieldPanelProps {
  datasetId?: number | null;
  datasetName?: string;
  numericColumns?: string[];
  onColumnCreated?: (newColumnName: string, dtype: string) => void;
}

const FORMULA_PRESETS = [
  {
    label: "7-Day Rolling Average",
    prompt: "Calculate 7-day rolling average of revenue",
    icon: "📈",
    desc: "Smoothes short-term variance into a 7-day moving trend",
  },
  {
    label: "% Share of Grand Total",
    prompt: "Revenue as percent of total",
    icon: "📊",
    desc: "Calculates individual row percentage contribution to aggregate total",
  },
  {
    label: "Z-Score Normalization",
    prompt: "Z-score of revenue",
    icon: "🎯",
    desc: "Standardizes metric values into standard deviation units from mean",
  },
  {
    label: "Profit Margin %",
    prompt: "Profit margin between Revenue and Cost",
    icon: "💰",
    desc: "Calculates percentage variance ratio between primary metric and costs",
  },
  {
    label: "Performance Tier Categorization",
    prompt: "Performance tier category based on revenue",
    icon: "🏷️",
    desc: "Bins rows into High, Medium, or Low performance tiers based on dataset mean",
  },
  {
    label: "Log Distribution Compress",
    prompt: "Log transform of revenue",
    icon: "📈",
    desc: "Applies log1p transformation to reduce heavy right-tail skewness",
  },
];

export function NaturalLanguageCalculatedFieldPanel({
  datasetId,
  datasetName = "Active Dataset",
  numericColumns = [],
  onColumnCreated,
}: NaturalLanguageCalculatedFieldPanelProps) {
  const [promptInput, setPromptInput] = useState<string>("Calculate 7-day rolling average of revenue");
  const [customFieldName, setCustomFieldName] = useState<string>("");
  const [activeCodeTab, setActiveCodeTab] = useState<"polars" | "dax" | "lod">("polars");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CalculatedFieldResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [appliedToSchema, setAppliedToSchema] = useState<boolean>(false);

  const handleGenerateField = async (overridePrompt?: string) => {
    const finalPrompt = overridePrompt || promptInput;
    if (!finalPrompt.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setAppliedToSchema(false);

    // Client-side fallback computation if backend datasetId is missing
    if (!datasetId) {
      setTimeout(() => {
        const mockResult: CalculatedFieldResult = {
          status: "success",
          field_name: customFieldName.trim() || "Revenue_7D_RollingAvg",
          calc_type: "rolling_window",
          prompt: finalPrompt,
          inferred_dtype: "numeric",
          formula_code: `pl.col('Revenue').rolling_mean(window_size=7)`,
          dax_code: `CALCULATE(AVERAGE('${datasetName}'[Revenue]), DATESINPERIOD(Calendar[Date], LASTDATE(Calendar[Date]), -7, DAY))`,
          lod_code: `WINDOW_AVG(SUM([Revenue]), -6, 0)`,
          ai_explanation: `Computes a trailing 7-period moving average of 'Revenue' to smooth out volatility and isolate underlying operational growth trends.`,
          target_metric: "Revenue",
          stats: {
            min: 104.5,
            max: 980.2,
            mean: 452.8,
            std: 142.1,
            null_count: 0,
          },
          preview_sample: [
            { Date: "2026-01-01", Region: "North", Revenue: 100, Revenue_7D_RollingAvg: 100.0 },
            { Date: "2026-01-02", Region: "North", Revenue: 150, Revenue_7D_RollingAvg: 125.0 },
            { Date: "2026-01-03", Region: "South", Revenue: 200, Revenue_7D_RollingAvg: 150.0 },
            { Date: "2026-01-04", Region: "South", Revenue: 250, Revenue_7D_RollingAvg: 175.0 },
            { Date: "2026-01-05", Region: "East", Revenue: 300, Revenue_7D_RollingAvg: 200.0 },
          ],
          num_rows_affected: 1250,
        };
        setResult(mockResult);
        setLoading(false);
      }, 400);
      return;
    }

    try {
      const resp = await fetchAPI(`/api/datasets/${datasetId}/calculated-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          field_name: customFieldName.trim() || undefined,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
      } else {
        const err = await resp.json();
        setErrorMsg(err.detail || "Failed to generate calculated field");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Error connecting to calculation engine");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleApplyToCanvas = () => {
    if (!result) return;
    setAppliedToSchema(true);
    if (onColumnCreated) {
      onColumnCreated(result.field_name, result.inferred_dtype);
    }
    setTimeout(() => setAppliedToSchema(false), 2500);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-lg transition-all duration-300">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-inner">
            <Calculator className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-300 via-purple-200 to-cyan-300 bg-clip-text text-transparent">
                🧮 AI-Powered Natural Language Calculated Fields
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-semibold">
                DAX / LOD Generator ⚡
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Type plain-English instructions to generate vectorized Polars formulas, Power BI DAX, and Tableau LOD expressions
            </p>
          </div>
        </div>
      </div>

      {/* Preset Formula Chips */}
      <div className="mb-4">
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-amber-400" /> Popular Calculation Presets:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {FORMULA_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPromptInput(preset.prompt);
                handleGenerateField(preset.prompt);
              }}
              className="flex flex-col items-start p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-purple-500/40 hover:bg-purple-950/20 text-left transition group"
            >
              <span className="text-xs font-semibold text-slate-200 group-hover:text-purple-300 flex items-center gap-1">
                <span>{preset.icon}</span> {preset.label}
              </span>
              <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{preset.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Formula Builder Form */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-8 space-y-1">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Natural Language Calculation Prompt</span>
              <span className="text-[10px] font-mono text-purple-400">e.g. "Calculate 7-day rolling average of revenue"</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Describe your calculated metric in plain English..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 pl-9 pr-4 py-2.5 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                onKeyDown={(e) => e.key === "Enter" && handleGenerateField()}
              />
              <Sparkles className="w-4 h-4 text-purple-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Virtual Column Name <span className="text-slate-500 text-[10px]">(Optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customFieldName}
                onChange={(e) => setCustomFieldName(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 px-3 py-2.5 font-mono focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={() => handleGenerateField()}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg transition whitespace-nowrap disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Code2 className="w-4 h-4" />
                )}
                <span>{loading ? "Computing..." : "Generate"}</span>
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-lg flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Calculation Results Section */}
      {result && (
        <div className="space-y-4 animate-fadeIn">
          {/* Summary Metric Strip & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 font-mono text-xs font-bold text-purple-300">
                Column: {result.field_name}
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 font-mono text-xs text-cyan-300">
                Type: {result.inferred_dtype}
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {result.num_rows_affected.toLocaleString()} Rows Vectorized
              </div>
            </div>

            <button
              onClick={handleApplyToCanvas}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 rounded-lg transition"
            >
              {appliedToSchema ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Plus className="w-3.5 h-3.5" />}
              {appliedToSchema ? "Added to Schema!" : "Inject Virtual Column to Dashboard"}
            </button>
          </div>

          {/* Formula Code Translator Tabs */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between bg-slate-900/80 border-b border-slate-800 px-4 py-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-slate-200">Generated Code Representations</span>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveCodeTab("polars")}
                  className={`px-3 py-1 rounded font-mono transition ${
                    activeCodeTab === "polars" ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  ⚡ Polars Python
                </button>
                <button
                  onClick={() => setActiveCodeTab("dax")}
                  className={`px-3 py-1 rounded font-mono transition ${
                    activeCodeTab === "dax" ? "bg-amber-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🟡 Power BI DAX
                </button>
                <button
                  onClick={() => setActiveCodeTab("lod")}
                  className={`px-3 py-1 rounded font-mono transition ${
                    activeCodeTab === "lod" ? "bg-cyan-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🔵 Tableau LOD
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-950 font-mono text-xs relative">
              <pre className="text-purple-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {activeCodeTab === "polars" && result.formula_code}
                {activeCodeTab === "dax" && result.dax_code}
                {activeCodeTab === "lod" && result.lod_code}
              </pre>

              <button
                onClick={() =>
                  handleCopyCode(
                    activeCodeTab === "polars"
                      ? result.formula_code
                      : activeCodeTab === "dax"
                      ? result.dax_code
                      : result.lod_code
                  )
                }
                className="absolute right-3 top-3 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                title="Copy Formula Syntax"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="bg-slate-900/60 p-3 border-t border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>{result.ai_explanation}</span>
            </div>
          </div>

          {/* Stats & Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Statistical HUD */}
            <div className="lg:col-span-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-3">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Virtual Vector Statistics
              </h3>

              <div className="space-y-2 text-xs font-mono">
                {Object.entries(result.stats).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 capitalize">{k.replace("_", " ")}:</span>
                    <span className="text-amber-300 font-bold">{v !== null ? String(v) : "0"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Computed Vector Preview Table */}
            <div className="lg:col-span-8 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-3">
                <Table className="w-4 h-4 text-emerald-400" />
                Sample Computed Column Output (First 5 Rows)
              </h3>

              {result.preview_sample && result.preview_sample.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        {Object.keys(result.preview_sample[0]).map((colKey) => (
                          <th
                            key={colKey}
                            className={`pb-2 pr-4 ${
                              colKey === result.field_name ? "text-purple-300 font-bold" : ""
                            }`}
                          >
                            {colKey}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {result.preview_sample.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/50 transition">
                          {Object.entries(row).map(([k, val], cIdx) => (
                            <td
                              key={cIdx}
                              className={`py-2 pr-4 ${
                                k === result.field_name
                                  ? "text-purple-300 font-bold bg-purple-950/30 px-2 rounded"
                                  : "text-slate-300"
                              }`}
                            >
                              {typeof val === "number" ? val.toLocaleString() : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-slate-500">No sample rows returned.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
