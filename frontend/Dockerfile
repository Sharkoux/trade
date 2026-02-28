# Dockerfile multi-stage pour SpreadLab
# Supporte AMD64 et ARM64 (Raspberry Pi)

# ============ Stage 1: Dependencies ============
FROM node:20-alpine AS deps
WORKDIR /app

# Installer les dépendances pour la compilation de better-sqlite3
RUN apk add --no-cache python3 make g++ libc6-compat

# Copier les fichiers de dépendances
COPY package.json package-lock.json* ./

# Installer les dépendances
RUN npm ci --legacy-peer-deps

# ============ Stage 2: Builder ============
FROM node:20-alpine AS builder
WORKDIR /app

# Copier les dépendances installées
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables d'environnement pour le build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js
RUN npm run build

# ============ Stage 3: Runner (Production) ============
FROM node:20-alpine AS runner
WORKDIR /app

# Installer les dépendances runtime pour better-sqlite3
RUN apk add --no-cache libc6-compat

# Créer un utilisateur non-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Variables d'environnement
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copier les fichiers nécessaires
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copier les modules natifs (better-sqlite3)
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder /app/node_modules/prebuild-install ./node_modules/prebuild-install

# Copier le worker bot et les libs
COPY --from=builder /app/bot-worker.js ./
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/ecosystem.config.js ./

# Créer les dossiers de données et logs
RUN mkdir -p /app/data /app/logs
RUN chown -R nextjs:nodejs /app/data /app/logs

# Utiliser l'utilisateur non-root
USER nextjs

# Exposer le port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Commande par défaut (serveur web)
# Force HOSTNAME=0.0.0.0 au runtime car Docker écrase cette variable
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 node server.js"]
