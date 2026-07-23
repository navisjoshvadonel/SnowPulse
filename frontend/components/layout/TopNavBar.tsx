"use client";

import React, { useState } from "react";
import { Search, Bell, Settings, LogOut, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TopNavBarProps {
  onLogout?: () => void;
  userEmail?: string;
}

export default function TopNavBar({
  onLogout,
  userEmail = "user@example.com",
}: TopNavBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "JD";

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

      {/* ── Center: empty ── */}
      <div className="flex-1" />

      {/* ── Right: Search + Actions ── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-white/40 hover:text-white/70 transition-colors cursor-pointer">
          <Search size={14} />
          <span className="text-xs font-sans">Search insights...</span>
        </div>

        {/* Bell */}
        <button className="relative p-1.5 text-white/40 hover:text-white/80 transition-colors cursor-pointer">
          <Bell size={17} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#0d0f14]" />
        </button>

        {/* Avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 cursor-pointer group"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
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
                className="absolute right-0 mt-2 w-48 rounded-xl py-1 overflow-hidden z-50"
                style={{
                  background: "rgba(18,21,30,0.97)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <div className="px-4 py-2.5 border-b border-white/[0.06] mb-1">
                  <p className="text-sm font-semibold text-white truncate">{userEmail}</p>
                  <p className="text-[10px] text-white/40 font-mono mt-0.5">Admin · SnowPulse AI</p>
                </div>

                <button className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer">
                  <User size={14} /> Profile
                </button>
                <button className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer">
                  <Settings size={14} /> Settings
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
