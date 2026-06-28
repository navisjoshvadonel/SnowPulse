import React, { useState } from "react";
import { Globe, RefreshCw, Filter } from "lucide-react";

interface GeoItem {
  region: string;
  value: number;
  count: number;
}

interface GeographicMapProps {
  geoData: GeoItem[] | null;
  aiGeoNote: string | null;
  loading: boolean;
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
}

export default function GeographicMap({
  geoData,
  aiGeoNote,
  loading,
  selectedRegion,
  onSelectRegion,
}: GeographicMapProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="glass-panel p-6 h-[440px] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  // Fallback mock regions if no geo columns are parsed
  const activeGeo = geoData && geoData.length > 0 ? geoData : [
    { region: "North America", value: 450000, count: 124 },
    { region: "Europe", value: 320000, count: 86 },
    { region: "APAC", value: 580000, count: 192 },
    { region: "Latin America", value: 140000, count: 42 },
    { region: "MEA", value: 950000, count: 99 },
  ];

  const totalGeoValue = activeGeo.reduce((sum, item) => sum + item.value, 0) || 1;

  // Simple SVG paths representing a highly stylized, futuristic minimalist world map regions
  const mapRegions = [
    {
      id: "North America",
      name: "North America",
      // Big polygon for North America
      path: "M 30,30 L 80,30 L 100,60 L 70,80 L 40,80 Z M 25,20 L 45,20 L 40,30 L 20,30 Z",
      center: { x: 60, y: 55 },
    },
    {
      id: "Europe",
      name: "Europe",
      path: "M 130,40 L 170,30 L 180,60 L 140,70 L 130,55 Z",
      center: { x: 155, y: 50 },
    },
    {
      id: "APAC",
      name: "Asia-Pacific",
      path: "M 200,40 L 260,40 L 280,80 L 230,110 L 210,80 Z",
      center: { x: 235, y: 70 },
    },
    {
      id: "Latin America",
      name: "Latin America",
      path: "M 65,95 L 90,95 L 110,140 L 95,170 L 75,145 Z",
      center: { x: 85, y: 130 },
    },
    {
      id: "MEA",
      name: "MEA",
      path: "M 135,75 L 175,75 L 185,110 L 160,135 L 130,115 Z",
      center: { x: 155, y: 100 },
    },
  ];

  // Helper to map DB region name to SVG region ID
  const findGeoValue = (regionId: string) => {
    // Exact or loose match
    const found = activeGeo.find(
      (g) =>
        g.region.toLowerCase().includes(regionId.toLowerCase()) ||
        regionId.toLowerCase().includes(g.region.toLowerCase())
    );
    return found || { region: regionId, value: 0, count: 0 };
  };

  const getHeatColor = (value: number, maxVal: number, isActive: boolean) => {
    if (value === 0) return "fill-gray-800/40 stroke-gray-700/50";
    const pct = value / (maxVal || 1);
    
    if (isActive) {
      if (pct > 0.6) return "fill-brand-primary/80 stroke-brand-primary";
      if (pct > 0.3) return "fill-brand-primary/60 stroke-brand-primary/80";
      return "fill-brand-primary/35 stroke-brand-primary/60";
    }
    
    // Default muted warm copper/indigo heatmap colors for premium dark look
    if (pct > 0.6) return "fill-indigo-600/50 hover:fill-indigo-500/70 stroke-indigo-400/30";
    if (pct > 0.3) return "fill-indigo-700/30 hover:fill-indigo-600/50 stroke-indigo-500/20";
    return "fill-indigo-900/20 hover:fill-indigo-850/40 stroke-indigo-700/10";
  };

  const maxVal = Math.max(...activeGeo.map((g) => g.value)) || 1;
  const hoveredData = hoveredRegion ? findGeoValue(hoveredRegion) : null;

  return (
    <div className="glass-panel p-6 h-[440px] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            Geo Distribution
          </h2>
          <p className="text-xs text-brand-muted">Operational density and regional shares</p>
        </div>
        {selectedRegion && (
          <button
            onClick={() => onSelectRegion(null)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-md font-medium bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/20 transition-all font-mono"
          >
            <Filter className="w-3 h-3" />
            Clear Filter: {selectedRegion}
          </button>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-6 mt-4 items-center">
        {/* SVG Interactive Map (3 cols) */}
        <div className="md:col-span-3 relative h-[220px] flex items-center justify-center bg-black/10 rounded-xl border border-white/3 overflow-hidden">
          <svg viewBox="0 0 300 180" className="w-full h-full p-2 max-w-[340px]">
            <g>
              {mapRegions.map((r) => {
                const geoInfo = findGeoValue(r.id);
                const isSelected = selectedRegion === null || selectedRegion === r.id;
                return (
                  <g key={r.id}>
                    <path
                      d={r.path}
                      className={`cursor-pointer transition-all duration-300 ${getHeatColor(
                        geoInfo.value,
                        maxVal,
                        isSelected
                      )}`}
                      onClick={() => onSelectRegion(selectedRegion === r.id ? null : r.id)}
                      onMouseEnter={() => setHoveredRegion(r.id)}
                      onMouseLeave={() => setHoveredRegion(null)}
                    />
                    {geoInfo.value > 0 && (
                      <circle
                        cx={r.center.x}
                        cy={r.center.y}
                        r="3.5"
                        className="fill-white pointer-events-none shadow"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Interactive Tooltip Overlay */}
          {hoveredRegion && hoveredData && (
            <div className="absolute bottom-3 left-3 bg-[#12141c] border border-white/10 rounded-lg p-2.5 shadow-xl pointer-events-none min-w-[120px] font-sans">
              <p className="text-[10px] text-brand-primary font-bold tracking-wide uppercase font-mono">{hoveredRegion}</p>
              <p className="text-xs font-bold text-white mt-0.5">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(hoveredData.value)}
              </p>
              <div className="flex items-center justify-between text-[9px] text-brand-muted mt-1 font-mono">
                <span>{hoveredData.count} records</span>
                <span>{((hoveredData.value / totalGeoValue) * 100).toFixed(0)}% share</span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Leaderboard (2 cols) */}
        <div className="md:col-span-2 space-y-3.5 h-full flex flex-col justify-center">
          <p className="text-[10px] text-brand-muted font-bold tracking-wider uppercase font-mono">Hub Ranking</p>
          <div className="space-y-2.5 overflow-y-auto max-h-[180px] pr-1">
            {activeGeo.slice(0, 4).map((g, idx) => {
              const share = (g.value / totalGeoValue) * 100;
              const isSelected = selectedRegion === g.region || selectedRegion === null;
              return (
                <div
                  key={idx}
                  onClick={() => onSelectRegion(selectedRegion === g.region ? null : g.region)}
                  className={`group cursor-pointer p-2 rounded-lg border transition-all ${
                    selectedRegion === g.region
                      ? "bg-brand-primary/10 border-brand-primary/30"
                      : "bg-white/1 border-white/2 hover:bg-white/3"
                  }`}
                  style={{ opacity: isSelected ? 1 : 0.4 }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-200 group-hover:text-white truncate max-w-[100px]">{g.region}</span>
                    <span className="font-mono text-white font-semibold">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(g.value)}
                    </span>
                  </div>
                  
                  {/* Share progress bar */}
                  <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedRegion === g.region ? "bg-brand-primary" : "bg-indigo-500/70"
                      }`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Summary Bottom Box */}
      {aiGeoNote && (
        <div className="mt-4 bg-[#12141c]/50 border border-white/5 rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-300 flex items-start gap-2.5">
          <Globe className="w-4 h-4 text-brand-success flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-brand-success mr-1 font-mono text-[9px] tracking-wider uppercase bg-brand-success/20 px-1.5 py-0.5 rounded">
              Geo insight
            </span>
            {aiGeoNote}
          </div>
        </div>
      )}
    </div>
  );
}
