"use client";

import React, { useState, useSyncExternalStore } from "react";
import { BarChart3, LineChart, PieChart, ScatterChart, Activity, Pin, Check, Copy, Layers, Sparkles } from "lucide-react";
import { usePinnedChartStore } from "@/store/usePinnedChartStore";

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export interface UISchema {
  type: "bar" | "line" | "scatter" | "pie" | "metric";
  title: string;
  labels: string[];
  data: number[];
  color?: string;
  insight?: string;
}

interface GenerativeChartProps {
  schema: UISchema;
  queryPrompt?: string;
}

export default function GenerativeChart({ schema, queryPrompt }: GenerativeChartProps) {
  const mounted = useIsMounted();
  const { pinChart, unpinChart, isPinned } = usePinnedChartStore();
  const [copied, setCopied] = useState(false);
  const [showInsight, setShowInsight] = useState(true);

  if (!mounted) return null;

  const pinned = isPinned(schema.title);

  const handleTogglePin = () => {
    if (pinned) {
      // Find matching pinned chart ID if unpinning by title
      const state = usePinnedChartStore.getState();
      const match = state.pinnedCharts.find((c) => c.title === schema.title);
      if (match) unpinChart(match.id);
    } else {
      pinChart(schema, queryPrompt);
    }
  };

  const handleCopySpec = () => {
    const spec = JSON.stringify(
      {
        title: schema.title,
        type: schema.type,
        xAxis: schema.labels,
        series: schema.data,
        insight: schema.insight,
      },
      null,
      2
    );
    navigator.clipboard.writeText(spec);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maxVal = Math.max(...schema.data, 1);
  const minVal = Math.min(...schema.data, 0);
  const range = maxVal - minVal || 1;

  const renderIcon = () => {
    switch (schema.type) {
      case "bar":
        return <BarChart3 className="w-3.5 h-3.5 text-purple-300" />;
      case "line":
        return <LineChart className="w-3.5 h-3.5 text-indigo-300" />;
      case "pie":
        return <PieChart className="w-3.5 h-3.5 text-cyan-300" />;
      case "scatter":
        return <ScatterChart className="w-3.5 h-3.5 text-emerald-300" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-amber-300" />;
    }
  };

  return (
    <div className="mt-3.5 datagem-card p-4 overflow-hidden shadow-2xl relative group border border-purple-500/20 rounded-2xl bg-slate-950/90 backdrop-blur-md">
      {/* Background Glowing Ambient Mesh */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none animate-datagem-glow" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-2xl pointer-events-none" />

      {/* Header & Quick Action HUD */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300">
            {renderIcon()}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white tracking-wide font-sans flex items-center gap-2">
              {schema.title}
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {schema.type}
              </span>
            </h4>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopySpec}
            title="Copy ECharts Spec Code"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span className="hidden sm:inline">Spec</span>
              </>
            )}
          </button>

          <button
            onClick={handleTogglePin}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
              pinned
                ? "bg-purple-500 text-white border border-purple-400 font-semibold shadow-purple-500/30"
                : "bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/30 text-purple-200"
            }`}
          >
            <Pin className={`w-3 h-3 ${pinned ? "fill-white rotate-45" : ""}`} />
            <span>{pinned ? "Pinned to Canvas" : "📌 Pin to Dashboard"}</span>
          </button>
        </div>
      </div>

      {/* Visual Render Canvas */}
      <div className="h-[140px] flex items-end gap-2 mt-4 relative z-10">
        {schema.type === "bar" &&
          schema.data.map((val, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group/bar relative">
              <div
                className="w-full bg-gradient-to-t from-indigo-600/90 via-purple-500/90 to-purple-400 rounded-t-md transition-all duration-700 ease-out group-hover/bar:brightness-125 shadow-lg shadow-purple-500/20 relative"
                style={{
                  height: `${Math.max(12, ((val - minVal) / range) * 100)}%`,
                  animation: `fadeUp 0.5s ease-out ${idx * 0.08}s both`,
                }}
              >
                <div className="w-full h-1 bg-white/40 rounded-t-md" />
                <div className="opacity-0 group-hover/bar:opacity-100 absolute -top-9 left-1/2 -translate-x-1/2 bg-black/90 border border-purple-500/30 text-white text-[10px] py-1 px-2 rounded-md pointer-events-none whitespace-nowrap transition-all duration-200 z-10 font-mono shadow-xl">
                  {new Intl.NumberFormat("en-US", { notation: "compact" }).format(val)}
                </div>
              </div>
              <span className="text-[9px] text-purple-200/60 mt-2 font-mono truncate w-full text-center max-w-full">
                {schema.labels[idx]}
              </span>
            </div>
          ))}

        {(schema.type === "line" || schema.type === "scatter") && (
          <div className="w-full h-full relative">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={`datagemGradient-${schema.title.replace(/\s+/g, "")}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="50%" stopColor="#c4b5fd" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <path
                d={`M ${schema.data
                  .map(
                    (val, idx) =>
                      `${(idx / (schema.data.length - 1 || 1)) * 100},${100 - (((val - minVal) / range) * 100)}`
                  )
                  .join(" L ")}`}
                fill="none"
                stroke={`url(#datagemGradient-${schema.title.replace(/\s+/g, "")})`}
                strokeWidth="2.5"
                className="animate-draw"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 6px 12px rgba(196, 181, 253, 0.4))" }}
              />
              {schema.data.map((val, idx) => (
                <circle
                  key={idx}
                  cx={(idx / (schema.data.length - 1 || 1)) * 100}
                  cy={100 - (((val - minVal) / range) * 100)}
                  r="3"
                  className="fill-white stroke-purple-400 stroke-2 hover:r-4 transition-all"
                  style={{ animation: `fadeUp 0.3s ease-out ${idx * 0.1}s both` }}
                />
              ))}
            </svg>
            <div className="flex justify-between mt-2 text-[9px] text-purple-200/60 font-mono absolute -bottom-6 w-full">
              {schema.labels.map((lbl, idx) => (
                <span key={idx}>{lbl}</span>
              ))}
            </div>
          </div>
        )}

        {schema.type === "metric" && (
          <div className="w-full h-full flex items-center justify-around gap-2 px-2">
            {schema.labels.map((lbl, idx) => (
              <div
                key={idx}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center transition-all hover:border-purple-500/40"
              >
                <span className="text-[10px] text-purple-300/70 font-mono block uppercase tracking-wider">{lbl}</span>
                <span className="text-base font-extrabold text-white font-mono mt-1 block">
                  {typeof schema.data[idx] === "number"
                    ? schema.data[idx].toLocaleString()
                    : schema.data[idx]}
                </span>
              </div>
            ))}
          </div>
        )}

        {schema.type === "pie" && (
          <div className="w-full h-full flex items-center justify-center gap-6">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {schema.data.map((val, idx) => {
                  const total = schema.data.reduce((a, b) => a + b, 0) || 1;
                  const pct = (val / total) * 100;
                  const prevPct = schema.data
                    .slice(0, idx)
                    .reduce((a, b) => a + (b / total) * 100, 0);
                  const colors = ["#818cf8", "#a855f7", "#ec4899", "#38bdf8", "#10b981"];
                  return (
                    <circle
                      key={idx}
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="transparent"
                      stroke={colors[idx % colors.length]}
                      strokeWidth="3.5"
                      strokeDasharray={`${pct} ${100 - pct}`}
                      strokeDashoffset={-prevPct}
                      className="transition-all duration-500 hover:strokeWidth-4"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-purple-200">
                Share
              </div>
            </div>
            <div className="space-y-1 font-mono text-[10px]">
              {schema.labels.map((lbl, idx) => (
                <div key={idx} className="flex items-center gap-2 text-slate-300">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: ["#818cf8", "#a855f7", "#ec4899", "#38bdf8", "#10b981"][idx % 5],
                    }}
                  />
                  <span>{lbl}:</span>
                  <span className="font-bold text-white">{schema.data[idx]?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {schema.insight && showInsight && (
        <div className="mt-8 pt-3 border-t border-white/10 flex items-start gap-2 relative z-10">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0 animate-pulse" />
          <p className="text-[10px] text-purple-200 leading-relaxed font-sans">{schema.insight}</p>
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes draw {
          from { stroke-dasharray: 1000; stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
        .animate-draw {
          animation: draw 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}
