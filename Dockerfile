FROM node:20-bullseye-slim AS base
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install --production=false
COPY . .
RUN npm run build

FROM node:20-bullseye-slim AS server
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/dist ./dist
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install --omit=dev
EXPOSE 3000
CMD ["node","dist/server.js"]
