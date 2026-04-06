# STAGE 1: Build React Production Package
FROM node:22-alpine as builder

WORKDIR /app

# Enable high-speed NPM cache
COPY package*.json ./
RUN npm install --frozen-lockfile

# Final Compile
COPY . .
RUN npm run build

# STAGE 2: High-Performance Delivery (NGINX)
FROM nginx:alpine

# Copy Build Artifacts to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom NginX Configuration for EMR Scale
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
