# ══════════════════════════════════════════════════════════════════
# Build stage
# ══════════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder
WORKDIR /app

# Závislosti
COPY package*.json ./
RUN npm ci

COPY . .

ARG CORS_ORIGIN=https://konfigurator.fabrick.sk
ENV CORS_ORIGIN=$CORS_ORIGIN

# Puppeteer – preskočíme stiahnutie bundled Chromia (použijeme systémový)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN DATABASE_URL="file:./dev.db" npx prisma generate
RUN npm run build

# ══════════════════════════════════════════════════════════════════
# Production stage
# ══════════════════════════════════════════════════════════════════
FROM node:20-alpine
WORKDIR /app

# ── Systémové balíčky pre Headless Chromium ───────────────────────
# Chromium + všetky potrebné natívne knižnice pre renderovanie PDF
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto \
      font-noto-cjk \
  && rm -rf /var/cache/apk/*

# ── Puppeteer environment ─────────────────────────────────────────
# Preskočíme stiahnutie bundled Chromia – puppeteer-core použije systémový
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Cesta k systémovému Chromiu na Alpine
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ── App environment ───────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3001
CMD ["npm", "run", "start"]
