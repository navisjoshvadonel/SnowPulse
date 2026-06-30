#!/usr/bin/env bash
# SnowPulse Docker Quick Reference - Copy into terminal as needed

# ═══════════════════════════════════════════════════════════════════════
# 🚀 QUICK START
# ═══════════════════════════════════════════════════════════════════════

# Development (with hot reload)
docker compose watch

# Production build
docker compose build

# Start services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# ═══════════════════════════════════════════════════════════════════════
# 🔧 BUILDKIT & CACHE OPTIMIZATION
# ═══════════════════════════════════════════════════════════════════════

# Enable BuildKit (usually already enabled)
export DOCKER_BUILDKIT=1

# Build with progress output
docker compose build --progress=plain

# Build single service
docker compose build backend

# Build without cache
docker compose build --no-cache backend

# View BuildKit cache
docker buildx du

# Clear all cache
docker buildx prune -a

# ═══════════════════════════════════════════════════════════════════════
# 🔄 HOT RELOAD (COMPOSE WATCH)
# ═══════════════════════════════════════════════════════════════════════

# Watch all services
docker compose watch

# Watch specific service
docker compose watch backend
docker compose watch frontend

# Watch without restarting services
docker compose up -d
docker compose watch --no-up

# ═══════════════════════════════════════════════════════════════════════
# 💻 RESOURCE & PERFORMANCE MONITORING
# ═══════════════════════════════════════════════════════════════════════

# Real-time stats for all containers
docker stats

# Stats for specific service
docker stats snowpulse-backend
docker stats snowpulse-ollama

# Check memory limits
docker inspect snowpulse-backend | grep -A 5 '"Memory"'

# View resource allocation
docker compose config | grep -A 10 'deploy:'

# ═══════════════════════════════════════════════════════════════════════
# 🎮 GPU SETUP (NVIDIA CUDA)
# ═══════════════════════════════════════════════════════════════════════

# Check NVIDIA driver
nvidia-smi

# Test Docker GPU access
docker run --rm --gpus all nvidia/cuda:11.0-runtime-ubuntu20.04 nvidia-smi

# Start Ollama with GPU (after uncommenting in docker-compose.yml)
docker compose restart ollama

# Watch GPU usage during generation
watch -n 1 'docker run --rm --gpus all nvidia/cuda:11.0-runtime-ubuntu20.04 nvidia-smi'

# ═══════════════════════════════════════════════════════════════════════
# 🍎 GPU SETUP (APPLE SILICON - METAL)
# ═══════════════════════════════════════════════════════════════════════

# Enable Metal (already set in docker-compose.yml if commented enabled)
# Uncomment OLLAMA_METAL: "1" in docker-compose.yml

# Monitor Apple GPU usage
powermetrics -n 1 | grep "GPU"

# Start Ollama
docker compose up -d ollama

# ═══════════════════════════════════════════════════════════════════════
# 🔐 SECURITY & NON-ROOT USER VERIFICATION
# ═══════════════════════════════════════════════════════════════════════

# Check backend user
docker compose exec backend whoami
# Expected output: appuser

# Check frontend user
docker compose exec frontend whoami
# Expected output: nextjs

# Verify file permissions
docker compose exec backend ls -la /app/app

# ═══════════════════════════════════════════════════════════════════════
# 🏥 HEALTH CHECKS
# ═══════════════════════════════════════════════════════════════════════

# Check all container health
docker compose ps

# Backend liveness check
curl http://localhost:8000/health/liveness

# Backend readiness check
curl http://localhost:8000/health/readiness

# View health check history
docker inspect snowpulse-backend | grep -A 20 '"Health"'

# ═══════════════════════════════════════════════════════════════════════
# 📊 OLLAMA AI MODEL SETUP
# ═══════════════════════════════════════════════════════════════════════

# Pull lightweight model (2.7B)
docker compose exec ollama ollama pull phi

# Pull balanced model (7B)
docker compose exec ollama ollama pull llama2

# List available models
docker compose exec ollama ollama list

# Generate text with model
docker compose exec ollama ollama run phi "Explain Docker in 50 words"

# Check Ollama logs for GPU/Metal detection
docker compose logs ollama | grep -i "gpu\|cuda\|metal"

# ═══════════════════════════════════════════════════════════════════════
# 🗄️ DATABASE OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

# Connect to PostgreSQL
docker compose exec db psql -U postgres -d snowpulse

# Backup database
docker compose exec -T db pg_dump -U postgres snowpulse > backup.sql

# Restore database
docker compose exec -T db psql -U postgres snowpulse < backup.sql

# Check database size
docker compose exec db psql -U postgres -d snowpulse -c "SELECT pg_size_pretty(pg_database_size('snowpulse'));"

# Run VACUUM (maintenance)
docker compose exec db psql -U postgres -d snowpulse -c "VACUUM ANALYZE;"

# ═══════════════════════════════════════════════════════════════════════
# 🔍 TROUBLESHOOTING
# ═══════════════════════════════════════════════════════════════════════

# View full logs for specific service
docker compose logs backend | head -100

# Follow logs in real-time
docker compose logs -f backend

# Check for errors
docker compose logs backend | grep -i error

# Restart a service
docker compose restart backend

# Rebuild and restart
docker compose up -d --build backend

# Remove stopped containers
docker compose rm -f

# Check disk space
docker system df

# Clean up unused resources
docker system prune -a

# View docker-compose configuration
docker compose config

# ═══════════════════════════════════════════════════════════════════════
# 🚨 ERROR RECOVERY
# ═══════════════════════════════════════════════════════════════════════

# Container out of memory (exit code 137)
# Edit docker-compose.yml, increase memory limit, restart:
docker compose restart backend

# Port already in use
# Change port in docker-compose.yml or kill process:
lsof -i :8000
kill -9 <PID>

# Database connection refused
# Check if database is healthy:
docker compose exec db pg_isready -U postgres

# Rebuild from scratch
docker compose down -v  # Remove all volumes
docker compose build    # Rebuild images
docker compose up -d    # Start services

# ═══════════════════════════════════════════════════════════════════════
# 📈 PERFORMANCE OPTIMIZATION CHECKLIST
# ═══════════════════════════════════════════════════════════════════════

# ✓ BuildKit cache working
docker buildx du

# ✓ Hot reload configured
docker compose config | grep -q "watch:" && echo "✓ Watch configured"

# ✓ Resource limits set
docker compose config | grep -q "limits:" && echo "✓ Limits configured"

# ✓ Non-root users running
docker compose exec backend whoami | grep -q "appuser" && echo "✓ Backend non-root"
docker compose exec frontend whoami | grep -q "nextjs" && echo "✓ Frontend non-root"

# ✓ Healthchecks enabled
docker compose ps | grep -q "healthy" && echo "✓ Services healthy"

# ═══════════════════════════════════════════════════════════════════════
# 📚 ENVIRONMENT VARIABLES
# ═══════════════════════════════════════════════════════════════════════

# Set JWT secret key (32 characters)
export JWT_SECRET_KEY="your-secure-32-character-key-here-1234567890"

# Set database password
export DB_PASSWORD="your-secure-password"

# Set Redis password
export REDIS_PASSWORD="your-redis-password"

# Set Minio password
export MINIO_ROOT_PASSWORD="your-minio-password"

# Set Meili master key
export MEILI_MASTER_KEY="your-meili-key"

# Set Grafana password
export GRAFANA_PASSWORD="your-grafana-password"

# Load from .env file
export $(cat .env | xargs)

# ═══════════════════════════════════════════════════════════════════════
# 🎯 COMMON WORKFLOWS
# ═══════════════════════════════════════════════════════════════════════

# Fresh development environment
docker compose down -v
cp .env.example .env
# Edit .env with your secrets
docker compose build
docker compose up -d
docker compose watch

# Add a new Python package
# 1. Edit backend/requirements.txt
# 2. docker compose watch detects change
# 3. Container rebuilds (~30 seconds)
# 4. Ready to use new package

# Add a new npm package
# 1. Edit frontend/package.json
# 2. docker compose watch detects change
# 3. Container rebuilds (~30 seconds)
# 4. Next.js recompiles

# Deploy to production
docker compose build
docker compose up -d
# Wait for healthchecks to pass
docker compose ps

# Full backup
docker compose exec -T db pg_dump -U postgres snowpulse > backup_$(date +%Y%m%d_%H%M%S).sql
docker system df
tar -czf snowpulse_backup_$(date +%Y%m%d_%H%M%S).tar.gz docker-compose.yml .env

# ═══════════════════════════════════════════════════════════════════════
# 📚 USEFUL LINKS
# ═══════════════════════════════════════════════════════════════════════

# Docker Compose Watch (hot reload)
# https://docs.docker.com/compose/file-watch/

# BuildKit cache mounts
# https://docs.docker.com/build/cache/

# Docker resource limits
# https://docs.docker.com/compose/compose-file/deploy/

# Docker non-root user best practices
# https://docs.docker.com/develop/dev-best-practices/#run-containers-as-a-non-root-user

# Ollama documentation
# https://github.com/ollama/ollama

# PostgreSQL performance tuning
# https://wiki.postgresql.org/wiki/Performance_Optimization

# ═══════════════════════════════════════════════════════════════════════
# 🎓 LEARNING RESOURCES
# ═══════════════════════════════════════════════════════════════════════

# For more details, read:
cat OPTIMIZATION_GUIDE.md
cat OPTIMIZATION_COMPLETE.md
cat PRODUCTION_DEPLOYMENT.md

# Run optimization tests
bash test-optimizations.sh
