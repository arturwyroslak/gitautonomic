# ----------------------------
# Base stage
# ----------------------------
FROM node:20-bullseye-slim AS base
WORKDIR /app
ENV NODE_ENV=production
# Zainstaluj systemowe dependencies
RUN apt-get update && apt-get install -y wget postgresql-client libssl-dev && rm -rf /var/lib/apt/lists/*

# Skopiuj package.json i zainstaluj wszystkie dependencies
COPY package.json ./
# production=false ensures devDependencies (prisma) are installed
RUN npm install --omit=dev

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
RUN apt-get update && apt-get install -y wget postgresql-client libssl-dev && rm -rf /var/lib/apt/lists/*

# Skopiuj wszystko potrzebne do uruchomienia api/worker/db-setup
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/package.json ./package.json

EXPOSE 3000

# Domyślna komenda (api)
CMD ["node", "dist/server.js"]
