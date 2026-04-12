# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies separately to leverage Docker layer cache
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/

# ── Runtime ──────────────────────────────────────────────────────────────────
# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "src/server.js"]
