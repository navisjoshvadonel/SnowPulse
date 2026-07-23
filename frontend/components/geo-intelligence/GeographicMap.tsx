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

export default function GeographicMap({
  geoData,
  aiGeoNote,
  loading,
  selectedRegion,
  onSelectRegion,
}: GeographicMapProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Fallback mock regions if no geo columns are parsed
  const activeGeo = geoData && geoData.length > 0 ? geoData : [
    { region: "North America", value: 520138, count: 38 },
    { region: "Europe", value: 312040, count: 26 },
    { region: "APAC", value: 284925, count: 22 },
    { region: "LATAM", value: 287614, count: 18 },
    { region: "MEA", value: 142300, count: 12 },
  ];

  const totalGeoValue = activeGeo.reduce((sum, item) => sum + item.value, 0) || 1;
  const maxVal = Math.max(...activeGeo.map((g) => g.value)) || 1;

  // Region/country mapping
  const regionToCountriesMap: Record<string, string[]> = {
    "North America": ["United States", "Canada"],
    "USA": ["United States"],
    "Canada": ["Canada"],
    "Mexico & Central America": ["Mexico"],
    "Mexico": ["Mexico"],
    "South America": ["Brazil"],
    "Brazil": ["Brazil"],
    "Latin America": ["Brazil", "Mexico"],
    "LATAM": ["Brazil", "Mexico"],
    "Europe": ["Germany", "United Kingdom"],
    "Germany": ["Germany"],
    "United Kingdom": ["United Kingdom"],
    "UK": ["United Kingdom"],
    "Russia": ["Russia"],
    "Africa": ["Egypt", "South Africa"],
    "South Africa": ["South Africa"],
    "Egypt": ["Egypt"],
    "Middle East": ["Saudi Arabia"],
    "Saudi Arabia": ["Saudi Arabia"],
    "China": ["China"],
    "India": ["India"],
    "Japan": ["Japan"],
    "Australia": ["Australia"],
    "China & East Asia": ["China"],
    "India & South Asia": ["India"],
    "APAC": ["China", "India", "Japan", "Australia"],
    "MEA": ["Saudi Arabia", "Egypt", "South Africa"],
  };

  useEffect(() => {
    if (loading || !chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }

    // SVG World Map definition
    const worldSvg = `<?xml version="1.0" encoding="utf-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
      <!-- Canada -->
      <path id="Canada" name="Canada" d="M 80,60 L 240,40 L 280,60 L 260,110 L 210,120 L 140,110 L 80,100 Z" style="cursor:pointer;" />
      <!-- United States -->
      <path id="USA" name="United States" d="M 90,105 L 240,112 L 255,145 L 220,165 L 140,160 L 95,130 Z" style="cursor:pointer;" />
      <!-- Mexico -->
      <path id="Mexico" name="Mexico" d="M 95,135 L 140,165 L 155,200 L 130,225 L 105,190 Z" style="cursor:pointer;" />
      <!-- Brazil -->
      <path id="Brazil" name="Brazil" d="M 180,220 L 225,230 L 250,265 L 220,360 L 180,330 L 155,260 Z" style="cursor:pointer;" />
      <!-- Greenland -->
      <path id="Greenland" name="Greenland" d="M 280,30 L 340,20 L 320,60 L 290,50 Z" style="cursor:pointer;" />
      <!-- United Kingdom -->
      <path id="United Kingdom" name="United Kingdom" d="M 335,95 L 348,90 L 345,115 L 332,112 Z" style="cursor:pointer;" />
      <!-- Germany -->
      <path id="Germany" name="Germany" d="M 345,115 L 385,110 L 400,145 L 360,165 L 340,150 Z" style="cursor:pointer;" />
      <!-- Russia -->
      <path id="Russia" name="Russia" d="M 388,105 L 680,95 L 720,145 L 520,165 L 405,150 Z" style="cursor:pointer;" />
      <!-- Egypt -->
      <path id="Egypt" name="Egypt" d="M 350,185 L 480,175 L 490,230 L 390,260 L 340,240 Z" style="cursor:pointer;" />
      <!-- South Africa -->
      <path id="South Africa" name="South Africa" d="M 392,262 L 490,232 L 515,310 L 470,395 L 420,365 L 395,300 Z" style="cursor:pointer;" />
      <!-- Saudi Arabia -->
      <path id="Saudi Arabia" name="Saudi Arabia" d="M 470,178 L 520,178 L 530,215 L 485,230 Z" style="cursor:pointer;" />
      <!-- India -->
      <path id="India" name="India" d="M 535,200 L 585,205 L 575,250 L 545,250 Z" style="cursor:pointer;" />
      <!-- China -->
      <path id="China" name="China" d="M 532,142 L 670,140 L 690,210 L 610,235 L 540,205 Z" style="cursor:pointer;" />
      <!-- Japan -->
      <path id="Japan" name="Japan" d="M 700,135 L 715,140 L 708,175 L 695,170 Z" style="cursor:pointer;" />
      <!-- Australia -->
      <path id="Australia" name="Australia" d="M 640,310 L 740,325 L 730,380 L 630,365 Z" style="cursor:pointer;" />
    </svg>`;

    echarts.registerMap("world_svg", { svg: worldSvg });

    // Map input dataset regions to countries for ECharts
    const chartData: any[] = [];
    activeGeo.forEach((item) => {
      const regName = item.region || "";
      const val = item.value || 0;

      // Exact or loose match of region name to SVG countries
      const directMatchKey = Object.keys(regionToCountriesMap).find(
        (key) => key.toLowerCase() === regName.toLowerCase()
      );

      if (directMatchKey) {
        regionToCountriesMap[directMatchKey].forEach((country) => {
          chartData.push({
            name: country,
            value: val,
            originalRegion: regName,
            selected: selectedRegion === regName,
          });
        });
      } else {
        let matched = false;
        for (const [key, countries] of Object.entries(regionToCountriesMap)) {
          if (regName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(regName.toLowerCase())) {
            countries.forEach((country) => {
              chartData.push({
                name: country,
                value: val,
                originalRegion: regName,
                selected: selectedRegion === regName,
              });
            });
            matched = true;
            break;
          }
        }
        if (!matched) {
          chartData.push({
            name: regName,
            value: val,
            originalRegion: regName,
            selected: selectedRegion === regName,
          });
        }
      }
    });

    const chart = echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    chartInstance.current = chart;

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#12151e",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        textStyle: { color: "#f3f4f6", fontFamily: "Inter, sans-serif", fontSize: 11 },
        formatter: (params: any) => {
          if (params.data) {
            const formattedVal = new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(params.data.value);
            return `<div style="padding:2px 4px">
              <strong style="color:#fff">${params.name}</strong><br/>
              <span style="color:rgba(255,255,255,0.5)">Region:</span> ${params.data.originalRegion}<br/>
              <span style="color:#818cf8;font-weight:bold">${formattedVal}</span>
            </div>`;
          }
          return `<div style="padding:2px 4px"><strong style="color:#fff">${params.name}</strong><br/><span style="color:rgba(255,255,255,0.3)">No Data</span></div>`;
        },
      },
      visualMap: {
        show: false,
        min: 0,
        max: maxVal,
        inRange: {
          color: [
            "rgba(80, 99, 244, 0.15)", // Muted purple-blue
            "rgba(80, 99, 244, 0.4)",
            "rgba(80, 99, 244, 0.85)", // Vibrant brand color
          ],
        },
      },
      series: [
        {
          name: "World Map",
          type: "map",
          map: "world_svg",
          roam: false,
          selectedMode: "single",
          itemStyle: {
            areaColor: "rgba(255, 255, 255, 0.03)",
            borderColor: "rgba(255, 255, 255, 0.08)",
            borderWidth: 1,
          },
          emphasis: {
            itemStyle: {
              areaColor: "rgba(80, 99, 244, 0.35)",
              borderColor: "rgba(80, 99, 244, 0.8)",
            },
            label: {
              show: false,
            },
          },
          select: {
            itemStyle: {
              areaColor: "rgba(80, 99, 244, 0.5)",
              borderColor: "rgba(80, 99, 244, 1)",
            },
            label: {
              show: false,
            },
          },
          data: chartData,
        },
      ],
    };

    chart.setOption(option);

    chart.on("click", (params: any) => {
      if (params.data && params.data.originalRegion) {
        const origReg = params.data.originalRegion;
        onSelectRegion(selectedRegion === origReg ? null : origReg);
      } else {
        onSelectRegion(null);
      }
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      chart.dispose();
      chartInstance.current = null;
      window.removeEventListener("resize", handleResize);
    };
  }, [geoData, loading, selectedRegion]);

  if (loading) {
    return (
      <div className="glass-panel p-6 h-[440px] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-brand-primary" />
      </div>
    );
  }

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
        {/* ECharts Interactive Map (3 cols) */}
        <div className="md:col-span-3 relative h-[220px] flex items-center justify-center bg-black/10 rounded-xl border border-white/3 overflow-hidden">
          <div ref={chartRef} className="w-full h-full" />
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
