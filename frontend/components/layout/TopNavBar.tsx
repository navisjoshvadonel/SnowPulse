"use client";

import React, { useState } from "react";
import { Search, Bell, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";

// Mock fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json()).catch(() => ({ status: 'degraded' }));

export default function TopNavBar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Poll health endpoint every 10s. Defaulting to 'live' if endpoint isn't ready.
  const { data: healthData } = useSWR('/health/readiness', fetcher, { 
    refreshInterval: 10000,
    fallbackData: { status: 'live' }
  });
  
  const status = healthData?.status || 'live';
  
  const getStatusConfig = () => {
    switch(status) {
      case 'down': return { color: 'bg-red-500', text: 'Down' };
      case 'degraded': return { color: 'bg-amber-500', text: 'Degraded' };
      case 'live':
      default: return { color: 'bg-green-500', text: 'Live' };
    }
  };
  
  const statusConfig = getStatusConfig();

  return (
    <header className="fixed top-0 left-0 right-0 h-[64px] z-40 bg-white/[0.04] backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between px-6">
      {/* Left: Logo & Wordmark */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-white font-bold text-lg tracking-tight">SnowPulse</span>
      </div>

      <div className="flex items-center gap-6">
        {/* Center-right: Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
          <motion.div 
            className={`w-2 h-2 rounded-full ${statusConfig.color}`}
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
          <span className="text-xs font-medium text-white/80">{statusConfig.text}</span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4 border-l border-white/10 pl-4">
          <button className="text-white/60 hover:text-white transition-colors cursor-pointer p-1">
            <Search className="w-5 h-5" />
          </button>
          
          <button className="relative text-white/60 hover:text-white transition-colors cursor-pointer p-1">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#0a0a0f]" />
          </button>

          {/* Avatar Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 cursor-pointer p-1 group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border border-white/20 p-[2px]">
                <div className="w-full h-full rounded-full bg-[#0a0a0f] flex items-center justify-center">
                  <span className="text-xs font-bold text-white">JD</span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-48 rounded-xl bg-[#12141c]/90 backdrop-blur-xl border border-white/10 shadow-2xl py-1 overflow-hidden"
                >
                  <div className="px-4 py-2 border-b border-white/10 mb-1">
                    <p className="text-sm font-medium text-white">Jane Doe</p>
                    <p className="text-xs text-white/50 truncate">jane.doe@example.com</p>
                  </div>
                  
                  <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                    <User className="w-4 h-4" /> Profile
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                  
                  <div className="h-px bg-white/10 my-1" />
                  
                  <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors cursor-pointer">
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
