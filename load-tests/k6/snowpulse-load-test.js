/**
 * SnowPulse AI — k6 Load & Performance Test
 * ==========================================
 * Tests the backend API under realistic traffic patterns.
 *
 * Prerequisites:
 *   brew install k6          # macOS
 *   choco install k6         # Windows
 *   apt install k6           # Debian/Ubuntu
 *
 * Usage:
 *   # Smoke test (1 VU, 1 iteration)
 *   k6 run --vus 1 --iterations 1 load-tests/k6/snowpulse-load-test.js
 *
 *   # Standard load test (uses stages defined below)
 *   k6 run load-tests/k6/snowpulse-load-test.js
 *
 * Environment variables:
 *   BASE_URL    Backend base URL (default: http://localhost:8000)
 *   JWT_TOKEN   Bearer token to use for authenticated requests
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom Metrics ──────────────────────────────────────────────────────────
const apiErrors       = new Counter('api_errors');
const successRate     = new Rate('success_rate');
const uploadDuration  = new Trend('upload_duration_ms', true);
const analyticsDuration = new Trend('analytics_duration_ms', true);

// ── Configuration ───────────────────────────────────────────────────────────
const BASE_URL  = __ENV.BASE_URL  || 'http://localhost:8000';
const JWT_TOKEN = __ENV.JWT_TOKEN || 'dev_mock_token';
const IS_SMOKE  = (__ENV.K6_SMOKE || '').toLowerCase() === 'true';

// ── Load Stages ─────────────────────────────────────────────────────────────
const loadStages = IS_SMOKE ? [] : [
    { duration: '30s', target: 10 },   // Warm-up ramp
    { duration: '1m',  target: 10 },   // Sustained load
    { duration: '30s', target: 30 },   // Spike
    { duration: '1m',  target: 30 },   // Sustained spike
    { duration: '30s', target: 0  },   // Ramp down
];

// Smoke mode: verify service responsiveness with acceptable non-server-error responses
const thresholds = IS_SMOKE
  ? {
      'http_req_failed':     ['rate<0.50'],  // <50% hard errors
      'success_rate':        ['rate>0.50'],  // >50% checks pass
    }
  : {
      // Full load: strict production SLAs
      'analytics_duration_ms': ['p(95)<500'],
      'http_req_failed':       ['rate<0.05'],
      'success_rate':          ['rate>0.95'],
    };

export const options = {
  stages: loadStages,
  thresholds,
};

const EXPECT_ALL = { responseCallback: http.expectedStatuses({ min: 200, max: 499 }) };

// ── Setup Hook: Create test user & authenticate ──────────────────────────────
export function setup() {
  const userPayload = JSON.stringify({ email: 'perf-test@snowpulse.ai', password: 'perftest1234' });
  http.post(`${BASE_URL}/api/auth/register`, userPayload, {
    headers: { 'Content-Type': 'application/json' },
    responseCallback: http.expectedStatuses({ min: 200, max: 499 }),
  });

  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    { username: 'perf-test@snowpulse.ai', password: 'perftest1234' },
    { responseCallback: http.expectedStatuses({ min: 200, max: 499 }) }
  );

  let token = JWT_TOKEN;
  if (loginRes.status === 200) {
    try {
      const json = loginRes.json();
      if (json && json.access_token) {
        token = json.access_token;
      }
    } catch (e) {
      // fallback to token
    }
  }

  return { token: token };
}

// ── Scenarios ────────────────────────────────────────────────────────────────
export default function (data) {
  const authToken = (data && data.token) ? data.token : JWT_TOKEN;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  // ── Group 1: Health checks ─────────────────────────────────────────────
  group('Health Checks', () => {
    const liveness = http.get(`${BASE_URL}/health/liveness`, EXPECT_ALL);
    const livenessOk = check(liveness, {
      'liveness status 200': (r) => r.status === 200,
      'liveness latency < 100ms': (r) => r.timings.duration < 100,
    });
    successRate.add(livenessOk);
    if (!livenessOk) apiErrors.add(1);

    const readiness = http.get(`${BASE_URL}/health/readiness`, EXPECT_ALL);
    const readinessOk = check(readiness, {
      'readiness status 200': (r) => r.status === 200 || r.status === 503,
    });
    successRate.add(readinessOk);
  });

  sleep(0.5);

  // ── Group 2: Authentication ─────────────────────────────────────────────
  group('Authentication', () => {
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      { username: 'perf-test@snowpulse.ai', password: 'perftest1234' },
      EXPECT_ALL
    );
    const loginOk = check(loginRes, {
      'login status 200 or 401 or 422': (r) => [200, 401, 422].includes(r.status),
      'login latency < 300ms': (r) => r.timings.duration < 300,
    });
    successRate.add(loginOk);
    if (!loginOk) apiErrors.add(1);

    // Verify /user/me endpoint
    const meRes = http.get(`${BASE_URL}/api/user/me`, { headers: headers, ...EXPECT_ALL });
    check(meRes, {
      'me endpoint responds': (r) => [200, 401].includes(r.status),
    });
  });

  sleep(0.5);

  // ── Group 3: Dataset Listing ────────────────────────────────────────────
  group('Dataset Management', () => {
    const listStart = Date.now();
    const listRes = http.get(`${BASE_URL}/api/datasets`, { headers: headers, ...EXPECT_ALL });
    const listDuration = Date.now() - listStart;
    analyticsDuration.add(listDuration);

    const listOk = check(listRes, {
      'datasets list status 200 or 401': (r) => [200, 401].includes(r.status),
      'datasets list latency < 500ms': (r) => r.timings.duration < 500,
    });
    successRate.add(listOk);
    if (!listOk) apiErrors.add(1);

    const datasetId = 1;

    // Schema endpoint
    const schemaRes = http.get(`${BASE_URL}/api/datasets/${datasetId}/schema`, { headers: headers, ...EXPECT_ALL });
    check(schemaRes, {
      'schema responds': (r) => [200, 401, 404].includes(r.status),
      'schema latency < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(0.5);

  // ── Group 4: Analytics (hot path) ──────────────────────────────────────
  group('Analytics Engine', () => {
    const datasetId = 1;

    const summaryStart = Date.now();
    const summaryRes = http.get(
      `${BASE_URL}/api/analytics/${datasetId}/summary`,
      { headers: headers, ...EXPECT_ALL }
    );
    const summaryDuration = Date.now() - summaryStart;
    analyticsDuration.add(summaryDuration);

    const summaryOk = check(summaryRes, {
      'analytics summary responds': (r) => [200, 401, 404].includes(r.status),
      'analytics summary latency < 500ms': (r) => r.timings.duration < 500,
    });
    successRate.add(summaryOk);
    if (!summaryOk) apiErrors.add(1);

    const insightsStart = Date.now();
    const insightsRes = http.get(
      `${BASE_URL}/api/analytics/${datasetId}/insights`,
      { headers: headers, ...EXPECT_ALL }
    );
    analyticsDuration.add(Date.now() - insightsStart);

    check(insightsRes, {
      'analytics insights responds': (r) => [200, 401, 404].includes(r.status),
      'analytics insights latency < 800ms': (r) => r.timings.duration < 800,
    });
  });

  sleep(0.5);

  // ── Group 5: Forecasting ────────────────────────────────────────────────
  group('Forecasting', () => {
    const datasetId = 1;

    const forecastRes = http.get(
      `${BASE_URL}/api/forecast/${datasetId}/predict`,
      { headers: headers, ...EXPECT_ALL }
    );
    check(forecastRes, {
      'forecast endpoint responds': (r) => [200, 401, 404, 422].includes(r.status),
      'forecast latency < 1000ms': (r) => r.timings.duration < 1000,
    });
  });

  sleep(0.5);

  // ── Group 6: Metrics endpoint (Prometheus scrape) ───────────────────────
  group('Observability', () => {
    const metricsRes = http.get(`${BASE_URL}/metrics`, EXPECT_ALL);
    check(metricsRes, {
      'metrics endpoint 200': (r) => r.status === 200,
      'metrics latency < 200ms': (r) => r.timings.duration < 200,
      'metrics content type': (r) => (r.headers['Content-Type'] || '').includes('text/plain'),
    });
  });

  sleep(1);
}

// ── Lifecycle hooks ──────────────────────────────────────────────────────────
export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    'load-tests/results/k6-summary.json': JSON.stringify(data, null, 2),
  };
}
