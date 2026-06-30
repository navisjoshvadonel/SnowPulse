const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Standard helper to handle API calls with credentials (refresh token cookie support)
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  // Try retrieving local access token if exists
  const token = localStorage.getItem("snow_access_token");
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  const config = {
    ...options,
    headers,
  };
  
  let response = await fetch(url, config);
  
  // If unauthorized, attempt to call refresh token rotation
  if (response.status === 401 && endpoint !== "/api/auth/login" && endpoint !== "/api/auth/register") {
    try {
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: config.headers,
      });
      
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        localStorage.setItem("snow_access_token", refreshData.access_token);
        
        // Re-execute request with new token
        headers.set("Authorization", `Bearer ${refreshData.access_token}`);
        response = await fetch(url, { ...options, headers });
      } else {
        // Refresh failed, clear access token
        localStorage.removeItem("snow_access_token");
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

  async uploadDataset(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    
    return fetchAPI("/api/datasets/upload", {
      method: "POST",
      body: formData,
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
  }
};
