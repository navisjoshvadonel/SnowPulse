"use client";

import React, { useState } from "react";
import { Sliders } from "lucide-react";

interface WhatIfSimulatorProps {
  onMultiplierChange: (multiplier: number) => void;
}

export default function WhatIfSimulator({ onMultiplierChange }: WhatIfSimulatorProps) {
  const [multiplier, setMultiplier] = useState<number>(1.1); // +10% growth

  const handleChange = (val: number) => {
    setMultiplier(val);
    onMultiplierChange(val);
  };

  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-white flex items-center gap-2">
          <Sliders size={14} className="text-indigo-400" /> Interactive &quot;What-If&quot; Scenario Adjuster
        </span>
        <span className="text-xs font-mono font-bold text-indigo-300">
          {multiplier > 1.0 ? `+${Math.round((multiplier - 1.0) * 100)}% Growth` : multiplier < 1.0 ? `-${Math.round((1.0 - multiplier) * 100)}% Drop` : "Baseline (0%)"}
        </span>
      </div>

      <input
        type="range"
        min="0.5"
        max="1.5"
        step="0.05"
        value={multiplier}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />

      <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
        <span>-50% Pessimistic</span>
        <span>Baseline (1.0x)</span>
        <span>+50% Optimistic</span>
      </div>
    </div>
  );
}
