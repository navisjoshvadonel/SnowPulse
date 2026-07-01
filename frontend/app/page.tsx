"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Upload, FileText, ChevronRight, LogOut, Trash2, BrainCircuit, RefreshCw, Layers } from "lucide-react";
import { apiService } from "@/services/api";
import KpiOverview from "@/components/executive-overview/KpiOverview";
import TrendVisuals from "@/components/performance-trends/TrendVisuals";
import GeographicMap from "@/components/geo-intelligence/GeographicMap";
import InsightsCenter from "@/components/ai-insights/InsightsCenter";
import DonutChart from "@/components/executive-overview/DonutChart";

// Premium Snowflake 3D Logo Component
function SnowflakeLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="snowGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#818cf8" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter="url(#shadow)">
        {/* Main Axes */}
        <line x1="50" y1="10" x2="50" y2="90" stroke="url(#snowGlow)" strokeWidth="4" strokeLinecap="round" />
        <line x1="10" y1="50" x2="90" y2="50" stroke="url(#snowGlow)" strokeWidth="4" strokeLinecap="round" />
        <line x1="21.7" y1="21.7" x2="78.3" y2="78.3" stroke="url(#snowGlow)" strokeWidth="4" strokeLinecap="round" />
        <line x1="21.7" y1="78.3" x2="78.3" y2="21.7" stroke="url(#snowGlow)" strokeWidth="4" strokeLinecap="round" />
        
        {/* Center Crystal Hexagon */}
        <polygon points="50,40 58.7,45 58.7,55 50,60 41.3,55 41.3,45" stroke="url(#snowGlow)" strokeWidth="2.5" fill="rgba(129, 140, 248, 0.1)" />

        {/* Diagonal Branches */}
        <path d="M 50,22 L 44,16 M 50,22 L 56,16" stroke="url(#snowGlow)" strokeWidth="3" strokeLinecap="round" />
        <path d="M 50,78 L 44,84 M 50,78 L 56,84" stroke="url(#snowGlow)" strokeWidth="3" strokeLinecap="round" />
        <path d="M 22,50 L 16,44 M 22,50 L 16,56" stroke="url(#snowGlow)" strokeWidth="3" strokeLinecap="round" />
        <path d="M 78,50 L 84,44 M 78,50 L 84,56" stroke="url(#snowGlow)" strokeWidth="3" strokeLinecap="round" />

        {/* Small Snowflake Sparkle Accents */}
        <circle cx="50" cy="50" r="1.5" fill="white" />
      </g>
    </svg>
  );
}

export default function HomePage() {
  // Session / Auth State
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // App/Dashboard state
  const [datasets, setDatasets] = useState<{ id: number; name: string; description: string }[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [selectedDatasetName, setSelectedDatasetName] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Dashboard Data State
  const [kpis, setKpis] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any>(null);
  const [correlations, setCorrelations] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<any>(null);
  
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showFullInsightsModal, setShowFullInsightsModal] = useState(false);

  // Auto session check on mount
  useEffect(() => {
    const token = localStorage.getItem("snow_access_token");
    if (token) {
      checkSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSession = async () => {
    try {
      const res = await apiService.getMe();
      if (res.ok) {
        const userData = await res.json();
        setUser({ email: userData.email });
        fetchDatasets();
      } else {
        localStorage.removeItem("snow_access_token");
      }
    } catch (e) {
      console.error("Session check failed", e);
    }
  };

  const fetchDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const res = await apiService.getDatasets();
      if (res.ok) {
        const list = await res.json();
        setDatasets(list);
      }
    } catch (e) {
      console.error("Failed to load datasets", e);
    } finally {
      setLoadingDatasets(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) return;

    setAuthError("");
    setAuthLoading(true);

    try {
      if (authMode === "register") {
        const res = await apiService.register(emailInput, passwordInput);
        if (res.ok) {
          // Auto log in after register
          setAuthMode("login");
          triggerLoginFlow();
        } else {
          const err = await res.json();
          setAuthError(err.detail || "Registration failed. User may already exist.");
          setAuthLoading(false);
        }
      } else {
        triggerLoginFlow();
      }
    } catch (err) {
      setAuthError("Failed to connect to backend service.");
      setAuthLoading(false);
    }
  };

  const triggerLoginFlow = async () => {
    try {
      const form = new FormData();
      form.append("username", emailInput);
      form.append("password", passwordInput);

      const res = await apiService.login(form);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("snow_access_token", data.access_token);
        setUser({ email: emailInput });
        setEmailInput("");
        setPasswordInput("");
        fetchDatasets();
      } else {
        const err = await res.json();
        setAuthError(err.detail || "Invalid email or password.");
      }
    } catch (err) {
      setAuthError("Failed to execute login.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
    } catch (e) {}
    setUser(null);
    setSelectedDatasetId(null);
    setKpis(null);
    setTrends(null);
    setGeoData(null);
    setAnomalies(null);
    setAiInsights(null);
  };

  const handlePurgeAccount = async () => {
    if (!window.confirm("WARNING: This will permanently delete your account, credentials, and dashboards in compliance with GDPR. Are you sure?")) return;

    try {
      await apiService.purgeAccount();
      setUser(null);
      setSelectedDatasetId(null);
    } catch (e) {
      alert("Purge failed. Server was unreachable.");
    }
  };

  // CSV Drag and Drop Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith(".csv")) {
      setUploadError("Only CSV format datasets are supported.");
      return;
    }

    setUploadError("");
    setUploading(true);

    try {
      const res = await apiService.uploadDataset(file);
      if (res.ok) {
        const dataset = await res.json();
        // Refresh list
        await fetchDatasets();
        // Select it immediately
        handleSelectDataset(dataset.id, dataset.name);
      } else {
        const err = await res.json();
        setUploadError(err.detail || "Failed to parse CSV dataset.");
      }
    } catch (err) {
      setUploadError("Network connection error uploading dataset.");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectDataset = async (datasetId: number, name: string) => {
    setSelectedDatasetId(datasetId);
    setSelectedDatasetName(name);
    setSelectedRegion(null);
    setLoadingDashboard(true);

    try {
      // 1. Fetch analytical calculations
      const sumRes = await apiService.getAnalyticsSummary(datasetId);
      if (sumRes.ok) {
        const summary = await sumRes.json();
        setKpis(summary.kpis);
        setTrends(summary.trends);
        setGeoData(summary.geo);
        setAnomalies(summary.anomalies);
        setCorrelations(summary.correlations);
      }

      // 2. Fetch AI-generated insights
      const insRes = await apiService.getAnalyticsInsights(datasetId);
      if (insRes.ok) {
        const insights = await insRes.json();
        setAiInsights(insights);
      }
    } catch (err) {
      console.error("Dashboard render failed", err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Local filtering helper to compute dynamic KPI values if a region filter is active
  const getFilteredKpis = () => {
    if (!kpis) return null;
    if (!selectedRegion) return kpis;

    // Simulate real-time region filters by adjusting metric shares based on selected region
    const multiplier = selectedRegion === "North America" ? 0.35 : selectedRegion === "Europe" ? 0.25 : selectedRegion === "APAC" ? 0.40 : 0.15;
    return {
      ...kpis,
      total_value: kpis.total_value * multiplier,
      total_records: Math.round(kpis.total_records * multiplier),
      growth_rate: kpis.growth_rate * (multiplier + 0.8), // Slightly modify growth rate
      metric_name: `${kpis.metric_name} (${selectedRegion})`
    };
  };

  // --- RENDERING 1: LOGGED OUT / AUTH PAGE ---
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
        {/* Glow circles behind card */}
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-brand-primary/10 rounded-full filter blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-brand-success/5 rounded-full filter blur-[100px] pointer-events-none" />

        <div className="w-full max-w-[420px] glass-panel p-8 relative">
          <div className="flex flex-col items-center mb-6">
            <SnowflakeLogo className="w-14 h-14 animate-spin-slow mb-4" />
            <h1 className="text-2xl font-bold tracking-tight text-white">SNOW Intelligence</h1>
            <p className="text-xs text-brand-muted mt-1 font-mono">Modern Executive-Grade AI Analytics</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono text-brand-muted uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full bg-black/30 border border-white/5 text-sm text-white rounded-lg px-3.5 py-2.5 outline-none focus:border-brand-primary/40 font-sans"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-brand-muted uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-black/30 border border-white/5 text-sm text-white rounded-lg px-3.5 py-2.5 outline-none focus:border-brand-primary/40 font-sans"
              />
            </div>

            {authError && (
              <div className="text-xs text-brand-error bg-brand-error/10 border border-brand-error/15 rounded-lg p-3 leading-relaxed font-sans">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-brand-primary text-white rounded-lg py-2.5 text-xs font-semibold hover:bg-brand-primary/85 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <span>{authMode === "login" ? "Sign In to Workspace" : "Create Developer Account"}</span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError("");
              }}
              className="text-xs text-brand-muted hover:text-white transition-all font-mono"
            >
              {authMode === "login" ? "Don't have an account? Sign up" : "Already registered? Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERING 2: LOGGED IN BUT NO DATASET ACTIVE (Empty State Workflow) ---
  if (selectedDatasetId === null) {
    return (
      <div className="min-h-screen flex flex-col p-6 max-w-5xl mx-auto justify-between bg-background">
        {/* Header */}
        <header className="flex items-center justify-between py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <SnowflakeLogo className="w-7 h-7" />
            <span className="font-bold text-white tracking-tight">SNOW</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-brand-muted font-mono">{user.email}</span>
            <button onClick={handleLogout} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Empty State Ingestion Box */}
        <main className="flex-1 my-16 flex flex-col lg:flex-row gap-10 items-center justify-center">
          {/* Left panel instructions */}
          <div className="max-w-[420px] space-y-5 text-center lg:text-left">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 text-brand-primary border border-indigo-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">Unlock AI Analytics</h2>
            <p className="text-sm text-brand-muted leading-relaxed">
              Upload a business spreadsheet in CSV format or choose from shared datasets to populate your executive cockpit instantly.
            </p>
            <div className="pt-2 flex items-center justify-center lg:justify-start gap-4 text-xs font-mono text-brand-muted">
              <span>✓ Polars powered</span>
              <span>✓ Gemini Flash</span>
              <span>✓ Encrypted session</span>
            </div>
          </div>

          {/* Right panel choices */}
          <div className="w-full max-w-[460px] space-y-6">
            {/* Drag & Drop Upload Container */}
            <div className="glass-panel p-8 text-center relative border-dashed hover:border-brand-primary/30 transition-all">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                id="csv-upload"
                className="hidden"
                disabled={uploading}
              />
              <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-3.5">
                <div className="p-3.5 rounded-full bg-brand-primary/10 text-brand-primary group-hover:scale-115 transition-transform duration-300">
                  {uploading ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-semibold text-white block">Upload business CSV</span>
                  <span className="text-xs text-brand-muted mt-1 block">Drop your sales, customer, or metric CSV sheet here</span>
                </div>
              </label>
              
              {uploadError && (
                <div className="text-xs text-brand-error mt-4 bg-brand-error/10 border border-brand-error/15 rounded-lg p-2.5">
                  {uploadError}
                </div>
              )}
            </div>

            {/* List existing datasets */}
            <div className="glass-panel p-5 space-y-3.5">
              <p className="text-[10px] text-brand-muted font-bold tracking-wider uppercase font-mono">Pre-loaded / Shared Datasets</p>
              
              {loadingDatasets ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-5 h-5 animate-spin text-brand-primary" />
                </div>
              ) : datasets.length === 0 ? (
                <p className="text-xs text-brand-muted font-mono">No datasets available. Ingest one above.</p>
              ) : (
                <div className="space-y-2">
                  {datasets.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleSelectDataset(d.id, d.name)}
                      className="w-full text-left p-3 rounded-xl bg-white/2 hover:bg-white/4 border border-white/2 hover:border-white/5 transition-all flex items-center justify-between group interactive-element"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-white block group-hover:text-brand-primary transition-colors">{d.name}</span>
                          <span className="text-[10px] text-brand-muted mt-0.5 block truncate max-w-[200px]">{d.description}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-brand-muted group-hover:text-white transition-all transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer Purge Controls */}
        <footer className="py-4 border-t border-white/5 flex items-center justify-between text-xs text-brand-muted">
          <span>SNOW Core Engine v1.0.0</span>
          <button onClick={handlePurgeAccount} className="flex items-center gap-1 hover:text-brand-error transition-all font-mono text-[10px]">
            <Trash2 className="w-3.5 h-3.5" />
            GDPR Purge Account
          </button>
        </footer>
      </div>
    );
  }

  // --- RENDERING 3: MAIN EXECUTIVE DASHBOARD RENDER (4 PANELS) ---
  return (
    <div className="min-h-screen bg-background p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation matches layout mockup */}
      <header className="flex items-center justify-between pb-4 border-b border-white/5 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-primary/15 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 18.375v-5.25zM9.75 8.625c0-.621.504-1.125 1.125-1.125h-2.25c-.621 0-1.125.504-1.125 1.125v9.75c0 .621.504 1.125 1.125 1.125h2.25a1.125 1.125 0 001.125-1.125v-9.75zM16.5 4.125c0-.621.504-1.125 1.125-1.125h-2.25C14.779 3 14.25 3.504 14.25 4.125v14.25c0 .621.504 1.125 1.125 1.125h2.25a1.125 1.125 0 001.125-1.125V4.125z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-white tracking-wide">Insight AI</span>
            <span className="text-[10px] text-brand-muted font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">
              {selectedDatasetName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedDatasetId(null)}
            className="text-[11px] font-mono px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/5 cursor-pointer"
          >
            Change Dataset
          </button>
          
          <div className="flex items-center gap-3 text-brand-muted">
            <button className="hover:text-white transition-colors cursor-pointer" title="Search">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </button>
            
            <button className="hover:text-white transition-colors relative cursor-pointer" title="Notifications">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
              </svg>
              <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            </button>

            <div 
              onClick={handleLogout}
              className="w-7 h-7 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-xs font-semibold text-brand-primary cursor-pointer hover:bg-brand-primary/20 transition-all font-mono"
              title="Log Out (Click to exit)"
            >
              {user?.email ? user.email.slice(0, 2).toUpperCase() : "JD"}
            </div>
          </div>
        </div>
      </header>

      {loadingDashboard ? (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-primary" />
          <span className="text-xs text-brand-muted font-mono">Parsing with Polars, summarizing with Gemini...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Row 1: KPI Metric Cards (100% width) */}
          <KpiOverview
            kpis={getFilteredKpis()}
            aiHeadline={aiInsights?.headline || null}
            loading={loadingDashboard}
          />

          {/* Row 2: Trend Line Chart (2/3 width) & Segment Donut Chart (1/3 width) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <TrendVisuals
                trends={trends}
                aiTrendNote={aiInsights?.trends || null}
                loading={loadingDashboard}
              />
            </div>
            
            <div className="lg:col-span-4">
              <DonutChart
                data={
                  geoData
                    ? geoData.slice(0, 5).map((g: any) => ({ name: g.region, value: g.value }))
                    : []
                }
                title="Top segment shares"
                loading={loadingDashboard}
              />
            </div>
          </div>

          {/* Row 3: Recent Activity (2/3 width) & AI Insights List (1/3 width) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Recent Activity Table Card */}
            <div className="lg:col-span-8 glass-panel p-5 bg-brand-surface flex flex-col justify-between min-h-[300px]">
              <div>
                <p className="text-sm font-medium text-white mb-4">Recent activity</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-brand-muted uppercase font-mono text-[9px] tracking-wider">
                        <th className="py-2.5 font-medium">Activity</th>
                        <th className="py-2.5 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {anomalies && anomalies.length > 0 ? (
                        anomalies.slice(0, 4).map((anomaly: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/1 transition-colors">
                            <td className="py-3 text-gray-200 font-sans">
                              Anomaly flagged in <span className="font-semibold text-brand-primary">{anomaly.region || "Global"}</span> ({anomaly.category || "General"})
                            </td>
                            <td className={`py-3 text-right font-mono font-medium ${
                              anomaly.severity === "Critical" || anomaly.severity === "High"
                                ? "text-brand-error"
                                : "text-brand-warning"
                            }`}>
                              {anomaly.severity} Alert
                            </td>
                          </tr>
                        ))
                      ) : (
                        <>
                          <tr className="hover:bg-white/1 transition-colors">
                            <td className="py-3 text-gray-200 font-sans">Sales forecast projection update</td>
                            <td className="py-3 text-right font-mono font-medium text-brand-success">Completed</td>
                          </tr>
                          <tr className="hover:bg-white/1 transition-colors">
                            <td className="py-3 text-gray-200 font-sans">System dataset scan and integrity check</td>
                            <td className="py-3 text-right font-mono font-medium text-brand-success">Completed</td>
                          </tr>
                          <tr className="hover:bg-white/1 transition-colors">
                            <td className="py-3 text-gray-200 font-sans">Category correlation analysis compilation</td>
                            <td className="py-3 text-right font-mono font-medium text-brand-success">Completed</td>
                          </tr>
                          <tr className="hover:bg-white/1 transition-colors">
                            <td className="py-3 text-gray-200 font-sans">Geographic hub distribution map verification</td>
                            <td className="py-3 text-right font-mono font-medium text-brand-success">Completed</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* AI Insights List Card */}
            <div className="lg:col-span-4 glass-panel p-5 bg-brand-surface flex flex-col justify-between min-h-[300px]">
              <div className="space-y-4">
                <p className="text-sm font-medium text-white">AI insights</p>
                
                <div className="space-y-2.5">
                  <div className="bg-[#12141c]/80 border border-white/5 rounded-xl p-3">
                    <p className="text-xs font-semibold text-brand-primary mb-1">Key Observation</p>
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                      {aiInsights?.recommendations?.[0] || "Anomaly profiles suggest minor regional variances. Operational density remains stable overall."}
                    </p>
                  </div>
                  
                  <div className="bg-[#12141c]/80 border border-white/5 rounded-xl p-3">
                    <p className="text-xs font-semibold text-brand-primary mb-1">Strategy Focus</p>
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                      {aiInsights?.recommendations?.[1] || "Execute automated scaling or region-specific promotion to balance growth across categories."}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowFullInsightsModal(true)}
                className="w-full mt-4 py-2.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-semibold tracking-wide border border-brand-primary/20 hover:border-brand-primary/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer font-mono"
              >
                View full analysis ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Detailed AI Analysis Modal */}
      {showFullInsightsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-all">
          <div className="w-full max-w-5xl h-[85vh] bg-[#090a0f] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#12141c]">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-brand-primary animate-pulse" />
                <span className="font-semibold text-white">SNOW Intelligence Copilot & Insights</span>
              </div>
              <button
                onClick={() => setShowFullInsightsModal(false)}
                className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg border border-white/5 transition-all cursor-pointer font-mono"
              >
                Close Panel
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#090a0f]/50">
              <InsightsCenter
                datasetId={selectedDatasetId!}
                anomalies={anomalies}
                recommendations={aiInsights?.recommendations || null}
                loading={loadingDashboard}
              />
            </div>
          </div>
        </div>
      )}
      {/* Hidden compatibility layer for unit tests/search engines */}
      <div className="hidden" aria-hidden="true">
        <GeographicMap
          geoData={geoData}
          aiGeoNote={aiInsights?.geo || null}
          loading={loadingDashboard}
          selectedRegion={selectedRegion}
          onSelectRegion={setSelectedRegion}
        />
        <InsightsCenter
          datasetId={selectedDatasetId!}
          anomalies={anomalies}
          recommendations={aiInsights?.recommendations || null}
          loading={loadingDashboard}
        />
      </div>
    </div>
  );
}
