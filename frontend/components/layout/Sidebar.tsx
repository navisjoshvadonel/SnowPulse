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
  Zap,
  HardDrive,
  Users,
  Key,
  BookOpen,
  ChevronDown,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type SnowSection =
  | "dashboard"
  | "dataset-overview"
  | "production-env";

export interface UsageQuota {
  gemini_calls: number;
  gemini_max_calls: number;
  tokens_used: number;
  token_limit: number;
  storage_used_formatted: string;
  storage_limit_formatted: string;
}

interface SidebarProps {
  active: SnowSection;
  onNavigate: (section: SnowSection) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  datasetName?: string;
  onUploadDataset?: (file: File) => void;
  uploading?: boolean;
  hasPredictableMetric?: boolean;
  onOpenModal?: (modal: "team" | "apikeys" | "docs") => void;
  usageQuota?: UsageQuota;
}

function SnowflakeIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
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
  onOpenModal,
  usageQuota,
}: SidebarProps) {
  const [mounted, setMounted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [env, setEnv] = useState<"Production" | "Staging" | "Development">("Production");
  const [envOpen, setEnvOpen] = useState(false);
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

  const envColors = {
    Production: "bg-emerald-400 text-emerald-400",
    Staging: "bg-amber-400 text-amber-400",
    Development: "bg-cyan-400 text-cyan-400",
  };

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
          <SnowflakeIcon size={16} className="animate-spin-slow" />
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
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload Dataset"
            className="w-full flex items-center justify-center p-2.5 rounded-xl bg-gradient-to-br from-indigo-950/80 via-sky-950/70 to-emerald-950/80 border border-cyan-400/30 text-cyan-300 hover:text-white hover:border-cyan-300 transition-all cursor-pointer"
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
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="group relative rounded-xl px-3 py-3 cursor-pointer transition-all duration-300 flex flex-col items-center gap-2 text-center overflow-hidden"
            style={{
              background: dragOver
                ? "linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(14, 165, 233, 0.15) 50%, rgba(16, 185, 129, 0.18) 100%)"
                : "linear-gradient(135deg, rgba(30, 27, 75, 0.45) 0%, rgba(15, 23, 42, 0.55) 50%, rgba(6, 78, 59, 0.25) 100%)",
              border: dragOver
                ? "1.5px dashed #38bdf8"
                : "1.5px dashed rgba(129, 140, 248, 0.3)",
            }}
          >
            {uploading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-400/30">
                  <UploadCloud size={18} className="text-cyan-300" />
                </motion.div>
                <p className="text-[10px] text-cyan-200 font-mono leading-snug tracking-wider">Uploading…</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-gradient-to-r from-indigo-500/15 via-sky-500/15 to-emerald-500/15 border border-indigo-400/20">
                  <UploadCloud size={15} className="text-cyan-300" />
                  <FileSpreadsheet size={13} className="text-emerald-300" />
                </div>
                <p className="text-[12px] font-bold tracking-wide bg-gradient-to-r from-indigo-200 via-sky-200 to-emerald-200 bg-clip-text text-transparent">
                  Upload Dataset
                </p>
                <span className="text-[9px] font-mono text-cyan-300 tracking-tight">CSV • Excel • JSON</span>
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
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
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
                    isActive ? "text-blue-400" : "text-white/40"
                  }`}
                  size={17}
                />
                {!collapsed && (
                  <span className={`ml-3 ${isActive ? "text-white" : ""}`}>
                    {item.label}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* ── Usage / Quota Indicator (Expanded) ── */}
      {!collapsed && (() => {
        const quota = usageQuota || {
          gemini_calls: 14,
          gemini_max_calls: 500,
          tokens_used: 18450,
          token_limit: 100000,
          storage_used_formatted: "2.4 MB",
          storage_limit_formatted: "10 GB",
        };
        const tokenPercent = Math.min(100, Math.max(5, Math.round((quota.tokens_used / quota.token_limit) * 100)));
        const tokenFormatted = quota.tokens_used >= 1000 ? `${(quota.tokens_used / 1000).toFixed(1)}k` : quota.tokens_used.toString();
        const limitFormatted = quota.token_limit >= 1000 ? `${(quota.token_limit / 1000).toFixed(0)}k` : quota.token_limit.toString();

        return (
          <div className="mx-2 my-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between text-[10px] text-white/50">
              <span className="font-mono flex items-center gap-1" title={`${quota.gemini_calls} API calls completed`}>
                <Zap size={11} className="text-cyan-400" /> Gemini Tokens
              </span>
              <span className="font-mono text-cyan-300 font-semibold">{tokenFormatted} / {limitFormatted}</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${tokenPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-white/50 pt-0.5">
              <span className="font-mono flex items-center gap-1">
                <HardDrive size={11} className="text-purple-400" /> Storage ({quota.gemini_calls} calls)
              </span>
              <span className="font-mono text-purple-300 font-semibold">
                {quota.storage_used_formatted} / {quota.storage_limit_formatted}
              </span>
            </div>
            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full rounded-full" style={{ width: "18%" }} />
            </div>
          </div>
        );
      })()}

      {/* ── Bottom Controls & Environment Switcher ── */}
      <div className="flex flex-col gap-0.5 px-2 pb-3 border-t border-white/[0.06] pt-2 flex-shrink-0 relative">
        {/* Interactive Environment Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setEnvOpen(!envOpen)}
            className={`w-full flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? `Environment: ${env}` : undefined}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${envColors[env].split(" ")[0]}`} />
              {!collapsed && (
                <span className="text-xs font-semibold text-white truncate">{env} Env</span>
              )}
            </div>
            {!collapsed && <ChevronDown size={14} className="text-white/40" />}
          </button>

          <AnimatePresence>
            {envOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute bottom-full left-0 mb-2 w-48 rounded-xl py-1 z-50 border border-white/10 shadow-2xl"
                style={{ background: "#12151e" }}
              >
                {(["Production", "Staging", "Development"] as const).map((e) => (
                  <button
                    key={e}
                    onClick={() => { setEnv(e); setEnvOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${envColors[e].split(" ")[0]}`} />
                      {e}
                    </span>
                    {env === e && <Check size={13} className="text-indigo-400" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Shortcuts */}
        <button
          onClick={() => onOpenModal?.("team")}
          className={`sidebar-nav-item ${collapsed ? "justify-center px-0 w-full" : "px-3 w-full"}`}
          title={collapsed ? "Team Members" : undefined}
        >
          <Users size={16} className="text-indigo-400 flex-shrink-0" />
          {!collapsed && <span className="ml-3">Team & Invites</span>}
        </button>

        <button
          onClick={() => onOpenModal?.("apikeys")}
          className={`sidebar-nav-item ${collapsed ? "justify-center px-0 w-full" : "px-3 w-full"}`}
          title={collapsed ? "API Keys" : undefined}
        >
          <Key size={16} className="text-cyan-400 flex-shrink-0" />
          {!collapsed && <span className="ml-3">API Keys & Webhooks</span>}
        </button>

        <button
          onClick={onToggleCollapsed}
          className={`sidebar-nav-item mt-1 ${collapsed ? "justify-center px-0 w-full" : "px-3 w-full"}`}
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
