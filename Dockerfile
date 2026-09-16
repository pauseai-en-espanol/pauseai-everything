# syntax=docker/dockerfile:1.7

# Single image for all three processes (web, worker, migrate). The worker and
# the migration job run TypeScript straight from src/ via tsx and drizzle-kit,
# so the runtime image keeps the full node_modules rather than a pruned
# standalone bundle. Simpler to operate; size is not a concern at this scale.

FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:26-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# .git is dockerignored; CD passes the short SHA so the UI can show the build.
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# --chown on COPY instead of a RUN chown afterwards: a separate chown layer
# duplicates the whole tree (~1 GB) in the image.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node package.json package-lock.json next.config.ts tsconfig.json drizzle.config.ts postcss.config.mjs ./
COPY --chown=node:node src ./src
COPY --chown=node:node drizzle ./drizzle

USER node

EXPOSE 3000

# Overridden by the Helm chart for the worker (`npm run worker`) and the
# migration hook (`npx drizzle-kit push`).
CMD ["npm", "start"]
