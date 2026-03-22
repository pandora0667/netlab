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

ARG APP_BUILD_SHA=dev
ARG APP_BUILD_REF=local
ARG APP_BUILD_TIME=

ENV NODE_ENV=production
ENV APP_BUILD_SHA="${APP_BUILD_SHA}"
ENV APP_BUILD_REF="${APP_BUILD_REF}"
ENV APP_BUILD_TIME="${APP_BUILD_TIME}"

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/data ./server/data
COPY --from=build /app/.env.example ./.env.example

RUN mkdir -p logs

LABEL org.opencontainers.image.revision="${APP_BUILD_SHA}"
LABEL org.opencontainers.image.ref.name="${APP_BUILD_REF}"
LABEL org.opencontainers.image.created="${APP_BUILD_TIME}"

EXPOSE 8080

CMD ["node", "dist/index.js"]
