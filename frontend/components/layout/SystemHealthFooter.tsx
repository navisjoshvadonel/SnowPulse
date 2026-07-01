"use client";

import React, { useEffect, useState } from "react";
import { Activity, Database, Server, ExternalLink } from "lucide-react";

// In a real implementation, you would fetch from a Next.js API route 
// that parses the Prometheus /metrics endpoint.
// For this UI component, we mock the parsed metrics.
const mockMetrics = {
  apiLatencyP50: "42ms",
  apiLatencyP99: "120ms",
  storageUsedPct: 68,
  searchStatus: "healthy"
};

export default function SystemHealthFooter() {
  const [metrics, setMetrics] = useState(mockMetrics);
  
  // Simulate polling
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        apiLatencyP50: `${Math.floor(40 + Math.random() * 10)}ms`,
        apiLatencyP99: `${Math.floor(110 + Math.random() * 30)}ms`,
        storageUsedPct: 68 + (Math.random() > 0.8 ? 1 : 0),
        searchStatus: "healthy"
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-[48px] z-40 bg-white/[0.03] backdrop-blur-md border-t border-white/[0.08] flex items-center justify-between px-4 text-xs font-mono">
      <div className="flex items-center gap-6 h-full">
        
        {/* API Latency */}
        <div className="flex items-center gap-2 text-white/60">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>API Latency</span>
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-white/40">p50:</span>
            <span className="text-white font-medium">{metrics.apiLatencyP50}</span>
            <span className="text-white/20">|</span>
            <span className="text-white/40">p99:</span>
            <span className="text-white font-medium">{metrics.apiLatencyP99}</span>
          </div>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Storage Bar */}
        <div className="flex items-center gap-2 text-white/60 min-w-[150px]">
          <Database className="w-4 h-4 text-blue-400" />
          <span>MinIO:</span>
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden ml-1 flex items-center">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-500" 
              style={{ width: `${metrics.storageUsedPct}%` }}
            />
          </div>
          <span className="text-white font-medium">{metrics.storageUsedPct}%</span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Meilisearch Index Status */}
        <div className="flex items-center gap-2 text-white/60">
          <Server className="w-4 h-4 text-violet-400" />
          <span>Index:</span>
          <div className="flex items-center gap-1.5 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-400 font-medium capitalize">{metrics.searchStatus}</span>
          </div>
        </div>
      </div>

      {/* External Link */}
      <a 
        href="http://localhost:3001" 
        target="_blank" 
        rel="noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
      >
        <span>Open Grafana</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </footer>
  );
}
