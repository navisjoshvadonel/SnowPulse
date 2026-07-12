"use client";

import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Database, 
  BrainCircuit, 
  Activity, 
  ChevronLeft, 
  ChevronRight,
  Briefcase
} from "lucide-react";
import { motion } from "framer-motion";

export type SnowSection = "dashboard" | "dataset-overview" | "snow-ai" | "prediction";

interface SidebarProps {
  active: SnowSection;
  onNavigate: (section: SnowSection) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const navItems: { id: SnowSection; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "dataset-overview", label: "Dataset Overview", icon: Database },
  { id: "snow-ai", label: "Snow AI", icon: BrainCircuit },
  { id: "prediction", label: "Future Prediction", icon: Activity },
];

export default function Sidebar({ active, onNavigate, collapsed, onToggleCollapsed }: SidebarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  const width = collapsed ? 64 : 220;

  // Prevent hydration mismatch on initial render
  if (!mounted) {
    return (
      <div 
        className="fixed top-[64px] left-0 bottom-[48px] bg-white/[0.02] border-r border-white/[0.08]" 
        style={{ width }} 
      />
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed top-[64px] left-0 bottom-[48px] z-30 bg-white/[0.02] backdrop-blur-md border-r border-white/[0.08] flex flex-col justify-between overflow-hidden"
    >
      <div className="py-6 flex flex-col gap-2 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
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
          onClick={onToggleCollapsed}
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
