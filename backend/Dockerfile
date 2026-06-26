# syntax=docker/dockerfile:1

FROM node:20-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY data ./data

RUN npm run build

FROM node:20-bookworm-slim AS runtime

# Accept MS Core Fonts EULA so LibreOffice can use Arial (templates use Arial throughout).
# ttf-mscorefonts-installer is in Debian contrib, which slim images omit by default.
RUN sed -i '/^Components:/ {/\bcontrib\b/! s/ main$/ main contrib/}' /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fontconfig \
    debconf-utils \
    wget \
  && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ttf-mscorefonts-installer \
    libreoffice \
    libreoffice-calc \
    fonts-liberation \
  && fc-cache -f -v \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p temp

EXPOSE 5000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/index.js"]
