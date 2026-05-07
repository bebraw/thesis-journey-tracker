ARG NODE_VERSION=25.8.1

FROM node:${NODE_VERSION}-bookworm-slim AS dependencies

WORKDIR /app

ENV CI=1
ENV WRANGLER_SEND_METRICS=false

COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development
ENV WRANGLER_SEND_METRICS=false

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run types:generate

EXPOSE 8787

CMD ["npx", "wrangler", "dev", "--local", "--ip", "0.0.0.0", "--port", "8787"]
