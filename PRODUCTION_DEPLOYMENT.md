# Production Deployment Checklist

## Pre-Deployment Requirements

- [ ] Copy `.env.example` to `.env` and update all secrets
- [ ] Generate strong JWT_SECRET_KEY: `openssl rand -hex 32`
- [ ] Update all database and Redis passwords
- [ ] Configure GEMINI_API_KEY if using Google Generative AI
- [ ] Docker and Docker Compose installed (minimum versions: Docker 20.10, Compose 2.0)
- [ ] At least 8GB RAM available for all services
- [ ] 50GB free disk space for databases and file storage

## Security Hardening Checklist

- [ ] **NEVER commit `.env` to git** (add to `.gitignore`)
- [ ] Use strong, random passwords (minimum 16 characters)
- [ ] Set `MINIO_SECURE=true` in production with valid TLS certificates
- [ ] Enable Caddy HTTPS with valid SSL certificates
- [ ] Restrict database access to backend service only (use network policies)
- [ ] Rotate JWT_SECRET_KEY every 90 days
- [ ] Enable Redis password authentication
- [ ] Configure firewall rules to allow only necessary ports (80, 443, 8000)
- [ ] Use environment variable management tools (HashiCorp Vault, AWS Secrets Manager) for CI/CD

## Deployment Steps

### 1. Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd SnowPulse

# Copy and customize environment variables
cp .env.example .env
nano .env  # Edit with secure values

# Create required directories for Prometheus and Grafana
mkdir -p prometheus grafana/provisioning grafana/dashboards caddy
```

### 2. Start Services

```bash
# Pull latest images
docker compose pull

# Build local images (backend, frontend)
docker compose build

# Start all services in background
docker compose up -d

# Monitor startup logs
docker compose logs -f backend

# Wait for services to become healthy (30-60 seconds)
sleep 60
```

### 3. Health Verification

```bash
# Check all containers running
docker compose ps

# Verify liveness check
curl http://localhost:8000/health/liveness

# Verify readiness check (database, cache, storage ready)
curl http://localhost:8000/health/readiness

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify metrics endpoint
curl http://localhost:8000/metrics | head -20
```

### 4. Access Services

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **Backend Docs:** http://localhost:8000/docs
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3001 (admin / GRAFANA_PASSWORD)
- **MinIO Console:** http://localhost:9001 (minioadmin / MINIO_ROOT_PASSWORD)
- **Meilisearch:** http://localhost:7700

## Monitoring & Observability

### Prometheus Scrape Targets

- Backend metrics: `http://backend:8000/metrics`
- Prometheus self-metrics: `http://prometheus:9090/metrics`

### Key Metrics to Monitor

- `snowpulse_api_requests_total` - Total API requests by endpoint
- `snowpulse_api_request_duration_seconds` - API latency distribution
- `snowpulse_db_connections_active` - Active database connections
- `snowpulse_job_executions_total` - Background job execution count
- `snowpulse_errors_total` - Error rate by component

### Grafana Dashboards

- System overview and health status
- API performance and latency
- Database connection pool monitoring
- Background job queue monitoring
- Error tracking and anomalies

## Scaling Considerations

### Horizontal Scaling (Multi-Node)

For production deployments with high traffic, consider:

1. **Backend API**: Run multiple instances behind a load balancer
   ```yaml
   backend:
     deploy:
       replicas: 3
   ```

2. **Background Workers**: Scale `arq-worker` independently
   ```yaml
   arq-worker:
     deploy:
       replicas: 2
   ```

3. **Database**: PostgreSQL with replication and failover
4. **Redis**: Sentinel mode for high availability
5. **MinIO**: Multi-node distributed setup

### Vertical Scaling

- Increase BACKEND_WORKERS in Dockerfile (currently 4)
- Increase database connection pool
- Allocate more memory to Ollama for faster inference

## Maintenance Tasks

### Regular Backups

```bash
# Backup PostgreSQL database
docker compose exec -T db pg_dump -U postgres snowpulse > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup MinIO data
docker compose exec -T minio mc mirror minio/datasets ./backups/datasets

# Backup Grafana dashboards
docker cp snowpulse-grafana:/var/lib/grafana/dashboards ./grafana_backup
```

### Log Rotation

```bash
# View logs for a specific service
docker compose logs backend

# Stream live logs
docker compose logs -f arq-worker

# Limit log output
docker compose logs --tail 100 backend
```

### Database Maintenance

```bash
# Connect to PostgreSQL
docker compose exec db psql -U postgres -d snowpulse

# Vacuum and analyze tables
docker compose exec db psql -U postgres -d snowpulse -c "VACUUM ANALYZE;"

# Check slow queries
docker compose exec db psql -U postgres -d snowpulse -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC;"
```

## Troubleshooting

### Services Not Starting

```bash
# Check container status
docker compose ps

# View container logs
docker compose logs <service_name>

# Restart a service
docker compose restart <service_name>

# Rebuild an image
docker compose build --no-cache <service_name>
```

### Database Connection Issues

```bash
# Test database connectivity from backend
docker compose exec backend psql -h db -U postgres -d snowpulse -c "SELECT 1"

# Check database logs
docker compose logs db
```

### High Memory Usage

```bash
# Check memory consumption
docker stats

# Limit service memory (update docker-compose.yml)
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Slow Performance

1. Check Prometheus metrics for bottlenecks
2. Review slow query logs: `docker compose logs db | grep "slow"`
3. Analyze cache hit rates: `docker compose exec redis redis-cli INFO stats`
4. Profile background jobs: Check `arq-worker` logs

## Disaster Recovery

### Database Restore

```bash
# Restore from backup
docker compose exec -T db psql -U postgres snowpulse < backup_20240101_120000.sql
```

### MinIO Data Restore

```bash
# List available MinIO backups
ls ./backups/datasets

# Restore bucket
docker compose exec -T minio mc mirror ./backups/datasets minio/datasets
```

### Complete Fresh Start

```bash
# Remove all data
docker compose down -v

# Rebuild
docker compose build

# Start fresh
docker compose up -d

# Re-initialize databases
docker compose exec backend python -m alembic upgrade head
```

## Production Deployment Platforms

### AWS ECS/Fargate

- Use ECS service discovery instead of docker-compose
- Store secrets in AWS Secrets Manager
- Use RDS for PostgreSQL
- Use ElastiCache for Redis
- Use S3 with MinIO gateway

### Kubernetes (K8s)

- Convert docker-compose.yml to Helm charts
- Use StatefulSets for databases
- Configure horizontal pod autoscaling
- Use ingress for routing
- Implement network policies

### Docker Swarm

- Deploy stack: `docker stack deploy -c docker-compose.yml snowpulse`
- Scale services: `docker service scale snowpulse_backend=3`
- Monitor: Use Portainer for UI

## Performance Optimization

1. **Enable HTTP/2 in Caddy** for faster requests
2. **Configure Redis memory limits** to prevent eviction
3. **Tune PostgreSQL parameters** (shared_buffers, effective_cache_size)
4. **Use CDN for frontend assets**
5. **Enable gzip compression** in all HTTP responses
6. **Optimize database indexes** on frequently queried columns

## Incident Response

### Backend Crash

1. Check logs: `docker compose logs backend | tail -100`
2. Restart: `docker compose restart backend`
3. Monitor recovery: `docker compose logs -f backend`

### Database Connectivity Loss

1. Verify database is running: `docker compose ps db`
2. Check database logs: `docker compose logs db`
3. Restart database: `docker compose restart db`
4. Verify readiness: `curl http://localhost:8000/health/readiness`

### Out of Disk Space

1. Check usage: `docker system df`
2. Remove unused images: `docker image prune -a`
3. Clean up volumes: `docker volume prune`
4. Check database size: `du -sh docker-volumes/postgres_data/`
