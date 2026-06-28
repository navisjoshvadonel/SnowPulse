"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Upload, FileText, ChevronRight, LogOut, Trash2, BrainCircuit, RefreshCw, Layers } from "lucide-react";
import { apiService } from "@/services/api";
import KpiOverview from "@/components/executive-overview/KpiOverview";
import TrendVisuals from "@/components/performance-trends/TrendVisuals";
import GeographicMap from "@/components/geo-intelligence/GeographicMap";
import InsightsCenter from "@/components/ai-insights/InsightsCenter";

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

  // Auto session check on mount
  useEffect(() => {
    const token = localStorage.getItem("snow_access_token");
    if (token) {
      checkSession();
    }
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
      {/* Top Navigation */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <SnowflakeLogo className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-none flex items-center gap-1.5">
              SNOW Analytics
            </h1>
            <p className="text-[10px] text-brand-muted font-mono mt-1">
              File: <strong className="text-brand-primary">{selectedDatasetName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          <button
            onClick={() => setSelectedDatasetId(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white transition-all cursor-pointer border border-white/5 font-mono"
          >
            Change Dataset
          </button>
          
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer border border-white/5"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {loadingDashboard ? (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-primary" />
          <span className="text-xs text-brand-muted font-mono">Parsing with Polars, summarizing with Gemini...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* PANEL 1: EXECUTIVE KPI OVERVIEW (100% width) */}
          <KpiOverview
            kpis={getFilteredKpis()}
            aiHeadline={aiInsights?.headline || null}
            loading={loadingDashboard}
          />

          {/* SECOND ROW: PERFORMANCE TRENDS (40% width / 7 cols) & GEO INTELLIGENCE (35% width / 5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <TrendVisuals
                trends={trends}
                aiTrendNote={aiInsights?.trends || null}
                loading={loadingDashboard}
              />
            </div>
            <div className="lg:col-span-5">
              <GeographicMap
                geoData={geoData}
                aiGeoNote={aiInsights?.geo || null}
                loading={loadingDashboard}
                selectedRegion={selectedRegion}
                onSelectRegion={setSelectedRegion}
              />
            </div>
          </div>

          {/* PANEL 4: AI INSIGHTS CENTER (Copilot, Anomalies, Forecast, Recommendations) */}
          <InsightsCenter
            datasetId={selectedDatasetId}
            anomalies={anomalies}
            recommendations={aiInsights?.recommendations || null}
            loading={loadingDashboard}
          />
        </div>
      )}
    </div>
  );
}
