# ==============================================================================
# Stage 1: Build the React Application with Vite
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications for optimal layer caching
COPY package.json package-lock.json ./

# Install npm dependencies
RUN npm ci

# Copy application source code
COPY . .

# Build production bundle into /app/dist
RUN npm run build

# ==============================================================================
# Stage 2: Serve Production Assets with Nginx
# ==============================================================================
FROM nginx:alpine

# Copy custom Nginx configuration with API proxy and SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose container HTTP port
EXPOSE 80

# Run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
