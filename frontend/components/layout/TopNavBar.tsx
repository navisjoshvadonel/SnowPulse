"use client";

import React, { useState } from "react";
import { Search, Bell, Settings, LogOut, User, Users, Key, BookOpen, Check, AlertTriangle, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TopNavBarProps {
  onLogout?: () => void;
  userEmail?: string;
  onOpenCommandPalette?: () => void;
  onOpenModal?: (modal: "team" | "apikeys" | "docs") => void;
}

export default function TopNavBar({
  onLogout,
  userEmail = "user@snowpulse.ai",
  onOpenCommandPalette,
  onOpenModal,
}: TopNavBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState([
    { id: "1", type: "anomaly", title: "North America intake anomaly", desc: "Intake rate dropped by 24% relative to 7-day mean.", time: "10m ago", read: false },
    { id: "2", type: "system", title: "Gemini 3.6 Flash Active", desc: "API quota operating at 68% capacity.", time: "1h ago", read: false },
    { id: "3", type: "ingestion", title: "Schema Ingestion Complete", desc: "Dataset profile generated across 14 columns.", time: "2h ago", read: true },
  ]);

  const unreadCount = alerts.filter((a) => !a.read).length;
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "SP";

  const markAllRead = () => {
    setAlerts(alerts.map((a) => ({ ...a, read: true })));
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 h-[64px] z-40 flex items-center justify-between px-5"
      style={{
        background: "rgba(13,15,20,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Left: empty space for sidebar logo area ── */}
      <div style={{ width: 220 }} className="flex-shrink-0" />

      {/* ── Center: Search command palette trigger ── */}
      <div className="flex-1 max-w-md mx-auto">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl px-3.5 py-1.5 text-white/40 hover:text-white/70 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Search size={14} className="text-white/40" />
            <span className="text-xs font-sans">Search insights, metrics, commands...</span>
          </div>
          <kbd className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded border border-white/10">⌘K</kbd>
        </button>
      </div>

      {/* ── Right: Bell + User Menu ── */}
      <div className="flex items-center gap-3">
        {/* Alerts Bell */}
        <div className="relative">
          <button
            onClick={() => { setAlertsOpen(!alertsOpen); setDropdownOpen(false); }}
            className="relative p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/5 transition-all cursor-pointer"
            title="Notifications & Anomaly Alerts"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center border border-[#0d0f14]">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Alerts Drawer */}
          <AnimatePresence>
            {alertsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                className="absolute right-0 mt-2 w-80 rounded-2xl py-2 overflow-hidden z-50 shadow-2xl border border-white/10"
                style={{ background: "#12151e" }}
              >
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Bell size={14} className="text-indigo-400" /> Notifications & Alerts
                  </span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono cursor-pointer">
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1 p-2">
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      className={`p-3 rounded-xl transition-all border ${
                        a.read ? "bg-white/[0.01] border-white/[0.03]" : "bg-indigo-500/10 border-indigo-500/20"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                          {a.type === "anomaly" ? (
                            <AlertTriangle size={13} className="text-amber-400" />
                          ) : (
                            <Sparkles size={13} className="text-indigo-400" />
                          )}
                          {a.title}
                        </p>
                        <span className="text-[9px] font-mono text-white/30">{a.time}</span>
                      </div>
                      <p className="text-[11px] text-white/50 mt-1 leading-snug">{a.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Avatar Dropdown */}
        <div className="relative">
          <button
            onClick={() => { setDropdownOpen(!dropdownOpen); setAlertsOpen(false); }}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-white/5 transition-all cursor-pointer group"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 shadow-lg"
              style={{ background: "linear-gradient(135deg, #5063f4 0%, #8b5cf6 100%)" }}
            >
              {initials}
            </div>
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 mt-2 w-56 rounded-2xl py-1 overflow-hidden z-50 border border-white/10 shadow-2xl"
                style={{ background: "#12151e" }}
              >
                <div className="px-4 py-3 border-b border-white/[0.06] mb-1">
                  <p className="text-xs font-bold text-white truncate">{userEmail}</p>
                  <span className="inline-block text-[9px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 mt-1">
                    Enterprise Admin
                  </span>
                </div>

                <button
                  onClick={() => { setDropdownOpen(false); onOpenModal?.("team"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  <Users size={14} className="text-indigo-400" /> Team & Workspace
                </button>

                <button
                  onClick={() => { setDropdownOpen(false); onOpenModal?.("apikeys"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  <Key size={14} className="text-cyan-400" /> API Keys & Webhooks
                </button>

                <button
                  onClick={() => { setDropdownOpen(false); onOpenModal?.("docs"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  <BookOpen size={14} className="text-purple-400" /> Docs & Release Notes
                </button>

                <div className="h-px bg-white/[0.06] my-1" />

                <button
                  onClick={() => { setDropdownOpen(false); onLogout?.(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/[0.08] transition-colors cursor-pointer"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
