"use client";

import React, { useEffect, useState } from "react";
import { Activity, Database, Server } from "lucide-react";

const mockMetrics = {
  storageUsedPct: 68,
  searchStatus: "HEALTHY" as const,
  issueCount: 1,
  issueLabel: "NaIms",
};

export default function SystemHealthFooter() {
  const [metrics, setMetrics] = useState(mockMetrics);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) => ({
        ...prev,
        storageUsedPct: Math.min(100, Math.max(60, prev.storageUsedPct + (Math.random() > 0.7 ? 1 : 0))),
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 h-[48px] z-40 flex items-center justify-between px-4 text-[11px] font-mono"
      style={{
        background: "rgba(11,13,18,0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Left side */}
      <div className="flex items-center gap-5 h-full">
        {/* Issue Badge */}
        <div className="flex items-center gap-1.5">
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white"
            style={{ background: "#ef4444", fontSize: 10 }}
          >
            ● {metrics.issueCount} Issue
          </span>
          <span className="text-white/30">{metrics.issueLabel}</span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* MinIO Storage */}
        <div className="flex items-center gap-2 text-white/50">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span>MinIO</span>
          <div className="flex items-center gap-1.5">
            <div
              className="w-16 h-1.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${metrics.storageUsedPct}%`,
                  background: "linear-gradient(90deg, #3b82f6 0%, #5063f4 100%)",
                }}
              />
            </div>
            <span className="text-white/70">{metrics.storageUsedPct}%</span>
          </div>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Index Status */}
        <div className="flex items-center gap-2 text-white/50">
          <Server className="w-3.5 h-3.5 text-violet-400" />
          <span>Index:</span>
          <div className="flex items-center gap-1.5 ml-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-semibold">{metrics.searchStatus}</span>
          </div>
        </div>
      </div>

      {/* Right side: api latency */}
      <div className="flex items-center gap-2 text-white/35">
        <Activity className="w-3.5 h-3.5 text-emerald-400" />
        <span>Engine: ready</span>
      </div>
    </footer>
  );
}
