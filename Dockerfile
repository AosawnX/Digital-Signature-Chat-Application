# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev deps for building)
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript
RUN npx tsc

# Expose ports (8084 for CA, 8085 for Chat Server)
EXPOSE 8084 8085

# Default command (can be overridden to run ca-server or chat-server)
CMD ["node", "dist/05_auth/server.js"]
