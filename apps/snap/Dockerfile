# Lens Snap (apps/snap) — image for Cloud Run.
# Build context = the REPO ROOT, so the workspace lockfile is used (reproducible installs):
#   docker build -f apps/snap/Dockerfile -t lens-snap .
# (deploy.sh does this through Cloud Build.) Only @lens/snap and its deps are installed.

FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY . .
RUN pnpm install --frozen-lockfile --filter "@lens/snap..."
RUN pnpm --filter @lens/snap build
# Production node_modules for the server only (no workspace links, no dev deps).
RUN pnpm --filter @lens/snap deploy --prod /out

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 WAITLIST_PATH=/tmp/waitlist.jsonl
COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/snap/dist ./dist
COPY --from=build /repo/apps/snap/dist-server ./dist-server
# Recorded reader outputs: MockReader is used when ANTHROPIC_API_KEY is not set.
COPY --from=build /repo/apps/snap/fixtures ./fixtures
USER node
EXPOSE 8080
CMD ["node", "dist-server/index.js"]
