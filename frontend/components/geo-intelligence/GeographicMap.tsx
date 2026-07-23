"use client";

import React, { useEffect, useRef, useState } from "react";
import { Globe, RefreshCw, Filter } from "lucide-react";
import * as echarts from "echarts";

interface GeoItem {
  region: string;
  value: number;
  count?: number;
}

interface GeographicMapProps {
  geoData: GeoItem[] | null;
  aiGeoNote: string | null;
  loading: boolean;
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
}

// Maps dataset region labels → ECharts world map country names
const regionToCountriesMap: Record<string, string[]> = {
  "North America": ["United States", "Canada"],
  "USA": ["United States"],
  "Canada": ["Canada"],
  "Mexico & Central America": ["Mexico"],
  "Mexico": ["Mexico"],
  "South America": ["Brazil", "Argentina", "Colombia"],
  "Brazil": ["Brazil"],
  "Latin America": ["Brazil", "Mexico", "Argentina"],
  "LATAM": ["Brazil", "Mexico", "Argentina", "Colombia"],
  "Europe": ["Germany", "United Kingdom", "France", "Italy", "Spain"],
  "Germany": ["Germany"],
  "United Kingdom": ["United Kingdom"],
  "UK": ["United Kingdom"],
  "France": ["France"],
  "Italy": ["Italy"],
  "Spain": ["Spain"],
  "Russia": ["Russia"],
  "Africa": ["Egypt", "South Africa", "Nigeria"],
  "South Africa": ["South Africa"],
  "Egypt": ["Egypt"],
  "Nigeria": ["Nigeria"],
  "Middle East": ["Saudi Arabia", "UAE"],
  "Saudi Arabia": ["Saudi Arabia"],
  "UAE": ["United Arab Emirates"],
  "India": ["India"],
  "China": ["China"],
  "Japan": ["Japan"],
  "Australia": ["Australia"],
  "China & East Asia": ["China", "South Korea", "Japan"],
  "India & South Asia": ["India", "Pakistan", "Bangladesh"],
  "APAC": ["China", "India", "Japan", "Australia", "South Korea"],
  "MEA": ["Saudi Arabia", "Egypt", "South Africa", "Nigeria"],
};

export default function GeographicMap({
  geoData,
  aiGeoNote,
  loading,
  selectedRegion,
  onSelectRegion,
}: GeographicMapProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Fallback mock regions if no geo columns parsed
  const activeGeo =
    geoData && geoData.length > 0
      ? geoData
      : [
          { region: "North America", value: 520138, count: 38 },
          { region: "Europe", value: 312040, count: 26 },
          { region: "APAC", value: 284925, count: 22 },
          { region: "LATAM", value: 287614, count: 18 },
          { region: "MEA", value: 142300, count: 12 },
        ];

  const totalGeoValue = activeGeo.reduce((sum, item) => sum + item.value, 0) || 1;
  const maxVal = Math.max(...activeGeo.map((g) => g.value)) || 1;

  // Load and register the real world GeoJSON map
  useEffect(() => {
    // Check if world map is already registered
    if ((echarts as any).getMap("world")) {
      setMapLoaded(true);
      return;
    }

    fetch(
      "https://raw.githubusercontent.com/apache/echarts/5.4.3/test/data/map/json/world.json"
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load world map");
        return r.json();
      })
      .then((geoJson) => {
        echarts.registerMap("world", geoJson);
        setMapLoaded(true);
      })
      .catch(() => {
        // Fallback: try alternate CDN
        return fetch(
          "https://cdn.jsdelivr.net/npm/echarts@5.4.3/map/json/world.json"
        )
          .then((r) => r.json())
          .then((geoJson) => {
            echarts.registerMap("world", geoJson);
            setMapLoaded(true);
          })
          .catch(() => setMapError(true));
      });
  }, []);

  // Render the ECharts choropleth once GeoJSON is loaded
  useEffect(() => {
    if (!mapLoaded || loading || !chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }

    // Build per-country data from region mapping
    const chartData: { name: string; value: number; originalRegion: string }[] = [];
    activeGeo.forEach((item) => {
      const regName = item.region || "";
      const val = item.value || 0;

      const directKey = Object.keys(regionToCountriesMap).find(
        (key) => key.toLowerCase() === regName.toLowerCase()
      );

      if (directKey) {
        regionToCountriesMap[directKey].forEach((country) => {
          chartData.push({ name: country, value: val, originalRegion: regName });
        });
      } else {
        let matched = false;
        for (const [key, countries] of Object.entries(regionToCountriesMap)) {
          if (
            regName.toLowerCase().includes(key.toLowerCase()) ||
            key.toLowerCase().includes(regName.toLowerCase())
          ) {
            countries.forEach((country) => {
              chartData.push({ name: country, value: val, originalRegion: regName });
            });
            matched = true;
            break;
          }
        }
        if (!matched) {
          chartData.push({ name: regName, value: val, originalRegion: regName });
        }
      }
    });

    const chart = echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    chartInstance.current = chart;

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#0e1018",
        borderColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: "#f3f4f6", fontFamily: "Inter, sans-serif", fontSize: 11 },
        formatter: (params: any) => {
          if (params.data) {
            const formattedVal = new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(params.data.value);
            return `<div style="line-height:1.6">
              <strong style="color:#fff;font-size:12px">${params.name}</strong><br/>
              <span style="color:rgba(255,255,255,0.45);font-size:10px">Region: ${params.data.originalRegion}</span><br/>
              <span style="color:#818cf8;font-weight:700;font-size:13px">${formattedVal}</span>
            </div>`;
          }
          return `<div style="line-height:1.5"><strong style="color:#fff">${params.name}</strong><br/><span style="color:rgba(255,255,255,0.3);font-size:10px">No data</span></div>`;
        },
      },
      visualMap: {
        show: false,
        min: 0,
        max: maxVal,
        inRange: {
          color: [
            "rgba(80,99,244,0.07)",
            "rgba(80,99,244,0.3)",
            "rgba(80,99,244,0.6)",
            "rgba(99,102,241,0.85)",
            "rgba(129,140,248,1)",
          ],
        },
      },
      series: [
        {
          name: "Geo Distribution",
          type: "map",
          map: "world",
          roam: true, // enable pan/zoom
          scaleLimit: { min: 0.8, max: 6 },
          zoom: 1.2,
          center: [15, 15],
          selectedMode: "single",
          itemStyle: {
            areaColor: "rgba(255,255,255,0.025)",
            borderColor: "rgba(255,255,255,0.07)",
            borderWidth: 0.5,
          },
          emphasis: {
            disabled: false,
            itemStyle: {
              areaColor: "rgba(80,99,244,0.4)",
              borderColor: "rgba(129,140,248,0.9)",
              borderWidth: 1,
            },
            label: { show: false },
          },
          select: {
            itemStyle: {
              areaColor: "rgba(80,99,244,0.65)",
              borderColor: "rgba(129,140,248,1)",
              borderWidth: 1.5,
            },
            label: { show: false },
          },
          data: chartData,
        },
      ],
    };

    chart.setOption(option);

    chart.on("click", (params: any) => {
      if (params.data?.originalRegion) {
        const origReg = params.data.originalRegion;
        onSelectRegion(selectedRegion === origReg ? null : origReg);
      } else {
        onSelectRegion(null);
      }
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      chartInstance.current = null;
    };
  }, [mapLoaded, geoData, loading, selectedRegion]);

  const isLoading = loading || (!mapLoaded && !mapError);

  return (
    <div className="glass-panel p-6 flex flex-col" style={{ height: 440 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-primary" />
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
            Clear: {selectedRegion}
          </button>
        )}
      </div>

      {/* Main body */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* World Map */}
        <div className="flex-1 relative rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.04)" }}>
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-brand-primary" />
              <p className="text-[10px] text-white/30 font-mono">Loading world map…</p>
            </div>
          ) : mapError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <Globe className="w-6 h-6 text-white/20" />
              <p className="text-xs text-white/30">Map unavailable — check network</p>
            </div>
          ) : (
            <div ref={chartRef} className="w-full h-full" />
          )}

          {/* Zoom hint */}
          {!isLoading && !mapError && (
            <div className="absolute bottom-2 right-2 text-[9px] font-mono text-white/20 pointer-events-none select-none">
              Scroll to zoom · Drag to pan
            </div>
          )}
        </div>

        {/* Ranking sidebar */}
        <div className="w-44 flex flex-col justify-center gap-3 flex-shrink-0">
          <p className="text-[10px] text-brand-muted font-bold tracking-wider uppercase font-mono">Hub Ranking</p>
          <div className="space-y-2.5">
            {activeGeo.slice(0, 5).map((g, idx) => {
              const share = (g.value / totalGeoValue) * 100;
              const isSelected = selectedRegion === g.region;
              const dimmed = selectedRegion !== null && !isSelected;
              return (
                <div
                  key={idx}
                  onClick={() => onSelectRegion(isSelected ? null : g.region)}
                  className={`cursor-pointer p-2 rounded-lg border transition-all ${
                    isSelected
                      ? "bg-brand-primary/12 border-brand-primary/30"
                      : "bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.04]"
                  }`}
                  style={{ opacity: dimmed ? 0.35 : 1 }}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-gray-200 truncate max-w-[80px] text-[11px]">{g.region}</span>
                    <span className="font-mono text-white font-bold text-[10px]">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                        notation: "compact",
                        compactDisplay: "short",
                      } as any).format(g.value)}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-[3px] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSelected ? "bg-brand-primary" : "bg-indigo-500/60"
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

      {/* AI Note */}
      {aiGeoNote && (
        <div className="mt-4 bg-[#12141c]/50 border border-white/5 rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-300 flex items-start gap-2.5 flex-shrink-0">
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
