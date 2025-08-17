# ----------------------------
# Base stage
# ----------------------------
FROM node:20-bullseye-slim AS base
WORKDIR /app

# Zainstaluj narzędzia systemowe
RUN apt-get update && apt-get install -y \
    wget \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Skopiuj package.json i zainstaluj wszystkie zależności
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install

# Skopiuj resztę kodu
COPY . .

# Zbuduj TS
RUN npm run build

# ----------------------------
# Final stage dla db-setup / api / worker
# ----------------------------
FROM node:20-bullseye-slim AS final
WORKDIR /app

# Skopiuj wszystko z base
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/package.json ./package.json

# Ustaw entrypoint / komendy w docker-compose
