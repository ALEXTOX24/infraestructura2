# --- ETAPA 1: Builder ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci && mkdir -p node_modules

COPY . .
RUN npm prune --omit=dev

# --- ETAPA 2: Producción ---
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    SERVICE_NAME=multistage-api \
    APP_VERSION=1.0.0

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json /app/server.js ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
