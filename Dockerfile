FROM node:22-alpine AS frontend-build

WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM golang:1.24-alpine AS backend-build

WORKDIR /src
COPY go.mod ./
COPY backend ./backend
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/pokefactory ./backend/cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/pokefactory-sync ./backend/cmd/sync

FROM alpine:3.21 AS runtime

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

ENV HOST=0.0.0.0 \
    PORT=3000 \
    WEB_ROOT=/app/dist \
    STORAGE_ROOT=/app/storage \
    STATE_DIR=/app/var \
    ALLOW_UPSTREAM_FETCH=true

COPY --from=frontend-build /src/dist ./dist
COPY --from=backend-build /out/pokefactory /usr/local/bin/pokefactory
COPY --from=backend-build /out/pokefactory-sync /usr/local/bin/pokefactory-sync
COPY storage ./storage
COPY backend/config ./backend/config
RUN mkdir -p /app/var && chown -R app:app /app

USER app
VOLUME ["/app/var"]
EXPOSE 3000
CMD ["pokefactory"]
