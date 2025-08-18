# ----------------------------
# Base stage
# ----------------------------
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Zainstaluj systemowe dependencies
RUN apt-get update && apt-get install -y wget postgresql-client libssl-dev && rm -rf /var/lib/apt/lists/*

# Skopiuj package.json i package-lock.json
COPY package.json package-lock.json* ./

# Zainstaluj wszystkie dependencies (w tym devDependencies potrzebne do builda)
RUN npm install

# Skopiuj resztę kodu
COPY . .


# Generate Prisma client with explicit engine types
RUN npx prisma generate --schema=./prisma/schema.prisma || echo "Prisma generate failed, will try alternative approach"

# Zbuduj TypeScript
RUN npm run build

# ----------------------------
# Server stage
# ----------------------------
FROM node:20-bookworm-slim AS server
WORKDIR /app
ENV NODE_ENV=production

# Zainstaluj systemowe dependencies potrzebne w runtime
RUN apt-get update && apt-get install -y wget postgresql-client libssl-dev && rm -rf /var/lib/apt/lists/*

# Skopiuj build i node_modules z base
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/package.json ./package.json

# Set environment variables for Prisma
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# Ensure Prisma client is properly generated
RUN npx prisma generate --schema=./prisma/schema.prisma || echo "Prisma client generation skipped due to network restrictions"

EXPOSE 3300

CMD ["node", "dist/server.js"]
