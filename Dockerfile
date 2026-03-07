FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      dnsutils \
      iputils-ping \
      net-tools \
      traceroute && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .
RUN pnpm run build && pnpm prune --prod

FROM base AS runtime

ENV NODE_ENV=production
ENV NEW_RELIC_NO_CONFIG_FILE=true \
    NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true \
    NEW_RELIC_LOG=stdout \
    NEW_RELIC_AI_MONITORING_ENABLED=true \
    NEW_RELIC_CUSTOM_INSIGHTS_EVENTS_MAX_SAMPLES_STORED=100k \
    NEW_RELIC_SPAN_EVENTS_MAX_SAMPLES_STORED=10k

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/data ./server/data
COPY --from=build /app/.env.example ./.env.example

RUN mkdir -p logs

EXPOSE 8080

CMD ["node", "dist/index.js"]
