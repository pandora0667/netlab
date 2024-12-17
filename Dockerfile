# Build stage
FROM node:22.11

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

# Start the application
CMD ["npm", "start"]