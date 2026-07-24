"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Upload,
  FileText,
  ChevronRight,
  LogOut,
  Trash2,
  BrainCircuit,
  RefreshCw,
  Layers,
} from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import { apiService } from "@/services/api";
import KpiOverview from "@/components/executive-overview/KpiOverview";
import TrendVisuals from "@/components/performance-trends/TrendVisuals";
import GeographicMap from "@/components/geo-intelligence/GeographicMap";
import InsightsCenter from "@/components/ai-insights/InsightsCenter";
import DonutChart from "@/components/executive-overview/DonutChart";
import Sidebar, { SnowSection } from "@/components/layout/Sidebar";
import DatasetOverviewPanel from "@/components/dashboard/DatasetOverviewPanel";
import PredictionPanel from "@/components/dashboard/PredictionPanel";
import TopNavBar from "@/components/layout/TopNavBar";
import SystemHealthFooter from "@/components/layout/SystemHealthFooter";
import AnomalyBarChart from "@/components/dashboard/AnomalyBarChart";
import DatasetProfileChart from "@/components/dashboard/DatasetProfileChart";
import SnowfallStorm from "@/components/auth/SnowfallStorm";
import Papa from "papaparse";

// ─────────────────────────────────────────────────────
//  MOCK DATA GENERATORS (offline-first, no backend)
// ─────────────────────────────────────────────────────

function generateMockKpis() {
  return {
    total_value: 4_282_104,
    mean_value: 14.2,
    std_dev: 3.1,
    growth_rate: 12.4,
    total_records: 1842,
    unique_categories: 7,
    unique_regions: 5,
    quality_score: 98.2,
    metric_name: "revenue",
  };
}

function generateMockTrends() {
  const dates: string[] = [];
  const values: number[] = [];
  const moving_average: number[] = [];

  const now = new Date();
  let base = 80_000;
  let ma = 78_000;

  for (let i = 120; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);

    const noise = (Math.random() - 0.45) * 8_000;
    base = Math.max(50_000, base + noise + 400);
    values.push(Math.round(base));

    const maNoise = (Math.random() - 0.5) * 3_000;
    ma = Math.max(45_000, ma + maNoise + 350);
    moving_average.push(Math.round(ma));
  }

  return { dates, values, moving_average, metric: "revenue" };
}

function generateMockGeo() {
  return [
    { region: "Enterprise AI", value: 5_250_000 },
    { region: "SaaS Growth", value: 3_875_000 },
    { region: "API Retail", value: 2_250_000 },
    { region: "Consumer", value: 1_500_000 },
    { region: "Other", value: 625_000 },
  ];
}

function generateMockAnomalies() {
  return [
    {
      date: "2025-06-15",
      value: 142_350,
      z_score: 3.8,
      severity: "High",
      region: "APAC",
      category: "Revenue spike",
      explanation: "Unusual revenue spike detected in APAC region — 3.8σ above mean.",
      impact: "Positive outlier — investigate cause for replication.",
    },
    {
      date: "2025-07-02",
      value: 28_700,
      z_score: -2.9,
      severity: "Medium",
      region: "MEA",
      category: "Demand drop",
      explanation: "Demand dip in MEA consistent with seasonal shipping delay.",
      impact: "Revenue impact: -$12.4k. Monitor for 2 more weeks.",
    },
  ];
}

function generateMockInsights() {
  return {
    headline:
      "Revenue growth of +12.4% MoM driven by Enterprise AI segment. Prediction accuracy at 98.2% — AI model optimized on latest training run.",
    trends:
      "Growth trajectory is linear with seasonal acceleration in Q3. Recommend increased capacity for Enterprise AI workloads.",
    geo: "Enterprise AI leads at 42% share. SaaS Growth at 31% with upward trajectory.",
    recommendations: [
      "Scale Enterprise AI cluster capacity by 20% to handle projected Q4 load surge.",
      "Run targeted SaaS Growth campaigns to capture the 9% untapped mid-market segment.",
      "Optimize API Retail latency — current 142ms is 18% above SLA threshold.",
      "Schedule dataset integrity scan — 2 null anomalies detected in source CSV.",
    ],
  };
}

function generateMockSchema() {
  return {
    dataset_id: 1,
    name: "Sample Analytics (Mock)",
    description: "Auto-generated sample dataset for development and demonstration purposes",
    row_count: 15_840,
    column_count: 12,
    date_range: { start: "2024-01-01", end: "2025-07-15" },
    primary_metric: "revenue",
    primary_date: "date",
    primary_category: "segment",
    columns: [
      { name: "date", role: "date" as const, null_count: 0 },
      { name: "revenue", role: "metric" as const, null_count: 0, min: 12000, max: 285000, mean: 58420 },
      { name: "segment", role: "category" as const, null_count: 0 },
      { name: "region", role: "geo" as const, null_count: 0 },
      { name: "active_users", role: "numeric" as const, null_count: 0, min: 120, max: 4850, mean: 1842 },
      { name: "query_latency_ms", role: "numeric" as const, null_count: 0, min: 80, max: 420, mean: 142 },
      { name: "model_accuracy", role: "metric" as const, null_count: 0, min: 91.2, max: 98.2, mean: 95.4 },
      { name: "node_count", role: "numeric" as const, null_count: 0, min: 800, max: 2100, mean: 1350 },
      { name: "churn_rate", role: "numeric" as const, null_count: 2 },
      { name: "plan_type", role: "categorical" as const, null_count: 0 },
      { name: "country", role: "geo" as const, null_count: 0 },
      { name: "mrr", role: "metric" as const, null_count: 0, min: 2500, max: 48000, mean: 12800 },
    ],
  };
}

function generateMockForecast() {
  const historical_dates: string[] = [];
  const historical_values: number[] = [];
  let base = 70_000;
  const now = new Date();

  for (let i = 30; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    historical_dates.push(d.toISOString().split("T")[0]);
    base += (Math.random() - 0.4) * 5000 + 600;
    historical_values.push(Math.round(base));
  }

  const future_dates: string[] = [];
  const forecast_values: number[] = [];
  const lower_bounds: number[] = [];
  const upper_bounds: number[] = [];

  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    future_dates.push(d.toISOString().split("T")[0]);
    const fv = base + i * 900 + (Math.random() - 0.5) * 3000;
    forecast_values.push(Math.round(fv));
    const variance = 8000 + i * 600;
    lower_bounds.push(Math.round(fv - variance));
    upper_bounds.push(Math.round(fv + variance));
  }

  return {
    target_column: "revenue",
    model_type: "Linear Regression",
    historical_dates,
    historical_values,
    future_dates,
    forecast_values,
    lower_bounds,
    upper_bounds,
    explanation:
      "The linear regression model was trained on 30 days of historical revenue data. The positive slope (+$900/day) reflects sustained organic growth. Confidence intervals widen over time as uncertainty compounds.",
  };
}

// ─────────────────────────────────────────────────────
//  AUTH PAGE LOGO
// ─────────────────────────────────────────────────────

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
        <line x1="50" y1="10" x2="50" y2="90" stroke="url(#snowGlow)" strokeWidth="4" strokeLinecap="round" />
        <line x1="10" y1="50" x2="90" y2="50" stroke="url(#snowGlow)" strokeWidth="4" strokeLinecap="round" />
        <line x1="21.7" y1="21.7" x2="78.3" y2="78.3" stroke="url(#snowGlow)" strokeWidth="4" strokeLinecap="round" />
        <line x1="21.7" y1="78.3" x2="78.3" y2="21.7" stroke="url(#snowGlow)" strokeWidth="4" strokeLinecap="round" />
        <polygon
          points="50,40 58.7,45 58.7,55 50,60 41.3,55 41.3,45"
          stroke="url(#snowGlow)"
          strokeWidth="2.5"
          fill="rgba(129, 140, 248, 0.1)"
        />
        <path d="M 50,22 L 44,16 M 50,22 L 56,16" stroke="url(#snowGlow)" strokeWidth="3" strokeLinecap="round" />
        <path d="M 50,78 L 44,84 M 50,78 L 56,84" stroke="url(#snowGlow)" strokeWidth="3" strokeLinecap="round" />
        <path d="M 22,50 L 16,44 M 22,50 L 16,56" stroke="url(#snowGlow)" strokeWidth="3" strokeLinecap="round" />
        <path d="M 78,50 L 84,44 M 78,50 L 84,56" stroke="url(#snowGlow)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="50" r="1.5" fill="white" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────
//  MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────

export default function HomePage() {
  // Auth state
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleAuthMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2;
    const cardCenterY = rect.top + rect.height / 2;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const rotateX = -(mouseY - cardCenterY) / (rect.height / 2) * 8;
    const rotateY = (mouseX - cardCenterX) / (rect.width / 2) * 8;

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleAuthMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const [googleLoading, setGoogleLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setAuthError("");
      try {
        // Fetch Google user info from the token
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const profile = await res.json();
        const email = profile.email || "google-user@gmail.com";
        setUser({ email });
        fetchDatasets();
      } catch {
        setAuthError("Google Sign-In failed. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      setAuthError("Google Sign-In was cancelled or failed.");
      setGoogleLoading(false);
    },
  });

  const handleGoogleSignIn = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID_HERE") {
      // Offline fallback: skip OAuth, log in as demo Google user
      setGoogleLoading(true);
      setTimeout(() => {
        setUser({ email: "demo@snowpulse.ai" });
        fetchDatasets();
        setGoogleLoading(false);
      }, 600);
      return;
    }
    setGoogleLoading(true);
    googleLogin();
  };

  // App state
  const [datasets, setDatasets] = useState<{ id: number; name: string; description: string }[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [selectedDatasetName, setSelectedDatasetName] = useState("No dataset selected");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);


  const [dynamicSchemas, setDynamicSchemas] = useState<Record<number, any>>({});

  // Dashboard data
  const [kpis, setKpis] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showFullInsightsModal, setShowFullInsightsModal] = useState(false);

  const [activeSection, setActiveSection] = useState<SnowSection>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [datasetSchema, setDatasetSchema] = useState<any>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

  const [forecast, setForecast] = useState<any>(null);
  const [trainingHistory, setTrainingHistory] = useState<any[]>([]);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  // Top nav tab state
  const [navTab, setNavTab] = useState<"overview" | "reports" | "analytics">("overview");

  // ── Load mock data (offline-first) ──────────────────
  const loadMockDashboard = (schema?: any) => {
    if (schema) {
      const metricCol = schema.columns.find((c: any) => c.name === schema.primary_metric) || schema.columns.find((c: any) => c.role === 'numeric');
      const total_records = schema.row_count || 0;
      const metric_name = schema.primary_metric || metricCol?.name || "Metric";
      const mean_value = metricCol?.mean || 14.2;
      const nulls = schema.columns.reduce((acc: number, c: any) => acc + c.null_count, 0);
      const total_cells = total_records * schema.column_count;
      const quality_score = total_cells > 0 ? ((total_cells - nulls) / total_cells) * 100 : 98.2;

      setKpis({
        total_value: Math.round(mean_value * total_records),
        mean_value: mean_value,
        std_dev: 3.1,
        growth_rate: 12.4,
        total_records: total_records,
        unique_categories: schema.columns.filter((c: any) => c.role === 'categorical' || c.role === 'category').length,
        unique_regions: schema.columns.filter((c: any) => c.role === 'geo').length,
        quality_score: quality_score,
        metric_name: metric_name,
      });

      // Generate dynamic trends based on mean_value
      const dates: string[] = [];
      const values: number[] = [];
      const moving_average: number[] = [];
      const now = new Date();
      let base = mean_value * 1.2;
      let ma = mean_value * 1.15;

      for (let i = 120; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
        const noise = (Math.random() - 0.45) * (mean_value * 0.2);
        base = Math.max(mean_value * 0.3, base + noise + (mean_value * 0.005));
        values.push(Math.round(base));
        const maNoise = (Math.random() - 0.5) * (mean_value * 0.1);
        ma = Math.max(mean_value * 0.25, ma + maNoise + (mean_value * 0.004));
        moving_average.push(Math.round(ma));
      }
      setTrends({ dates, values, moving_average, metric: metric_name });

      const geoCol = schema.columns.find((c: any) => c.role === 'geo');
      if (geoCol) {
        setGeoData([
          { region: "North America", value: Math.round(total_records * 0.4) },
          { region: "Europe", value: Math.round(total_records * 0.3) },
          { region: "APAC", value: Math.round(total_records * 0.2) },
          { region: "LATAM", value: Math.round(total_records * 0.07) },
          { region: "MEA", value: Math.round(total_records * 0.03) },
        ]);
      } else {
        setGeoData([]); // Explicitly empty for datasets without geo
      }

      setAnomalies(generateMockAnomalies());
      setAiInsights({
        headline: `Analysis complete. Dataset quality is ${quality_score.toFixed(1)}%. AI model ready for predictions on ${metric_name}.`,
        trends: `Stable trajectory for ${metric_name} with seasonal variations.`,
        geo: geoCol ? `Regional distribution detected via ${geoCol.name} column.` : "No geographic mapping available.",
        recommendations: [
          `Monitor ${metric_name} for structural breaks.`,
          `Run deep forecasting on ${metric_name} to predict future bounds.`
        ]
      });
    } else {
      setKpis(generateMockKpis());
      setTrends(generateMockTrends());
      setGeoData(generateMockGeo());
      setAnomalies(generateMockAnomalies());
      setAiInsights(generateMockInsights());
    }
  };

  const handleSelectDataset = async (datasetId: number, name: string) => {
    setSelectedDatasetId(datasetId);
    setSelectedDatasetName(name);
    setSelectedRegion(null);
    setLoadingDashboard(true);

    try {
      const sumRes = await apiService.getAnalyticsSummary(datasetId);
      if (sumRes.ok) {
        const summary = await sumRes.json();
        setKpis(summary.kpis);
        setTrends(summary.trends);
        setGeoData(summary.geo);
        setAnomalies(summary.anomalies);
      } else {
        const schema = dynamicSchemas[datasetId] || null;
        loadMockDashboard(schema);
      }
      const insRes = await apiService.getAnalyticsInsights(datasetId);
      if (insRes.ok) {
        const insights = await insRes.json();
        setAiInsights(insights);
      } else {
        // If we already set dynamic insights in loadMockDashboard, don't overwrite them
        if (!dynamicSchemas[datasetId]) {
          setAiInsights(generateMockInsights());
        }
      }
    } catch {
      const schema = dynamicSchemas[datasetId] || null;
      loadMockDashboard(schema);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const fetchDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const res = await apiService.getDatasets();
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          setDatasets(list);
          handleSelectDataset(list[0].id, list[0].name);
        } else {
          useMockDataset();
        }
      } else {
        useMockDataset();
      }
    } catch {
      useMockDataset();
    } finally {
      setLoadingDatasets(false);
    }
  };

  const useMockDataset = () => {
    const mock = [{ id: 1, name: "Sample Analytics (Mock)", description: "Auto-generated sample dataset" }];
    setDatasets(mock);
    setSelectedDatasetId(1);
    setSelectedDatasetName("Sample Analytics (Mock)");
    const schema = dynamicSchemas[1] || null;
    loadMockDashboard(schema);
    setLoadingDashboard(false);
  };

  const checkSession = async () => {
    try {
      const res = await apiService.getMe();
      if (res.ok) {
        const userData = await res.json();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser({ email: userData.email });
        fetchDatasets();
      } else {
        localStorage.removeItem("snow_access_token");
      }
    } catch {
      // No backend — silently proceed
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const token = localStorage.getItem("snow_access_token");
    if (token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      checkSession();
    }
  }, []);

  useEffect(() => {
    if (!selectedDatasetId) return;

    setLoadingSchema(true);
    if (dynamicSchemas[selectedDatasetId]) {
      setDatasetSchema(dynamicSchemas[selectedDatasetId]);
      setLoadingSchema(false);
      return;
    }

    apiService
      .getDatasetSchema(selectedDatasetId)
      .then((res) => (res.ok ? res.json() : generateMockSchema()))
      .then(setDatasetSchema)
      .catch(() => setDatasetSchema(generateMockSchema()))
      .finally(() => setLoadingSchema(false));
  }, [selectedDatasetId, dynamicSchemas]);

  useEffect(() => {
    if (!selectedDatasetId) return;

    if (activeSection === "prediction") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingPrediction(true);
      Promise.all([
        apiService.getForecastPredict(selectedDatasetId).then((r) => (r.ok ? r.json() : generateMockForecast())),
        apiService
          .getMlHistory(selectedDatasetId, "revenue_prediction")
          .then((r) => (r.ok ? r.json() : { runs: [] })),
      ])
        .then(([forecastData, historyData]) => {
          setForecast(forecastData);
          setTrainingHistory(historyData?.runs || []);
        })
        .catch(() => {
          setForecast(generateMockForecast());
          setTrainingHistory([]);
        })
        .finally(() => setLoadingPrediction(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, selectedDatasetId]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) return;
    setAuthError("");
    setAuthLoading(true);

    try {
      if (authMode === "register") {
        await apiService.register(emailInput, passwordInput).catch(() => {});
      }
      await triggerLoginFlow();
    } catch {
      // Offline mode — accept any credentials
      setUser({ email: emailInput });
      setEmailInput("");
      setPasswordInput("");
      fetchDatasets();
    } finally {
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
      } else {
        localStorage.setItem("snow_access_token", "dev_mock_token");
      }
    } catch {
      localStorage.setItem("snow_access_token", "dev_mock_token");
    }

    setUser({ email: emailInput });
    setEmailInput("");
    setPasswordInput("");
    fetchDatasets();
  };

  const handleLogout = async () => {
    try { await apiService.logout(); } catch { /* ignore */ }
    localStorage.removeItem("snow_access_token");
    setUser(null);
    setSelectedDatasetId(null);
    setKpis(null);
    setTrends(null);
    setGeoData(null);
    setAnomalies(null);
    setAiInsights(null);
  };

  const handlePurgeAccount = async () => {
    if (!window.confirm("WARNING: This will permanently delete your account and data (GDPR). Proceed?")) return;
    try { await apiService.purgeAccount(); } catch { /* ignore */ }
    setUser(null);
    setSelectedDatasetId(null);
  };

  const handleFileUpload = async (fileOrEvent: File | React.ChangeEvent<HTMLInputElement>) => {
    let file: File;
    if (fileOrEvent instanceof File) {
      file = fileOrEvent;
    } else {
      const files = fileOrEvent.target.files;
      if (!files || files.length === 0) return;
      file = files[0];
    }
    // Accept CSV, Excel, JSON, TSV
    const accepted = [".csv", ".xlsx", ".xls", ".json", ".tsv", ".txt"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!accepted.includes(ext)) {
      setUploadError("Unsupported file type. Please upload CSV, Excel, JSON, or TSV.");
      return;
    }
    setUploadError("");
    setUploading(true);

    if (ext === ".csv") {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as Record<string, any>[];
          const fields = results.meta.fields || [];
          
          const columns = fields.map(f => {
            let nulls = 0;
            let isNumeric = true;
            let min = Infinity;
            let max = -Infinity;
            let sum = 0;
            let count = 0;

            for (const row of data) {
              const val = row[f];
              if (val === null || val === undefined || val === "") {
                nulls++;
              } else {
                count++;
                if (typeof val === 'number') {
                  if (val < min) min = val;
                  if (val > max) max = val;
                  sum += val;
                } else {
                  isNumeric = false;
                }
              }
            }

            let role = "categorical";
            if (isNumeric) role = "numeric";
            if (f.toLowerCase().includes("date") || f.toLowerCase().includes("time")) role = "date";
            if (f.toLowerCase().includes("country") || f.toLowerCase().includes("region")) role = "geo";
            
            const colInfo: any = { name: f, role, null_count: nulls };
            if (isNumeric && count > 0) {
              colInfo.min = min;
              colInfo.max = max;
              colInfo.mean = Math.round((sum / count) * 100) / 100;
            }
            return colInfo;
          });

          const schema = {
            dataset_id: Date.now(),
            name: file.name.replace(/\.[^.]+$/, ""),
            description: "Analyzing dataset with local AI model...",
            row_count: data.length,
            column_count: fields.length,
            date_range: null,
            primary_metric: columns.find(c => c.role === "numeric")?.name || null,
            primary_date: columns.find(c => c.role === "date")?.name || null,
            primary_category: columns.find(c => c.role === "categorical")?.name || null,
            columns
          };

          setDynamicSchemas(prev => ({ ...prev, [schema.dataset_id]: schema }));
          setDatasets((prev) => [...prev, { id: schema.dataset_id, name: schema.name, description: `Uploaded: ${file.name}` }]);
          handleSelectDataset(schema.dataset_id, schema.name);
          setUploading(false);

          // Start Web Worker to generate description using local LLM
          try {
            const worker = new Worker(new URL('./llm.worker.ts', import.meta.url));
            const prompt = `Write a one sentence description of a business dataset containing these columns: ${fields.join(", ")}.`;
            worker.postMessage({ text: prompt });
            worker.onmessage = (e) => {
              if (e.data.status === "complete") {
                setDynamicSchemas(prev => ({
                  ...prev,
                  [schema.dataset_id]: {
                    ...prev[schema.dataset_id],
                    description: e.data.result
                  }
                }));
                // Force state update if this is the active dataset
                setDatasetSchema((prevSchema: any) => {
                  if (prevSchema?.dataset_id === schema.dataset_id) {
                    return { ...prevSchema, description: e.data.result };
                  }
                  return prevSchema;
                });
                worker.terminate();
              }
            };
          } catch (err) {
            console.error("Worker error:", err);
          }
        }
      });
      return;
    }

    try {
      const res = await apiService.uploadDataset(file);
      if (res.ok) {
        const dataset = await res.json();
        await fetchDatasets();
        handleSelectDataset(dataset.id, dataset.name);
      } else {
        const mockName = file.name.replace(/\.[^.]+$/, "");
        const mockId = Date.now();
        setDatasets((prev) => [...prev, { id: mockId, name: mockName, description: `Uploaded: ${file.name}` }]);
        handleSelectDataset(mockId, mockName);
      }
    } catch {
      const mockName = file.name.replace(/\.[^.]+$/, "");
      const mockId = Date.now();
      setDatasets((prev) => [...prev, { id: mockId, name: mockName, description: `Uploaded: ${file.name}` }]);
      handleSelectDataset(mockId, mockName);
    } finally {
      setUploading(false);
    }
  };

  // Region filter multiplier
  const getFilteredKpis = () => {
    if (!kpis) return null;
    if (!selectedRegion) return kpis;
    const mult =
      selectedRegion === "North America"
        ? 0.35
        : selectedRegion === "Europe"
        ? 0.25
        : selectedRegion === "APAC"
        ? 0.4
        : 0.15;
    return {
      ...kpis,
      total_value: Math.round(kpis.total_value * mult),
      total_records: Math.round(kpis.total_records * mult),
      growth_rate: kpis.growth_rate * (mult + 0.8),
      metric_name: `${kpis.metric_name} (${selectedRegion})`,
    };
  };

  const sidebarWidth = sidebarCollapsed ? 64 : 220;

  // ─── RENDER: AUTH PAGE ───────────────────────────────────────────
  if (!user) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
        style={{ background: "#040508" }}
        onMouseMove={handleAuthMouseMove}
        onMouseLeave={handleAuthMouseLeave}
      >
        <SnowfallStorm />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none z-0"
          style={{
            background: "radial-gradient(circle, rgba(80,99,244,0.08) 0%, rgba(16,185,129,0.01) 70%, transparent 100%)",
            filter: "blur(80px)"
          }} />

        <div
          ref={cardRef}
          className="w-full max-w-[440px] rounded-2xl p-8 relative z-10"
          style={{
            background: "rgba(6, 8, 14, 0.22)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
            transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: "transform 0.15s ease-out",
          }}
        >
          <div className="flex flex-col items-center mb-6">
            <SnowflakeLogo className="w-12 h-12 animate-spin-slow mb-3" />
            <h1 className="text-2xl font-bold tracking-tight text-white select-none">SnowPulse AI</h1>
            <p className="text-sm text-white/35 mt-1.5 font-mono select-none">Executive-Grade AI Analytics Platform</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-mono text-white/40 uppercase tracking-wider mb-2 select-none">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full text-sm text-white rounded-lg px-3.5 py-2.5 outline-none font-sans transition-all"
                style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.05)" }}
              />
            </div>
            <div>
              <label className="block text-[12px] font-mono text-white/40 uppercase tracking-wider mb-2 select-none">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full text-sm text-white rounded-lg px-3.5 py-2.5 outline-none font-sans transition-all"
                style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.05)" }}
              />
            </div>

            {authError && (
              <div className="text-xs text-red-400 rounded-lg p-3 leading-relaxed"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full text-white rounded-lg py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer mt-3"
              style={{ background: "linear-gradient(135deg, #5063f4 0%, #7c3aed 100%)" }}
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <span>{authMode === "login" ? "Sign In to Workspace" : "Create Developer Account"}</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <span className="relative px-3 text-[10px] font-mono text-white/30 uppercase bg-[#0c0e12]/80 tracking-wider">
              Or continue with
            </span>
          </div>

          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full rounded-lg py-3 text-sm font-semibold transition-all flex items-center justify-center gap-3 cursor-pointer"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              color: "#fff"
            }}
          >
            {googleLoading ? (
              <RefreshCw className="w-4.5 h-4.5 animate-spin text-white/40" />
            ) : (
              <>
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.2-5.136 4.2A5.76 5.76 0 0 1 8.2 12.8a5.76 5.76 0 0 1 5.79-5.8c1.498 0 2.861.55 3.916 1.455l3.208-3.2A10.24 10.24 0 0 0 13.99 2 10.24 10.24 0 0 0 3.75 12.24a10.24 10.24 0 0 0 10.24 10.24c5.79 0 10.24-4.062 10.24-10.24 0-.693-.06-1.36-.182-1.955H12.24z"
                  />
                </svg>
                <span>Google Sign In</span>
              </>
            )}
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}
              className="text-sm text-white/30 hover:text-white transition-all font-mono"
            >
              {authMode === "login" ? "Don't have an account? Sign up" : "Already registered? Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: EMPTY STATE (NO DATASET) ───────────────────────────
  if (selectedDatasetId === null) {
    return (
      <div className="min-h-screen flex flex-col p-6 max-w-5xl mx-auto justify-between" style={{ background: "#0d0f14" }}>
        <header className="flex items-center justify-between py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <SnowflakeLogo className="w-7 h-7" />
            <span className="font-bold text-white tracking-tight">SnowPulse AI</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/30 font-mono">{user.email}</span>
            <button onClick={handleLogout} className="p-2 rounded-lg text-gray-300 hover:text-white transition-all cursor-pointer"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 my-16 flex flex-col lg:flex-row gap-10 items-center justify-center">
          <div className="max-w-[420px] space-y-5 text-center lg:text-left">
            <div className="inline-flex p-3 rounded-2xl text-brand-primary"
              style={{ background: "rgba(80,99,244,0.1)", border: "1px solid rgba(80,99,244,0.2)" }}>
              <Layers className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">Unlock AI Analytics</h2>
            <p className="text-sm text-white/40 leading-relaxed">
              Upload a business CSV or choose from shared datasets to populate your AI analytics cockpit.
            </p>
            <div className="flex items-center gap-4 text-xs font-mono text-white/25">
              <span>✓ Offline-first</span>
              <span>✓ Mock AI engine</span>
              <span>✓ No backend needed</span>
            </div>
          </div>

          <div className="w-full max-w-[460px] space-y-6">
            {/* Upload */}
            <div className="rounded-xl p-8 text-center border-dashed transition-all"
              style={{ background: "rgba(18,21,30,0.65)", border: "1px dashed rgba(255,255,255,0.08)" }}>
              <input type="file" accept=".csv" onChange={handleFileUpload} id="csv-upload" className="hidden" disabled={uploading} />
              <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center space-y-3.5">
                <div className="p-3.5 rounded-full text-brand-primary" style={{ background: "rgba(80,99,244,0.1)" }}>
                  {uploading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                </div>
                <div>
                  <span className="text-sm font-semibold text-white block">Upload business CSV</span>
                  <span className="text-xs text-white/30 mt-1 block">Drop your sales, customer, or metric CSV here</span>
                </div>
              </label>
              {uploadError && (
                <div className="text-xs text-red-400 mt-4 rounded-lg p-2.5"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  {uploadError}
                </div>
              )}
            </div>

            {/* Pre-loaded datasets */}
            <div className="rounded-xl p-5 space-y-3.5"
              style={{ background: "rgba(18,21,30,0.65)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] text-white/30 font-bold tracking-wider uppercase font-mono">
                Pre-loaded / Shared Datasets
              </p>
              {loadingDatasets ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-5 h-5 animate-spin text-brand-primary" />
                </div>
              ) : datasets.length === 0 ? (
                <p className="text-xs text-white/30 font-mono">No datasets available. Ingest one above.</p>
              ) : (
                <div className="space-y-2">
                  {datasets.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleSelectDataset(d.id, d.name)}
                      className="w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group interactive-element"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg text-brand-primary" style={{ background: "rgba(80,99,244,0.1)" }}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-white block">{d.name}</span>
                          <span className="text-[10px] text-white/30 mt-0.5 block truncate max-w-[200px]">{d.description}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="py-4 border-t border-white/5 flex items-center justify-between text-xs text-white/20">
          <span>SnowPulse AI v2.0.0 — Offline Mode</span>
          <button onClick={handlePurgeAccount} className="flex items-center gap-1 hover:text-red-400 transition-all font-mono text-[10px]">
            <Trash2 className="w-3.5 h-3.5" />
            GDPR Purge Account
          </button>
        </footer>
      </div>
    );
  }

  // ─── RENDER: MAIN DASHBOARD ──────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "#0d0f14" }}>
      {/* Fixed Sidebar */}
      <Sidebar
        active={activeSection}
        onNavigate={setActiveSection}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        datasetName={selectedDatasetName}
        onUploadDataset={handleFileUpload}
        uploading={uploading}
      />

      {/* Fixed Top Nav */}
      <TopNavBar
        onLogout={handleLogout}
        userEmail={user.email}
      />

      {/* Fixed Footer */}
      <SystemHealthFooter />

      {/* Main Content — offset by sidebar + header + footer */}
      <div
        className="min-h-screen transition-all duration-[280ms] relative z-10"
        style={{
          paddingLeft: sidebarWidth,
          paddingTop: 64,
          paddingBottom: 48,
        }}
      >
        <div className="p-5 space-y-4 max-w-[1400px] mx-auto">

          {loadingDashboard ? (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
              <span className="text-xs text-white/30 font-mono">Processing dataset with AI engine...</span>
            </div>
          ) : (
            <>
              {/* ── DASHBOARD SECTION ── */}
              {activeSection === "dashboard" && (
                <div className="space-y-4">
                  {/* Row 1: KPI Cards */}
                  <KpiOverview
                    kpis={getFilteredKpis()}
                    aiHeadline={aiInsights?.headline || null}
                    loading={false}
                  />

                  {/* Row 2: Performance Analytics + Segment Donut */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-8">
                      <TrendVisuals
                        trends={trends}
                        aiTrendNote={aiInsights?.trends || null}
                        loading={false}
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
                        loading={false}
                      />
                    </div>
                  </div>

                  {/* Row 3: Recent Activity + AI Insights */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Anomaly Distribution Chart */}
                    <div className="lg:col-span-8">
                      <AnomalyBarChart anomalies={anomalies} loading={false} />
                    </div>

                    {/* Dataset Profile Chart */}
                    <div className="lg:col-span-4">
                      <DatasetProfileChart schema={datasetSchema} loading={loadingSchema} />
                    </div>
                  </div>

                  {/* Row 4: Geographic Map */}
                  <div className="w-full">
                    <GeographicMap
                      geoData={geoData}
                      aiGeoNote={aiInsights?.geo || null}
                      loading={false}
                      selectedRegion={selectedRegion}
                      onSelectRegion={setSelectedRegion}
                    />
                  </div>
                </div>
              )}

              {/* ── DATASET OVERVIEW SECTION ── */}
              {activeSection === "dataset-overview" && (
                <DatasetOverviewPanel schema={datasetSchema} loading={loadingSchema} />
              )}

              {/* ── SNOW AI SECTION ── */}
              {activeSection === "snow-ai" && (
                <div className="max-w-4xl mx-auto">
                  <InsightsCenter
                    datasetId={selectedDatasetId}
                    anomalies={anomalies}
                    recommendations={aiInsights?.recommendations || null}
                    loading={false}
                  />
                </div>
              )}

              {/* ── FUTURE PREDICTION SECTION ── */}
              {activeSection === "prediction" && (
                <PredictionPanel
                  datasetId={selectedDatasetId}
                  forecast={forecast}
                  trainingHistory={trainingHistory}
                  loading={loadingPrediction}
                />
              )}

              {/* ── PRODUCTION ENV (placeholder) ── */}
              {activeSection === "production-env" && (
                <div className="rounded-xl p-8 text-center"
                  style={{ background: "rgba(18,21,30,0.65)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Sparkles className="w-8 h-8 text-brand-primary mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-white mb-2">Production Environment</h3>
                  <p className="text-xs text-white/35">
                    Connect your production data pipelines and deployment targets here.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Full AI Analysis Modal ── */}
      {showFullInsightsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }}
        >
          <div
            className="w-full max-w-5xl flex flex-col overflow-hidden rounded-2xl"
            style={{
              height: "85vh",
              background: "#090a10",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.7)",
            }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0"
              style={{ background: "#12151e" }}>
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-brand-primary animate-pulse" />
                <span className="font-semibold text-white">SNOW Intelligence Copilot & Insights</span>
              </div>
              <button
                onClick={() => setShowFullInsightsModal(false)}
                className="px-3 py-1.5 text-xs text-white/50 hover:text-white rounded-lg transition-all cursor-pointer font-mono"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                Close Panel
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <InsightsCenter
                datasetId={selectedDatasetId}
                anomalies={anomalies}
                recommendations={aiInsights?.recommendations || null}
                loading={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
