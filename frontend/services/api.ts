const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Standard helper to handle API calls with credentials (refresh token cookie support)
export async function fetchAPI(endpoint: string, options: RequestInit = {}) {

  const url = `${API_BASE}${endpoint}`;
  
  // Try retrieving local access token if exists
  const token = typeof window !== "undefined" ? localStorage.getItem("snow_access_token") : null;
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  const config: RequestInit = {
    ...options,
    credentials: "include",
    headers,
  };
  
  let response = await fetch(url, config);
  
  // If unauthorized, attempt to call refresh token rotation
  if (response.status === 401 && endpoint !== "/api/auth/login" && endpoint !== "/api/auth/register") {
    try {
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: config.headers,
      });
      
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (typeof window !== "undefined") {
          localStorage.setItem("snow_access_token", refreshData.access_token);
        }
        
        // Re-execute request with new token
        headers.set("Authorization", `Bearer ${refreshData.access_token}`);
        response = await fetch(url, { ...options, credentials: "include", headers });
      } else {
        // Refresh failed, clear access token
        if (typeof window !== "undefined") {
          localStorage.removeItem("snow_access_token");
        }
      }
    } catch (e) {
      console.error("Token refresh failed", e);
    }
  }
  
  return response;
}

export const apiService = {
  // Authentication
  async register(email: string, password: string) {
    return fetchAPI("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  },

  async login(formData: FormData) {
    // fastapi OAuth2PasswordRequestForm accepts form-data urlencoded formats
    return fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
  },

  async logout() {
    localStorage.removeItem("snow_access_token");
    return fetchAPI("/api/auth/logout", { method: "POST" });
  },

  async getMe() {
    return fetchAPI("/api/user/me");
  },

  // GDPR Account Purge
  async purgeAccount() {
    localStorage.removeItem("snow_access_token");
    return fetchAPI("/api/user/account", { method: "DELETE" });
  },

  // Datasets
  async getDatasets() {
    return fetchAPI("/api/datasets");
  },

  async getDatasetSchema(datasetId: number) {
    return fetchAPI(`/api/datasets/${datasetId}/schema`);
  },

  async getDatasetProfile(datasetId: number) {
    return fetchAPI(`/api/datasets/${datasetId}/profile`);
  },

  async reprofileDataset(datasetId: number) {
    return fetchAPI(`/api/datasets/${datasetId}/reprofile`, { method: "POST" });
  },

  async getDatasetSignals(datasetId: number) {
    return fetchAPI(`/api/datasets/${datasetId}/signals`);
  },

  async queryDataset(datasetId: number, payload: any) {
    return fetchAPI(`/api/datasets/${datasetId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async uploadDataset(file: File) {

    const formData = new FormData();
    formData.append("file", file);
    
    return fetchAPI("/api/datasets/upload", {
      method: "POST",
      body: formData,
    });
  },

  async healDataset(datasetId: number) {
    return fetchAPI(`/api/datasets/${datasetId}/auto-heal`, {
      method: "POST"
    });
  },

  // Forecasting
  async getForecastPredict(datasetId: number, steps: number = 30) {
    return fetchAPI(`/api/forecast/predict/${datasetId}?steps=${steps}`);
  },

  async trainForecast(datasetId: number, targetCol: string, steps: number = 30) {
    return fetchAPI(
      `/api/forecast/train/${datasetId}?target_col=${encodeURIComponent(targetCol)}&steps=${steps}`,
      { method: "POST" }
    );
  },

  // ML training history / scores
  async getMlHistory(datasetId: number, taskType: string) {
    return fetchAPI(`/api/ml/history/${datasetId}?task_type=${encodeURIComponent(taskType)}`);
  },

  // AutoML Target Candidates
  async getMlTargetCandidates(datasetId: number) {
    return fetchAPI(`/api/ml/targets/${datasetId}`);
  },

  // AutoML Training Engine
  async trainMlModel(datasetId: number, taskType: string = "auto", targetCol?: string) {
    return fetchAPI(`/api/ml/train/${datasetId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_type: taskType, target_col: targetCol || null }),
    });
  },

  // ML Serving Inferences
  async predictMlModel(datasetId: number, taskType: string, inputRecords: Record<string, any>[]) {
    return fetchAPI(`/api/ml/predict/${datasetId}?task_type=${encodeURIComponent(taskType)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputRecords),
    });
  },


  // Dashboards
  async getDashboards() {
    return fetchAPI("/api/dashboards");
  },

  async createDashboard(datasetId: number, title: string) {
    return fetchAPI("/api/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset_id: datasetId,
        title,
        insight_notes: "",
        query_history: []
      }),
    });
  },

  // Polars statistical summary
  async getAnalyticsSummary(datasetId: number) {
    return fetchAPI(`/api/analytics/summary/${datasetId}`);
  },

  // Gemini automated insights (Panel 1-4 summaries)
  async getAnalyticsInsights(datasetId: number) {
    return fetchAPI(`/api/analytics/insights/${datasetId}`);
  },

  // Gemini Copilot natural language queries
  async askCopilot(datasetId: number, query: string) {
    return fetchAPI(`/api/analytics/query/${datasetId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
  },

  // Phase 4 Executive Report compilation
  async generateReport(datasetId: number, query: string, reportType: string) {
    return fetchAPI("/api/ai/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        report_type: reportType,
        dataset_id: datasetId,
      }),
    });
  },

  // Server-side Polars aggregation endpoint given active filter state
  async getDashboardAggregate(datasetId: number, filterState: any) {
    return fetchAPI(`/api/datasets/${datasetId}/dashboard-aggregate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filterState),
    });
  },

  async getDatasetAggregate(datasetId: number, filterState: any) {
    return fetchAPI(`/api/datasets/${datasetId}/aggregate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filterState),
    });
  },

  // AI-Powered Natural Language Calculated Fields
  async createCalculatedField(datasetId: number, prompt: string, fieldName?: string) {
    return fetchAPI(`/api/datasets/${datasetId}/calculated-fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, field_name: fieldName }),
    });
  },

  // 3D Spatial Geo-Heatmap & Arc Flow Engine
  async getGeoSpatial(datasetId: number, params?: { target_metric?: string; geo_column?: string; lat_column?: string; lng_column?: string; cluster_count?: number; top_n?: number }) {
    const qp = new URLSearchParams();
    if (params?.target_metric) qp.append("target_metric", params.target_metric);
    if (params?.geo_column) qp.append("geo_column", params.geo_column);
    if (params?.lat_column) qp.append("lat_column", params.lat_column);
    if (params?.lng_column) qp.append("lng_column", params.lng_column);
    if (params?.cluster_count) qp.append("cluster_count", params.cluster_count.toString());
    if (params?.top_n) qp.append("top_n", params.top_n.toString());
    const queryStr = qp.toString() ? `?${qp.toString()}` : "";
    return fetchAPI(`/api/datasets/${datasetId}/geo-spatial${queryStr}`);
  }
};


