FROM node:22.11

# Install required system tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        iputils-ping \
        dnsutils \
        curl \
        traceroute \
        net-tools && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps 

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port 8080
EXPOSE 8080

# New Relic Configuration
ENV NEW_RELIC_NO_CONFIG_FILE=true \
    NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true \
    NEW_RELIC_LOG=stdout \
    NEW_RELIC_AI_MONITORING_ENABLED=true \
    NEW_RELIC_CUSTOM_INSIGHTS_EVENTS_MAX_SAMPLES_STORED=100k \
    NEW_RELIC_SPAN_EVENTS_MAX_SAMPLES_STORED=10k

# Start the application
CMD ["npm", "start"]