"use client";

import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Database, 
  BrainCircuit, 
  GitMerge, 
  Activity, 
  ChevronLeft, 
  ChevronRight,
  Briefcase
} from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "datasets", label: "Datasets", icon: Database },
  { id: "ai-query", label: "AI Query", icon: BrainCircuit },
  { id: "pipelines", label: "Pipelines", icon: GitMerge },
  { id: "health", label: "System Health", icon: Activity },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState("overview");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("snowpulse_sidebar_collapsed");
    if (stored !== null) {
      setCollapsed(stored === "true");
    }
  }, []);

  const toggleCollapsed = () => {
    const newVal = !collapsed;
    setCollapsed(newVal);
    localStorage.setItem("snowpulse_sidebar_collapsed", String(newVal));
  };

  // Prevent hydration mismatch on initial render
  if (!mounted) return <div className="fixed top-[64px] left-0 bottom-[48px] w-[220px] bg-white/[0.02]" />;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed top-[64px] left-0 bottom-[48px] z-30 bg-white/[0.02] backdrop-blur-md border-r border-white/[0.08] flex flex-col justify-between overflow-hidden"
    >
      <div className="py-6 flex flex-col gap-2 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveItem(item.id)}
              className={`
                relative flex items-center h-10 rounded-lg cursor-pointer transition-all duration-200 group
                ${collapsed ? 'justify-center px-0' : 'px-3'}
                ${isActive 
                  ? 'bg-gradient-to-r from-blue-500/10 to-violet-500/10 text-white' 
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              {/* Active left border indicator */}
              {isActive && (
                <motion.div 
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1 bottom-1 w-1 bg-gradient-to-b from-blue-400 to-violet-400 rounded-r-full"
                />
              )}
              
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
              
              <div 
                className={`ml-3 text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${
                  collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'
                }`}
              >
                {item.label}
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-white/[0.08] flex flex-col gap-3">
        {/* Workspace Switcher */}
        <button 
          className={`
            flex items-center h-10 rounded-lg cursor-pointer transition-all duration-200 text-white/70 hover:text-white hover:bg-white/[0.04]
            ${collapsed ? 'justify-center px-0' : 'px-3'}
          `}
          title={collapsed ? "Workspace" : undefined}
        >
          <Briefcase className="w-5 h-5 flex-shrink-0 text-indigo-400" />
          <div className={`ml-3 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis transition-opacity duration-200 ${
            collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'
          }`}>
            Production Env
          </div>
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={toggleCollapsed}
          className={`
            flex items-center h-8 rounded-lg cursor-pointer transition-all duration-200 text-white/40 hover:text-white/70 hover:bg-white/[0.04]
            ${collapsed ? 'justify-center px-0' : 'px-3'}
          `}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="ml-2 text-xs font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
