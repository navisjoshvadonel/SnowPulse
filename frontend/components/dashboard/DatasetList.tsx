"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { 
  Database, 
  FileText, 
  Cloud, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Search,
  Filter,
  ArrowUpDown,
  Plus
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then(res => res.json()).catch(() => null);

// Mock data generator for fallback
const generateMockDatasets = () => [
  { id: 1, name: "prod_transactions_2026", source: "postgres", rows: 1420500, lastSynced: "3m ago", status: "healthy" },
  { id: 2, name: "q2_marketing_spend.csv", source: "csv", rows: 1250, lastSynced: "2h ago", status: "healthy" },
  { id: 3, name: "stripe_billing_events", source: "api", rows: 85200, lastSynced: "Just now", status: "syncing" },
  { id: 4, name: "s3_user_logs_raw", source: "s3", rows: 89100200, lastSynced: "1d ago", status: "error" },
  { id: 5, name: "crm_accounts_sync", source: "postgres", rows: 45020, lastSynced: "12m ago", status: "healthy" },
];

export default function DatasetList() {
  const [filter, setFilter] = useState("all");
  const [sortDesc, setSortDesc] = useState(true);
  
  // Using SWR for the api fetch, falling back to mock data
  const { data } = useSWR('/api/datasets?limit=20', fetcher, {
    fallbackData: generateMockDatasets()
  });
  
  const datasets = data || [];
  
  // Client-side filtering and sorting for demo
  const filtered = datasets
    .filter((d: any) => filter === "all" || d.status === filter)
    .sort((a: any, b: any) => sortDesc ? 1 : -1); // Simplified sort simulation

  const getSourceIcon = (source: string) => {
    switch(source) {
      case 'postgres': return <Database className="w-4 h-4 text-blue-400" />;
      case 'csv': return <FileText className="w-4 h-4 text-emerald-400" />;
      case 's3': return <Cloud className="w-4 h-4 text-amber-400" />;
      case 'api':
      default: return <RefreshCw className="w-4 h-4 text-violet-400" />;
    }
  };

  const getStatusPill = (status: string) => {
    switch(status) {
      case 'healthy':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
            <CheckCircle2 className="w-3 h-3" /> Healthy
          </div>
        );
      case 'syncing':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-medium">
            <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-medium">
            <AlertCircle className="w-3 h-3" /> Error
          </div>
        );
      default:
        return null;
    }
  };

  if (datasets.length === 0) {
    return (
      <div className="w-full h-64 glass-panel bg-white/[0.02] border border-white/[0.08] rounded-2xl flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/30">
          <Database className="w-6 h-6" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-white">No datasets yet</h3>
          <p className="text-xs text-white/50 mt-1">Connect a source to start building your AI index.</p>
        </div>
        <button className="mt-2 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4" /> Connect Source
        </button>
      </div>
    );
  }

  return (
    <div className="w-full glass-panel bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col">
      {/* Header & Controls */}
      <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Dataset Health</h2>
        
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search datasets..." 
              className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 w-48 transition-colors"
            />
          </div>
          
          {/* Filter */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1">
            <button 
              onClick={() => setFilter("all")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${filter === 'all' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilter("error")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${filter === 'error' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}
            >
              Errors
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto max-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/[0.05] text-[11px] uppercase tracking-wider text-white/40 font-mono">
              <th className="py-3 px-5 font-medium">Dataset Name</th>
              <th className="py-3 px-5 font-medium">Rows</th>
              <th className="py-3 px-5 font-medium cursor-pointer hover:text-white/70 transition-colors" onClick={() => setSortDesc(!sortDesc)}>
                <div className="flex items-center gap-1">
                  Last Synced <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-5 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filtered.map((d: any) => (
              <tr key={d.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      {getSourceIcon(d.source)}
                    </div>
                    <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">{d.name}</span>
                  </div>
                </td>
                <td className="py-3.5 px-5 text-sm text-white/60 font-mono">
                  {d.rows.toLocaleString()}
                </td>
                <td className="py-3.5 px-5 text-sm text-white/60">
                  {d.lastSynced}
                </td>
                <td className="py-3.5 px-5 text-right">
                  <div className="flex justify-end">
                    {getStatusPill(d.status)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
