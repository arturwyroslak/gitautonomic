FROM node:20-bullseye-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install --production=false
COPY . .
RUN npm run build

FROM node:20-bullseye-slim AS server
WORKDIR /app
ENV NODE_ENV=production

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY package.json package-lock.json* pnpm-lock.yaml* ./
EXPOSE 3000
CMD ["node","dist/server.js"]
