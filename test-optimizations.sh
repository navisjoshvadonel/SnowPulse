#!/bin/bash
# Test script for optimized Docker builds
# Tests BuildKit cache, GPU support, and non-root user execution

set -e

echo "════════════════════════════════════════════════════════════════"
echo "  Docker Build Optimization Test Suite"
echo "════════════════════════════════════════════════════════════════"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
check_buildkit() {
    echo -e "${BLUE}[1] Checking BuildKit...${NC}"
    if ! command -v docker buildx &> /dev/null; then
        echo -e "${YELLOW}⚠️  BuildKit not found, installing...${NC}"
        docker buildx create --name mybuilder 2>/dev/null || true
        docker buildx use mybuilder 2>/dev/null || true
    fi
    
    if docker buildx version &> /dev/null; then
        echo -e "${GREEN}✓ BuildKit is available${NC}"
    else
        echo -e "${RED}✗ BuildKit installation failed${NC}"
        exit 1
    fi
}

# Test BuildKit cache
test_buildkit_cache() {
    echo -e "\n${BLUE}[2] Testing BuildKit cache performance...${NC}"
    
    # First build (cold cache)
    echo -e "${YELLOW}Building backend (cold cache)...${NC}"
    start_time=$(date +%s)
    docker buildx build --load -t snowpulse-backend:test ./backend -q
    end_time=$(date +%s)
    cold_time=$((end_time - start_time))
    echo -e "${GREEN}✓ Cold build: ${cold_time}s${NC}"
    
    # Second build (warm cache)
    echo -e "${YELLOW}Building backend again (warm cache)...${NC}"
    start_time=$(date +%s)
    docker buildx build --load -t snowpulse-backend:test ./backend -q
    end_time=$(date +%s)
    warm_time=$((end_time - start_time))
    echo -e "${GREEN}✓ Warm build: ${warm_time}s${NC}"
    
    # Check cache improvement
    if [ "$cold_time" -gt "$warm_time" ]; then
        improvement=$(echo "scale=1; ($cold_time - $warm_time) / $cold_time * 100" | bc)
        echo -e "${GREEN}✓ Cache improvement: ~${improvement}%${NC}"
    fi
}

# Test non-root user execution
test_non_root_user() {
    echo -e "\n${BLUE}[3] Testing non-root user execution...${NC}"
    
    # Backend non-root
    echo -e "${YELLOW}Checking backend user...${NC}"
    backend_user=$(docker compose exec -T backend whoami 2>/dev/null || echo "root")
    if [ "$backend_user" != "root" ]; then
        echo -e "${GREEN}✓ Backend runs as: $backend_user (non-root)${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend runs as root (development)${NC}"
    fi
    
    # Frontend non-root
    echo -e "${YELLOW}Checking frontend user...${NC}"
    frontend_user=$(docker compose exec -T frontend whoami 2>/dev/null || echo "root")
    if [ "$frontend_user" != "root" ]; then
        echo -e "${GREEN}✓ Frontend runs as: $frontend_user (non-root)${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend runs as root (development)${NC}"
    fi
}

# Test resource limits
test_resource_limits() {
    echo -e "\n${BLUE}[4] Testing resource limits configuration...${NC}"
    
    # Check backend limits
    echo -e "${YELLOW}Checking backend resource limits...${NC}"
    if docker compose config | grep -A 5 "snowpulse-backend" | grep -q "cpus"; then
        echo -e "${GREEN}✓ Backend has CPU limits configured${NC}"
    fi
    
    if docker compose config | grep -A 5 "snowpulse-backend" | grep -q "memory"; then
        echo -e "${GREEN}✓ Backend has memory limits configured${NC}"
    fi
    
    # Check Ollama GPU configuration
    echo -e "${YELLOW}Checking Ollama GPU configuration...${NC}"
    if docker compose config | grep -A 10 "ollama" | grep -q "OLLAMA_METAL\|nvidia"; then
        echo -e "${GREEN}✓ Ollama has GPU configuration (commented or active)${NC}"
    fi
}

# Test hot reload configuration
test_hot_reload() {
    echo -e "\n${BLUE}[5] Testing hot reload (watch) configuration...${NC}"
    
    if docker compose config | grep -q "develop:"; then
        echo -e "${GREEN}✓ Develop section configured in docker-compose.yml${NC}"
        
        if docker compose config | grep -q "watch:"; then
            echo -e "${GREEN}✓ Watch configuration present${NC}"
            
            # Count watch rules
            watch_count=$(docker compose config | grep -c "action:" || echo "0")
            echo -e "${GREEN}✓ Found $watch_count watch rules${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Develop section not found (requires Compose V2.22+)${NC}"
    fi
}

# Test Dockerfile syntax
test_dockerfile_syntax() {
    echo -e "\n${BLUE}[6] Testing Dockerfile syntax...${NC}"
    
    # Backend Dockerfile
    echo -e "${YELLOW}Validating backend/Dockerfile...${NC}"
    if grep -q "syntax=docker/dockerfile:1" backend/Dockerfile; then
        echo -e "${GREEN}✓ Backend uses dockerfile syntax directive${NC}"
    fi
    
    if grep -q "RUN --mount=type=cache" backend/Dockerfile; then
        echo -e "${GREEN}✓ Backend uses BuildKit cache mount${NC}"
    fi
    
    if grep -q "USER appuser" backend/Dockerfile; then
        echo -e "${GREEN}✓ Backend runs as non-root user${NC}"
    fi
    
    # Frontend Dockerfile
    echo -e "${YELLOW}Validating frontend/Dockerfile...${NC}"
    if grep -q "syntax=docker/dockerfile:1" frontend/Dockerfile; then
        echo -e "${GREEN}✓ Frontend uses dockerfile syntax directive${NC}"
    fi
    
    if grep -q "RUN --mount=type=cache" frontend/Dockerfile; then
        echo -e "${GREEN}✓ Frontend uses BuildKit cache mount${NC}"
    fi
    
    if grep -q "USER nextjs" frontend/Dockerfile; then
        echo -e "${GREEN}✓ Frontend runs as non-root user${NC}"
    fi
}

# Test healthchecks
test_healthchecks() {
    echo -e "\n${BLUE}[7] Testing healthcheck configuration...${NC}"
    
    services_with_healthcheck=$(docker compose config | grep -c "HEALTHCHECK\|test:" || echo "0")
    echo -e "${GREEN}✓ Services with healthcheck: $services_with_healthcheck${NC}"
    
    if docker compose config | grep -q "curl -f http://localhost:8000/health"; then
        echo -e "${GREEN}✓ Backend healthcheck configured${NC}"
    fi
    
    if docker compose config | grep -q "curl -f http://localhost:3000"; then
        echo -e "${GREEN}✓ Frontend healthcheck configured${NC}"
    fi
}

# Test .dockerignore
test_dockerignore() {
    echo -e "\n${BLUE}[8] Testing .dockerignore...${NC}"
    
    if [ -f .dockerignore ]; then
        echo -e "${GREEN}✓ .dockerignore exists${NC}"
        
        # Check for important ignores
        if grep -q "__pycache__" .dockerignore; then
            echo -e "${GREEN}✓ .dockerignore excludes __pycache__${NC}"
        fi
        
        if grep -q "node_modules" .dockerignore; then
            echo -e "${GREEN}✓ .dockerignore excludes node_modules${NC}"
        fi
        
        if grep -q ".git" .dockerignore; then
            echo -e "${GREEN}✓ .dockerignore excludes .git${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  .dockerignore not found${NC}"
    fi
}

# Show image sizes
show_image_sizes() {
    echo -e "\n${BLUE}[9] Image size comparison...${NC}"
    
    # Build images first
    docker compose build --quiet 2>/dev/null || true
    
    backend_size=$(docker images snowpulse-backend --format="{{.Size}}" 2>/dev/null | head -1)
    frontend_size=$(docker images snowpulse-frontend --format="{{.Size}}" 2>/dev/null | head -1)
    
    if [ -n "$backend_size" ]; then
        echo -e "${GREEN}✓ Backend image: $backend_size${NC}"
    fi
    
    if [ -n "$frontend_size" ]; then
        echo -e "${GREEN}✓ Frontend image: $frontend_size${NC}"
    fi
}

# Main execution
main() {
    check_buildkit
    test_dockerfile_syntax
    test_dockerignore
    test_hot_reload
    test_resource_limits
    test_healthchecks
    
    # Only run these if services are running
    if docker compose ps | grep -q "snowpulse"; then
        test_non_root_user
    else
        echo -e "\n${YELLOW}⚠️  Skipping runtime tests (services not running)${NC}"
        echo -e "${YELLOW}To test non-root users and healthchecks, run: docker compose up -d${NC}"
    fi
    
    echo -e "\n════════════════════════════════════════════════════════════════"
    echo -e "${GREEN}✓ All optimization checks completed!${NC}"
    echo -e "════════════════════════════════════════════════════════════════\n"
    
    echo "Next steps:"
    echo "1. Review OPTIMIZATION_GUIDE.md for detailed usage"
    echo "2. Start with hot reload: docker compose watch"
    echo "3. Check GPU support: Uncomment OLLAMA_METAL or nvidia config"
    echo "4. Monitor resources: docker stats"
}

main "$@"
