ARG NODE_IMAGE=node:24-bookworm-slim
ARG RUNTIME_BASE_IMAGE=harbor.nangman.cloud/library/netlab-runtime-base:latest

FROM ${NODE_IMAGE} AS build-base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

WORKDIR /app

FROM build-base AS deps

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build

COPY . .
RUN pnpm run build && pnpm prune --prod

FROM ${RUNTIME_BASE_IMAGE} AS runtime

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
