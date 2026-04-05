FROM debian:bookworm-slim AS http3-curl-build

ARG NGHTTP3_VERSION=1.5.0
ARG NGTCP2_VERSION=1.11.0
ARG CURL_VERSION=8.7.1

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      autoconf \
      automake \
      build-essential \
      ca-certificates \
      curl \
      git \
      libgnutls28-dev \
      libnghttp2-dev \
      libtool \
      pkg-config \
      xz-utils \
      zlib1g-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /tmp/http3-build

RUN curl -fsSL "https://github.com/ngtcp2/nghttp3/releases/download/v${NGHTTP3_VERSION}/nghttp3-${NGHTTP3_VERSION}.tar.xz" | tar -xJ && \
    cd "nghttp3-${NGHTTP3_VERSION}" && \
    autoreconf -fi && \
    ./configure --enable-lib-only --prefix=/opt/netlab-http3 && \
    make -j"$(nproc)" && \
    make install

RUN curl -fsSL "https://github.com/ngtcp2/ngtcp2/releases/download/v${NGTCP2_VERSION}/ngtcp2-${NGTCP2_VERSION}.tar.xz" | tar -xJ && \
    cd "ngtcp2-${NGTCP2_VERSION}" && \
    autoreconf -fi && \
    PKG_CONFIG_PATH=/opt/netlab-http3/lib/pkgconfig ./configure \
      --enable-lib-only \
      --prefix=/opt/netlab-http3 \
      --with-gnutls && \
    make -j"$(nproc)" && \
    make install

RUN curl -fsSL "https://curl.se/download/curl-${CURL_VERSION}.tar.xz" | tar -xJ && \
    cd "curl-${CURL_VERSION}" && \
    autoreconf -fi && \
    PKG_CONFIG_PATH=/opt/netlab-http3/lib/pkgconfig \
    CPPFLAGS="-I/opt/netlab-http3/include" \
    LDFLAGS="-Wl,-rpath,/opt/netlab-http3/lib -L/opt/netlab-http3/lib" \
    ./configure \
      --prefix=/opt/netlab-http3 \
      --with-gnutls \
      --with-nghttp2 \
      --with-nghttp3=/opt/netlab-http3 \
      --with-ngtcp2=/opt/netlab-http3 \
      --disable-static && \
    make -j"$(nproc)" && \
    make install-strip

FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      dnsutils \
      iputils-ping \
      libgnutls30 \
      libnghttp2-14 \
      net-tools \
      traceroute \
      tshark && \
    rm -rf /var/lib/apt/lists/*

COPY --from=http3-curl-build /opt/netlab-http3 /opt/netlab-http3

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
ENV NETLAB_HTTP3_CURL_BINARY="/opt/netlab-http3/bin/curl"

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
