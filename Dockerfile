ARG NODE_VERSION=24.21.0
ARG NODE_IMAGE_DIGEST=sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

FROM node:${NODE_VERSION}-bookworm-slim@${NODE_IMAGE_DIGEST} AS dependencies

WORKDIR /app

ENV CI=1
ENV WRANGLER_SEND_METRICS=false

COPY package.json package-lock.json .npmrc ./
RUN npm ci --strict-allow-scripts

FROM node:${NODE_VERSION}-bookworm-slim@${NODE_IMAGE_DIGEST}

WORKDIR /app

ENV NODE_ENV=development
ENV WRANGLER_SEND_METRICS=false

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

RUN mkdir -p /app/.generated /app/.wrangler && chown node:node /app/.generated /app/.wrangler

EXPOSE 8787

USER node

RUN npm run types:generate

CMD ["./node_modules/.bin/wrangler", "dev", "--local", "--ip", "0.0.0.0", "--port", "8787"]
