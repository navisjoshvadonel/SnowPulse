"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { motion } from "framer-motion";

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
}

// Snowflake logo matching the reference screenshot
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
}: SidebarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const handle = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(handle);
  }, []);

  const width = collapsed ? 64 : 220;

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
            <p className="text-[13px] font-bold text-white tracking-tight whitespace-nowrap">Insight AI</p>
            <p className="text-[9px] text-white/35 font-mono whitespace-pre-line leading-snug mt-0.5">
              {datasetName}
            </p>
          </div>
        )}
      </div>

      {/* ── Nav Items ── */}
      <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`sidebar-nav-item ${isActive ? "active" : ""} ${
                collapsed ? "justify-center px-0 w-full" : "px-3 w-full"
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="activeBar"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-blue-400 to-violet-500"
                />
              )}
              <Icon
                className={`flex-shrink-0 ${isActive ? "text-blue-400" : "text-white/40"}`}
                size={17}
              />
              {!collapsed && (
                <span className={`ml-3 ${isActive ? "text-white" : ""}`}>{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Bottom Controls ── */}
      <div className="flex flex-col gap-0.5 px-2 pb-3 border-t border-white/[0.06] pt-3 flex-shrink-0">
        {/* Settings */}
        <button
          className={`sidebar-nav-item ${collapsed ? "justify-center px-0 w-full" : "px-3 w-full"}`}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings size={17} className="text-white/35 flex-shrink-0" />
          {!collapsed && <span className="ml-3">Settings</span>}
        </button>

        {/* Support */}
        <button
          className={`sidebar-nav-item ${collapsed ? "justify-center px-0 w-full" : "px-3 w-full"}`}
          title={collapsed ? "Support" : undefined}
        >
          <HelpCircle size={17} className="text-white/35 flex-shrink-0" />
          {!collapsed && <span className="ml-3">Support</span>}
        </button>

        {/* Production Env */}
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

        {/* Collapse Toggle */}
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
