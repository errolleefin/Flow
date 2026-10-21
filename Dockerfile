# Stage 1: Build Frontend
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Runtime (Node 24 with native node:sqlite)
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV FLOW_DB_PATH=/app/data/flow.sqlite

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY src/utils ./src/utils
COPY src/types ./src/types

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3001

CMD ["node", "--no-warnings", "server/index.mjs"]
