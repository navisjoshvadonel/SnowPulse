# SnowPulse Load & Performance Tests

This directory contains performance testing artifacts for the SnowPulse AI backend API.

## Tool: k6

We use **[k6](https://k6.io)** — a developer-friendly, scriptable load testing tool written in Go.

## Structure

```
load-tests/
├── k6/
│   └── snowpulse-load-test.js   # Main k6 test script
└── results/
    └── k6-summary.json          # Output written by CI (gitignored)
```

## Quick Start

### Install k6

```bash
# macOS
brew install k6

# Windows (Chocolatey)
choco install k6

# Debian / Ubuntu
sudo apt install k6

# Or with Docker
docker pull grafana/k6
```

### Run Tests

#### Smoke test (1 VU, 1 iteration — sanity check)
```bash
k6 run --vus 1 --iterations 1 load-tests/k6/snowpulse-load-test.js
```

#### Standard load test (uses built-in ramp stages)
```bash
k6 run load-tests/k6/snowpulse-load-test.js
```

#### Stress test (100 VUs for 2 minutes)
```bash
k6 run --vus 100 --duration 2m load-tests/k6/snowpulse-load-test.js
```

#### Against a deployed environment
```bash
k6 run \
  -e BASE_URL=https://api.yourproddomain.com \
  -e JWT_TOKEN=<your_real_token> \
  load-tests/k6/snowpulse-load-test.js
```

## Performance Thresholds

The test enforces these pass/fail gates:

| Metric | Threshold |
|--------|-----------|
| `analytics_duration_ms` p95 | `< 500ms` |
| `http_req_failed` | `< 1%` |
| `success_rate` | `> 99%` |

## Endpoints Tested

| Group | Endpoint | Purpose |
|-------|----------|---------|
| Health | `GET /health/liveness` | Liveness probe |
| Health | `GET /health/readiness` | Readiness probe |
| Auth | `POST /api/auth/login` | Authentication |
| Auth | `GET /api/auth/me` | Token validation |
| Datasets | `GET /api/datasets` | List datasets |
| Datasets | `GET /api/datasets/{id}/schema` | Dataset schema |
| Analytics | `GET /api/analytics/{id}/summary` | KPI summary |
| Analytics | `GET /api/analytics/{id}/insights` | AI insights |
| Forecast | `GET /api/forecast/{id}/predict` | Forecast predictions |
| Observability | `GET /metrics` | Prometheus metrics |

## CI Integration

The `load-tests` job in `.github/workflows/ci.yml` runs a **smoke test** (1 VU, 1 iteration) on every PR and push to `main`. Full load tests (10–30 VUs) should be run manually against a staging environment before each release.

Results are uploaded as the `k6-load-test-results` GitHub Actions artifact.
