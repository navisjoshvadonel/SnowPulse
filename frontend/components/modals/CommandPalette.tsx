"use client";

import React, { useState, useEffect } from "react";
import { Search, LayoutDashboard, Database, Settings, Key, Users, BookOpen, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SnowSection } from "@/components/layout/Sidebar";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: SnowSection) => void;
  onOpenModal: (modal: "team" | "apikeys" | "docs") => void;
}

export default function CommandPalette({ isOpen, onClose, onNavigate, onOpenModal }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        isOpen ? onClose() : null;
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { label: "Go to Executive Dashboard", category: "Navigation", icon: LayoutDashboard, action: () => { onNavigate("dashboard"); onClose(); } },
    { label: "View Dataset Profile & Overview", category: "Navigation", icon: Database, action: () => { onNavigate("dataset-overview"); onClose(); } },
    { label: "Manage API Keys & Gemini Config", category: "Settings", icon: Key, action: () => { onOpenModal("apikeys"); onClose(); } },
    { label: "Invite & Manage Team Members", category: "Team", icon: Users, action: () => { onOpenModal("team"); onClose(); } },
    { label: "Read Release Notes & Documentation", category: "Docs", icon: BookOpen, action: () => { onOpenModal("docs"); onClose(); } },
  ];

  const filteredActions = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}>
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          style={{ background: "#12151e" }}
        >
          {/* Input Header */}
          <div className="flex items-center px-4 py-3.5 border-b border-white/[0.08] gap-3">
            <Search size={18} className="text-white/40" />
            <input
              type="text"
              placeholder="Type a command or search section (e.g. 'Dashboard', 'API Keys')..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"
              autoFocus
            />
            <kbd className="px-2 py-0.5 text-[10px] font-mono text-white/30 bg-white/5 border border-white/10 rounded">ESC</kbd>
          </div>

          {/* Action List */}
          <div className="max-h-72 overflow-y-auto p-2 space-y-1">
            {filteredActions.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-6">No matching actions found.</p>
            ) : (
              filteredActions.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={item.action}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.05] transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/5 text-white/60 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                        <Icon size={16} />
                      </div>
                      <span className="text-xs font-semibold text-white/80 group-hover:text-white">{item.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/30 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.05]">
                      {item.category}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
