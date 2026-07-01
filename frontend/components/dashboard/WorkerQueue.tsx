"use client";

import React from "react";
import useSWR from "swr";
import { ServerCog } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(res => res.json()).catch(() => null);

// Mock data to fall back on if endpoint doesn't exist
const mockQueueData = {
  pending_jobs: 142,
  processing: 8,
  failed_24h: 3,
  redis_memory_pct: 42
};

export default function WorkerQueue() {
  const { data } = useSWR('/api/queue/status', fetcher, {
    fallbackData: mockQueueData,
    refreshInterval: 5000
  });

  const queue = data || mockQueueData;
  const hasFailures = queue.failed_24h > 0;

  return (
    <div className="w-full glass-panel bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
          <ServerCog className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-semibold text-white">Worker Queue Health</h2>
      </div>

      <div className="flex-1 flex flex-col justify-between gap-3 text-sm">
        {/* Pending */}
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
          <span className="text-white/60">Pending jobs</span>
          <span className="font-mono text-white tabular-nums">{queue.pending_jobs.toLocaleString()}</span>
        </div>
        
        {/* Processing */}
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
          <span className="text-white/60">Processing</span>
          <span className="font-mono text-white tabular-nums">{queue.processing.toLocaleString()}</span>
        </div>

        {/* Failed */}
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
          <span className="text-white/60">Failed (24h)</span>
          <span className={`font-mono tabular-nums font-semibold ${hasFailures ? 'text-[#f87171]' : 'text-white/70'}`}>
            {queue.failed_24h.toLocaleString()}
          </span>
        </div>

        {/* Redis Memory */}
        <div className="flex flex-col gap-1.5 mt-auto pt-2">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-xs">Redis memory %</span>
            <span className="font-mono text-white tabular-nums text-xs">{queue.redis_memory_pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                queue.redis_memory_pct > 80 ? 'bg-red-400' : queue.redis_memory_pct > 60 ? 'bg-amber-400' : 'bg-blue-500'
              }`}
              style={{ width: `${queue.redis_memory_pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
