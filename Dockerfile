# syntax=docker/dockerfile:1.7
# Two-stage build: bun builds the static SPA, nginx serves it.

FROM oven/bun:1.1-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/bun.lock* frontend/bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY frontend/ ./
ARG VITE_GA_MEASUREMENT_ID
ENV VITE_GA_MEASUREMENT_ID=${VITE_GA_MEASUREMENT_ID}
RUN bun run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
