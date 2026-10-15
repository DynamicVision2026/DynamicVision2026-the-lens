# WO-024: 視点レンズ as its own static site on Cloud Run (lens.domo-ai.com). No server code, no database:
# build the bundle and the trainer, then serve apps/trainer/dist with nginx on $PORT (Cloud Run: 8080).

# ---- build: validate the cards into build/bundle.json, then vite build ----
FROM node:22-bookworm-slim AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm bundle && pnpm --filter @lens/trainer build

# ---- serve: nginx, SPA fallback, long cache for hashed assets, no cache for index.html ----
FROM nginx:1.27-alpine
ENV PORT=8080
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/trainer/dist /usr/share/nginx/html
EXPOSE 8080
