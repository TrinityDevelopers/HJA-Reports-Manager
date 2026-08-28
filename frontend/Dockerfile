# syntax=docker/dockerfile:1

FROM node:20-bookworm AS build

WORKDIR /app

# Build shared package first (@hja/shared)
COPY packages/shared/package.json packages/shared/package-lock.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
WORKDIR /app/packages/shared
RUN npm ci && npm run build

# Build frontend
WORKDIR /app/frontend

ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=$VITE_API_URL

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.node.json ./
COPY frontend/public ./public
COPY frontend/src ./src

RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
