"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Database,
  BrainCircuit,
  Activity,
  ChevronLeft,
  ChevronRight,
  Settings,
  HelpCircle,
  Briefcase,
  UploadCloud,
  FileSpreadsheet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type SnowSection =
  | "dashboard"
  | "dataset-overview"
  | "snow-ai"
  | "prediction"
  | "production-env";

interface SidebarProps {
  active: SnowSection;
  onNavigate: (section: SnowSection) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  datasetName?: string;
  onUploadDataset?: (file: File) => void;
  uploading?: boolean;
  hasPredictableMetric?: boolean;
}

function SnowflakeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="sf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <line x1="12" y1="2" x2="12" y2="22" stroke="url(#sf-grad)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="url(#sf-grad)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" stroke="url(#sf-grad)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" stroke="url(#sf-grad)" strokeWidth="1.8" strokeLinecap="round" />
      <polygon
        points="12,9.5 14.1,10.75 14.1,13.25 12,14.5 9.9,13.25 9.9,10.75"
        stroke="url(#sf-grad)"
        strokeWidth="1.2"
        fill="rgba(129,140,248,0.12)"
      />
      <path d="M12,4 L10.5,2.5 M12,4 L13.5,2.5" stroke="url(#sf-grad)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12,20 L10.5,21.5 M12,20 L13.5,21.5" stroke="url(#sf-grad)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4,12 L2.5,10.5 M4,12 L2.5,13.5" stroke="url(#sf-grad)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20,12 L21.5,10.5 M20,12 L21.5,13.5" stroke="url(#sf-grad)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const navItems: { id: SnowSection; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "dataset-overview", label: "Dataset Overview", icon: Database },
  { id: "snow-ai", label: "Snow AI", icon: BrainCircuit },
  { id: "prediction", label: "Future Prediction", icon: Activity },
];

export default function Sidebar({
  active,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  datasetName = "SAMPLE ANALYTICS\n(MOCK)",
  onUploadDataset,
  uploading = false,
  hasPredictableMetric = true,
}: SidebarProps) {
  const [mounted, setMounted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(handle);
  }, []);

  const width = collapsed ? 64 : 220;

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    onUploadDataset?.(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  if (!mounted) {
    return (
      <div
        className="fixed top-0 left-0 bottom-[48px] bg-[#0b0d12] border-r border-white/[0.06]"
        style={{ width }}
      />
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={{ duration: 0.28, ease: "easeInOut" }}
      className="fixed top-0 left-0 bottom-[48px] z-30 flex flex-col overflow-hidden"
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
    >
      {/* ── Logo ── */}
      <div
        className={`flex items-center gap-2.5 border-b border-white/[0.06] flex-shrink-0 ${
          collapsed ? "justify-center px-0 py-4" : "px-4 py-4"
        }`}
        style={{ minHeight: 64 }}
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
          <SnowflakeIcon size={16} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden leading-tight">
            <p className="text-[13px] font-bold text-white tracking-tight whitespace-nowrap">SnowPulse AI</p>
            <p className="text-[9px] text-white/35 font-mono whitespace-pre-line leading-snug mt-0.5">
              {datasetName}
            </p>
          </div>
        )}
      </div>

      {/* ── Upload Dataset Section ── */}
      <div
        className={`flex-shrink-0 border-b border-white/[0.06] ${collapsed ? "px-1.5 py-2" : "px-3 py-3"}`}
      >
        {collapsed ? (
          /* Collapsed: styled neon icon button */
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload Dataset"
            className="w-full flex items-center justify-center p-2.5 rounded-xl bg-gradient-to-br from-indigo-950/80 via-sky-950/70 to-emerald-950/80 border border-cyan-400/30 text-cyan-300 hover:text-white hover:border-cyan-300 hover:shadow-[0_0_15px_rgba(56,189,248,0.4)] transition-all cursor-pointer"
          >
            {uploading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <UploadCloud size={17} className="text-cyan-300" />
              </motion.div>
            ) : (
              <UploadCloud size={17} className="text-cyan-300 filter drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
            )}
          </button>
        ) : (
          /* Expanded: full drop zone with unique vibrant color combo */
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="group relative rounded-xl px-3 py-3.5 cursor-pointer transition-all duration-300 flex flex-col items-center gap-2 text-center overflow-hidden"
            style={{
              background: dragOver
                ? "linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(14, 165, 233, 0.15) 50%, rgba(16, 185, 129, 0.18) 100%)"
                : "linear-gradient(135deg, rgba(30, 27, 75, 0.45) 0%, rgba(15, 23, 42, 0.55) 50%, rgba(6, 78, 59, 0.25) 100%)",
              border: dragOver
                ? "1.5px dashed #38bdf8"
                : "1.5px dashed rgba(129, 140, 248, 0.3)",
              boxShadow: dragOver
                ? "0 0 20px rgba(56, 189, 248, 0.35), inset 0 0 15px rgba(99, 102, 241, 0.2)"
                : "0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
            }}
          >
            {/* Ambient background glow orb */}
            <div className="absolute -top-6 -right-6 w-16 h-16 bg-gradient-to-br from-indigo-500/20 via-cyan-400/20 to-emerald-400/20 rounded-full blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
            
            {uploading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-400/30">
                  <UploadCloud size={18} className="text-cyan-300" />
                </motion.div>
                <p className="text-[10px] text-cyan-200 font-mono leading-snug tracking-wider">Uploading…</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-gradient-to-r from-indigo-500/15 via-sky-500/15 to-emerald-500/15 border border-indigo-400/20 shadow-inner group-hover:border-cyan-400/40 transition-colors">
                  <UploadCloud size={16} className="text-cyan-300 filter drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
                  <FileSpreadsheet size={14} className="text-emerald-300 filter drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                </div>
                <p className="text-[12px] font-bold tracking-wide bg-gradient-to-r from-indigo-200 via-sky-200 to-emerald-200 bg-clip-text text-transparent group-hover:from-white group-hover:via-cyan-100 group-hover:to-emerald-100 transition-all">
                  Upload Dataset
                </p>
                <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                  <span className="text-[9.5px] font-mono font-medium text-cyan-300 tracking-tight">
                    CSV • Excel • JSON • TSV
                  </span>
                </div>
              </>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json,.tsv,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {/* ── Nav Items ── */}
      <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const isPrediction = item.id === "prediction";
          const isLocked = isPrediction && !hasPredictableMetric;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={
                collapsed
                  ? isLocked
                    ? "Future Prediction (Requires Numeric Metric)"
                    : item.label
                  : undefined
              }
              className={`sidebar-nav-item ${isActive ? "active" : ""} ${
                collapsed ? "justify-center px-0 w-full" : "px-3 w-full justify-between"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeBar"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-blue-400 to-violet-500"
                />
              )}
              <div className="flex items-center">
                <Icon
                  className={`flex-shrink-0 ${
                    isActive
                      ? "text-blue-400"
                      : isLocked
                      ? "text-amber-400/60"
                      : "text-white/40"
                  }`}
                  size={17}
                />
                {!collapsed && (
                  <span
                    className={`ml-3 ${
                      isActive ? "text-white" : isLocked ? "text-white/40" : ""
                    }`}
                  >
                    {item.label}
                  </span>
                )}
              </div>
              {!collapsed && isLocked && (
                <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Numeric Only
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Bottom Controls ── */}
      <div className="flex flex-col gap-0.5 px-2 pb-3 border-t border-white/[0.06] pt-3 flex-shrink-0">
        <button
          className={`sidebar-nav-item ${collapsed ? "justify-center px-0 w-full" : "px-3 w-full"}`}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings size={17} className="text-white/35 flex-shrink-0" />
          {!collapsed && <span className="ml-3">Settings</span>}
        </button>

        <button
          className={`sidebar-nav-item ${collapsed ? "justify-center px-0 w-full" : "px-3 w-full"}`}
          title={collapsed ? "Support" : undefined}
        >
          <HelpCircle size={17} className="text-white/35 flex-shrink-0" />
          {!collapsed && <span className="ml-3">Support</span>}
        </button>

        <button
          onClick={() => onNavigate("production-env")}
          className={`sidebar-nav-item ${
            active === "production-env" ? "active" : ""
          } ${collapsed ? "justify-center px-0 w-full" : "px-3 w-full"}`}
          title={collapsed ? "Production Env" : undefined}
        >
          <Briefcase size={17} className="text-indigo-400 flex-shrink-0" />
          {!collapsed && <span className="ml-3">Production Env</span>}
        </button>

        <button
          onClick={onToggleCollapsed}
          className={`sidebar-nav-item mt-1 ${
            collapsed ? "justify-center px-0 w-full" : "px-3 w-full"
          }`}
        >
          {collapsed ? (
            <ChevronRight size={16} className="text-white/30" />
          ) : (
            <>
              <ChevronLeft size={16} className="text-white/30 flex-shrink-0" />
              <span className="ml-2 text-xs text-white/30">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
