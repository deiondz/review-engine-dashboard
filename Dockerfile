FROM oven/bun:1.3.14 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    MONGODB_URI=mongodb://127.0.0.1:27017/build \
    BETTER_AUTH_SECRET=build-only-secret-at-least-32-characters \
    MESSAGING_SERVICE_API_KEY=build-only-key-at-least-24-characters
RUN node node_modules/next/dist/bin/next build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3002 HOSTNAME=0.0.0.0
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3002
CMD ["node", "server.js"]
