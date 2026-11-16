FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup -S aerostat && adduser -S -G aerostat aerostat

COPY --from=build --chown=aerostat:aerostat /app/.next/standalone ./
COPY --from=build --chown=aerostat:aerostat /app/.next/static ./.next/static
COPY --from=build --chown=aerostat:aerostat /app/public ./public
COPY --from=build --chown=aerostat:aerostat /app/peer.mjs ./peer.mjs

USER aerostat
EXPOSE 3000
CMD ["node", "--import", "./peer.mjs", "server.js"]
