ARG NODE_VERSION=24.18.0
ARG NODE_IMAGE_DIGEST=sha256:cb4e8f7c443347358b7875e717c29e27bf9befc8f5a26cf18af3c3dec80e58c5

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
