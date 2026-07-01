# SnowPulse - AI Analytics Operating System & Dashboard

SnowPulse is a high-fidelity, premium AI analytics platform and data operating system UI. It features a hyper-minimalist glassmorphism design, real-time responsive grids, dynamic particle glow backgrounds, and a production-grade microservices backend.

---

## 📂 Project Structure & Architecture

SnowPulse is structured as a multi-service containerized application:

*   **`backend/`**: FastAPI (Python) service handling analytics processing, background tasks, data ingestion, database operations, and AI intelligence integrations.
    *   *Core tools*: SQLAlchemy, PostgreSQL + pgvector, Redis + arq, MinIO object storage, Meilisearch indexer, Prometheus instrumentation.
    *   *Quality tools*: Ruff (linter), Mypy (type checker), Pytest (testing).
*   **`frontend/`**: Next.js (TypeScript) web application utilizing ECharts, responsive grids, and customized TailwindCSS styling.
    *   *Quality tools*: ESLint, Prettier, Vitest (component & unit tests).
*   **`caddy/`**: Production-ready reverse proxy handling SSL termination and request routing.
*   **`prometheus/` & `grafana/`**: Monitoring stack mapping service health, API latency, and database pooling stats.
*   **`.github/workflows/`**: Continuous Integration (`ci.yml`) and Continuous Delivery (`cd.yml`) configurations.

---

## 🚀 Local Development Setup

To run SnowPulse locally with hot-reloading and active databases:

### 1. Configure Local Environment
Copy the example environment file and customize your secrets:
```bash
cp .env.example .env
```
*(Make sure to set/adjust keys like `JWT_SECRET_KEY`, `GEMINI_API_KEY`, and database credentials inside `.env`)*

### 2. Start Infrastructure Stack
Start all components in the background using Docker Compose:
```bash
docker compose up -d
```
Verify that all containers are healthy:
```bash
docker compose ps
```

### 3. Run with Hot Reload (Compose Watch)
Enable hot-reloading for code changes in both `backend` and `frontend` folders:
```bash
docker compose watch
```

### 4. Port Allocations & Services Map
*   **Frontend UI**: `http://localhost:3000`
*   **Backend FastAPI API**: `http://localhost:8000`
*   **Interactive API Docs**: `http://localhost:8000/docs`
*   **Prometheus Console**: `http://localhost:9090`
*   **Grafana Dashboard**: `http://localhost:3001`
*   **MinIO Console**: `http://localhost:9001`
*   **Meilisearch**: `http://localhost:7700`

---

## 🧪 Quality Assurance & Local Verification Workflows

Use these exact commands locally to validate your changes before pushing or opening a PR.

### 🐍 Backend (Python / FastAPI)

Run quality verification commands inside the root directory or inside the `backend` container.

#### 1. Linting & Code Style
Check code formatting and rule conformance:
```bash
ruff check backend --config backend/ruff.toml
```

To automatically apply safe fixes, run:
```bash
ruff check backend --config backend/ruff.toml --fix
```

#### 2. Static Type Checking
Perform strict type validation using Mypy:
```bash
mypy backend --config-file backend/mypy.ini --explicit-package-bases
```

#### 3. Unit & Integration Testing
Run the Pytest suite with coverage configuration:
```bash
pytest backend/tests --cov=backend/app --cov-report=xml --cov-report=term-missing --cov-fail-under=50 -v
```

**Required Test Environment Variables:**
When running pytest outside of Docker, ensure the following environment variables are exported or present:
```bash
export ENV=testing
export DATABASE_URL=postgresql://postgres:testpass@localhost:5432/snowpulse
export REDIS_URL=redis://localhost:6379/0
export GEMINI_API_KEY=mock-api-key
export JWT_SECRET_KEY=test-secret-key
export MINIO_ENDPOINT=localhost:9000
export MINIO_ACCESS_KEY=test
export MINIO_SECRET_KEY=test
export MEILI_HOST=http://localhost:7700
export MEILI_MASTER_KEY=test
```

#### 4. Security Scanning
Audits Python files and third-party dependencies for common vulnerabilities:
```bash
# Static Application Security Testing (SAST)
bandit -r backend/app -f json -o bandit-report.json

# Known vulnerability scan on installed packages
safety check --json
```

---

### ⚛️ Frontend (TypeScript / Next.js)

Run frontend quality verification commands inside the `frontend/` directory.

```bash
cd frontend
```

#### 1. Install Dependencies
Always use clean install to match package-lock dependencies:
```bash
npm ci
```

#### 2. Run Tests (Vitest)
Execute unit and component tests:
```bash
npm run test
```

#### 3. Generate Test Coverage Report
Verify coverage metrics match criteria:
```bash
npm run test:coverage
```

#### 4. Dependency Security Audit
Scan frontend node modules for vulnerabilities:
```bash
npm audit --audit-level=moderate
```

---

### 🐳 Full Stack Local Integration Test
To simulate the exact workflow executed in the CI pipeline for services boot-up, healthchecks, and API reachability:

```bash
# 1. Rebuild images with Compose
docker compose build

# 2. Start services in background
docker compose up -d

# 3. Wait for services to stabilize (liveness / readiness check loop)
# Check Liveness:
curl -f http://localhost:8000/health/liveness

# Check Readiness (validates DB, cache, and object storage connectivity):
curl -f http://localhost:8000/health/readiness

# 4. Verify API routing
curl -s -X GET http://localhost:8000/api/datasets -H "Authorization: Bearer test-token"

# 5. Spin down container services and remove volumes
docker compose down -v
```

---

## 🤖 GitHub Actions CI/CD Pipeline

The repository utilizes automated workflows in `.github/workflows/` to assert code health and deploy services.

### 🔄 CI Pipeline (`ci.yml`)
*Triggers: Push or Pull Requests to `main` and `master` branches.*

1.  **`code-quality`**: Runs Python Ruff and Mypy checks.
2.  **`backend-tests`**:
    *   Spins up service containers: `pgvector/pgvector:pg15` (port 5432) and `redis:7-alpine` (port 6379).
    *   Installs dependencies and runs `pytest` with coverage.
    *   Uploads reports to Codecov (`coverage.xml`).
3.  **`frontend-tests`**: Installs dependencies and runs `npm run test` + `npm run test:coverage`.
4.  **`security-scan`**: Checks python source with `bandit`, python dependencies with `safety`, and Node dependencies with `npm audit`.
5.  **`docker-build`**: Simulates Docker image builds for both `backend/Dockerfile` and `frontend/Dockerfile` utilizing BuildKit cache actions (`gha`).
6.  **`integration-test`**: Builds Compose, checks both `/health/liveness` and `/health/readiness` endpoints with a 12-attempt retry loop, verifies backend and queue worker logs, and triggers a dataset API test.

---

### 🚀 CD Pipeline (`cd.yml`)
*Triggers: Push to `main` and `master` branches.*

1.  **`validate-production-ready`**: Runs validation scripts ensuring Dockerfile best practices (multi-stage builds, non-root user verification, HEALTHCHECK commands) and environment configuration sanity.
2.  **`build-and-push`**:
    *   Builds production images for `backend` and `frontend`.
    *   Authenticates with Docker Registry (`docker.io`).
    *   Pushes tags: `latest`, branch ref, release tags, and git commit SHA.
3.  **`production-deployment-validation`**:
    *   Spins up the Docker Compose stack using the newly built images.
    *   Waits 40 seconds, then checks that every single service reports `running`.
    *   Asserts `/health/liveness`, `/health/readiness`, `/metrics`, and frontend server ports.
4.  **`create-release`**:
    *   Generates version strings based on timestamps: `vYYYY.MM.DD.HHMMSS`.
    *   Creates a new Git tag and pushes it to origin.
    *   Creates a GitHub Release body outlining deployment configurations and status.

---

## 🔑 Required Repository secrets
For pipelines to pass, the repository requires the following secrets in GitHub Settings:

| Secret Name | Purpose | Example / Format |
| :--- | :--- | :--- |
| `DOCKER_REGISTRY_USERNAME` | Registry username for push auth | `my-dockerhub-user` |
| `DOCKER_REGISTRY_PASSWORD` | Registry token / access key | `dckr_pat_...` |
| `GEMINI_API_KEY` | Key for Google Generative AI integration | `AIzaSy...` |
| `PRODUCTION_DB_PASSWORD` | Strong password for PostgreSQL database | A long random string |
| `PRODUCTION_REDIS_PASSWORD` | Password for Redis caching layer | A long random string |
| `JWT_SECRET_KEY` | 32-character key for user sessions and JWT | Run `openssl rand -hex 32` |
| `PRODUCTION_MINIO_PASSWORD` | Root access password for MinIO | A long random string |
| `PRODUCTION_MEILI_KEY` | Master authentication key for Meilisearch | A long random string |
