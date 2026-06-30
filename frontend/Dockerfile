# syntax=docker/dockerfile:1.4
# Build stage: compile Next.js app
FROM node:20-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Copy package files first for better cache layer
COPY package*.json ./

# Use BuildKit cache mount for npm downloads
RUN --mount=type=cache,target=/root/.npm \
    npm config set cache /root/.npm && \
    npm ci --omit=dev

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# Runtime stage: minimal production image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Install only runtime dependencies
RUN apk add --no-cache curl dumb-init

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Set proper permissions
RUN chmod -R 755 /app && \
    chown -R nextjs:nodejs /app

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s \
    CMD curl -f http://localhost:3000 || exit 1

# Switch to non-root user
USER nextjs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
