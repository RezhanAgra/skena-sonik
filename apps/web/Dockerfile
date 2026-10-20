# syntax=docker/dockerfile:1
# Build dari root repo:  docker build -f apps/web/Dockerfile --build-arg SITE_URL=https://domainmu.com -t skena-web .

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w web

FROM deps AS build
COPY apps/web apps/web
# URL publik situs untuk canonical, Open Graph, dan sitemap
ARG SITE_URL=
ENV SITE_URL=$SITE_URL NODE_ENV=production
RUN npm run build -w web

# Image produksi: server Astro sudah berisi semua dependency (vite.ssr.noExternal di astro.config.mjs),
# jadi cukup folder dist tanpa node_modules
FROM base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
WORKDIR /app/apps/web
COPY --from=build /app/apps/web/dist ./dist
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/robots.txt || exit 1
# API_URL (alamat API untuk SSR) dibaca saat runtime, diisi dari docker-compose
CMD ["node", "dist/server/entry.mjs"]
