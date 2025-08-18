# ----------------------------
# Builder stage
# ----------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Lepsze cache warstw
COPY package.json package-lock.json* ./
RUN npm ci

# Reszta źródeł
COPY . .
RUN apt-get update -y && apt-get install -y openssl
# Prisma client (raz, w buildzie) + build TS
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build
RUN apt-get update -y && apt-get install -y openssl

# Usuń devDependencies z node_modules po buildzie
RUN npm prune --omit=dev

# ----------------------------
# Runtime stage (app + worker)
# ----------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3300

# Kopiujemy z buildera produkcyjne artefakty
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Nie instalujemy psql/libssl-dev w runtime — lżejszy obraz
# (Prisma używa własnych binariów, nie wymaga psql)

EXPOSE 3000

# Ten sam obraz działa jako app (server.js) i worker (dist/worker.js)
CMD ["node", "dist/server.js"]
