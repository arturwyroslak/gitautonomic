# ----------------------------
# Builder stage
# ----------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# OpenSSL dla Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Lepsze cache
COPY package.json package-lock.json* ./
RUN npm ci

# Reszta źródeł (w tym public/)
COPY . .

# Prisma client + build
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

# Usuń devDependencies
RUN npm prune --omit=dev

# ----------------------------
# Runtime stage
# ----------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3300

# OpenSSL (Prisma) + psql client + netcat do wait-for + Prisma CLI do migracji
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates postgresql-client netcat-openbsd \
  && npm i -g prisma@5.22.0 \
  && rm -rf /var/lib/apt/lists/*

# Artefakty z buildera
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
# Statyczne pliki frontu
COPY --from=builder /app/public ./public

# Skrypty inicjalizacji DB
COPY scripts/db-init.sql ./scripts/db-init.sql
COPY scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x ./scripts/entrypoint.sh

EXPOSE 3300

# Używamy entrypointa, który wykona SQL, a potem odpali appkę
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["node", "dist/server.js"]
