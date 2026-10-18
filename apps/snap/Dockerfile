# Lens Snap (apps/snap) — self-contained image for Cloud Run. Build context = this folder.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi
COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 WAITLIST_PATH=/tmp/waitlist.jsonl
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# Recorded reader outputs: MockReader is used when ANTHROPIC_API_KEY is not set.
COPY --from=build /app/fixtures ./fixtures
USER node
EXPOSE 8080
CMD ["node", "dist-server/index.js"]
