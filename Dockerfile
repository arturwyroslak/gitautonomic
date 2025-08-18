# ----------------------------
# Builder stage
# ----------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# OpenSSL do detekcji przez Prisma + certy
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Lepsze cache
COPY package.json package-lock.json* ./
RUN npm ci

# Reszta źródeł
COPY . .

# Prisma client + build TS
# (jeśli używasz Node-API domyślnie, to i tak wymaga libssl3 w runtime)
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

# OpenSSL w runtime (dla Prisma engines)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Artefakty
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Nie wymuszajmy binarnych silników — zostaw domyślne Node-API
# Jeśli wcześniej miałeś te ENV, usuń:
# ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
# ENV PRISMA_CLIENT_ENGINE_TYPE=binary

EXPOSE 3300
CMD ["node", "dist/server.js"]
