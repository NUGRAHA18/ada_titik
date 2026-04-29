# ── Stage 1: Install production dependencies ──────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Non-root user untuk keamanan
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

# Salin dependencies dan source code
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Folder uploads harus ada dan dimiliki nodejs
RUN mkdir -p uploads && chown nodejs:nodejs uploads

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
