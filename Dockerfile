# ----------------------------
# Base stage
# ----------------------------
FROM node:20-bullseye-slim AS base
WORKDIR /app

# Zainstaluj systemowe dependencies
RUN apt-get update && apt-get install -y \
    wget \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Skopiuj package.json i zainstaluj wszystkie dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* ./
# production=false ensures devDependencies (prisma) are installed
RUN npm install --production=false

# Skopiuj resztę kodu
COPY . .

# Zbuduj TypeScript
RUN npm run build

# ----------------------------
# Server stage
# ----------------------------
FROM node:20-bullseye-slim AS server
WORKDIR /app

# Ustaw NODE_ENV dopiero w finalnym obrazie
ENV NODE_ENV=production

# Zainstaluj systemowe dependencies
RUN apt-get update && apt-get install -y \
    wget \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Skopiuj wszystko potrzebne do uruchomienia api/worker/db-setup
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/package-lock.json* ./
COPY --from=base /app/pnpm-lock.yaml* ./

EXPOSE 3000

# Domyślna komenda (api)
CMD ["node", "dist/server.js"]
