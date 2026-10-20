# syntax=docker/dockerfile:1
# Build dari root repo:  docker build -f apps/api/Dockerfile -t skena-api .

FROM node:22-alpine AS base
WORKDIR /app

# package.json semua workspace dibutuhkan supaya package-lock.json cocok
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w api

FROM deps AS build
COPY apps/api apps/api
RUN npm run build -w api

# Image untuk migrasi & seed (punya Prisma CLI). Dijalankan sekali sebelum API start.
FROM build AS migrate
WORKDIR /app/apps/api
CMD ["npx", "prisma", "migrate", "deploy"]

# Image produksi: dist/server.js sudah berisi semua dependency (lihat scripts/bundle.mjs),
# jadi tidak perlu node_modules sama sekali
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/api
COPY --from=build /app/apps/api/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "--enable-source-maps", "dist/server.js"]
