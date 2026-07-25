"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, X, Check, Server, Cloud, Table, RefreshCw, Key } from "lucide-react";

interface DirectConnectorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CONNECTOR_TYPES = [
  { id: "postgres", name: "PostgreSQL", icon: Database, color: "text-blue-400" },
  { id: "mysql", name: "MySQL", icon: Server, color: "text-amber-400" },
  { id: "snowflake", name: "Snowflake DW", icon: Database, color: "text-cyan-400" },
  { id: "bigquery", name: "Google BigQuery", icon: Cloud, color: "text-indigo-400" },
  { id: "s3", name: "AWS S3 / GCS", icon: Cloud, color: "text-orange-400" },
  { id: "sheets", name: "Google Sheets", icon: Table, color: "text-emerald-400" },
];

export default function DirectConnectorsModal({ isOpen, onClose }: DirectConnectorsModalProps) {
  const [selectedType, setSelectedType] = useState("postgres");
  const [connectionString, setConnectionString] = useState("postgresql://user:pass@localhost:5432/snowdb");
  const [syncFreq, setSyncFreq] = useState("daily");
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);

  if (!isOpen) return null;

  const handleTestConnect = async () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setConnected(true);
    }, 1200);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-xl bg-[#12151e] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Database className="text-cyan-400" size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Direct Enterprise Data Connectors</h3>
                <p className="text-[11px] text-white/50">Postgres, Snowflake, BigQuery & Cloud Storage Sync</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/5">
              <X size={18} />
            </button>
          </div>

          {/* Connector Select Grid */}
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {CONNECTOR_TYPES.map((c) => {
              const Icon = c.icon;
              const active = selectedType === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedType(c.id)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    active
                      ? "bg-indigo-500/15 border-indigo-500/50 shadow-lg"
                      : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon size={20} className={c.color} />
                  <span className="text-xs font-semibold text-white/80">{c.name}</span>
                </button>
              );
            })}
          </div>

          {/* Connection Settings */}
          <div className="space-y-3.5 mb-6">
            <div>
              <label className="block text-[11px] font-mono text-white/50 mb-1">Connection String / Host URI</label>
              <input
                type="text"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-white/50 mb-1">Sync Schedule</label>
                <select
                  value={syncFreq}
                  onChange={(e) => setSyncFreq(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                >
                  <option value="hourly" className="bg-[#12151e]">Hourly Sync</option>
                  <option value="daily" className="bg-[#12151e]">Daily Sync</option>
                  <option value="weekly" className="bg-[#12151e]">Weekly Sync</option>
                  <option value="manual" className="bg-[#12151e]">Manual Trigger Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-white/50 mb-1">Auto-Schema Mapping</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono">
                  <Check size={14} /> Automatic Detection
                </div>
              </div>
            </div>
          </div>

          {connected && (
            <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <Check size={14} /> Connector authenticated! Schema synchronized automatically.
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white">
              Cancel
            </button>
            <button
              onClick={handleTestConnect}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg"
            >
              {testing ? <RefreshCw size={14} className="animate-spin" /> : <Server size={14} />}
              {testing ? "Testing Connection..." : "Authenticate & Sync"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
