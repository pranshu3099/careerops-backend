# syntax=docker/dockerfile:1

FROM node:24.15.0-bookworm-slim AS dependencies

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
COPY prisma.config.ts ./

# Prisma reads DATABASE_URL while loading prisma.config.ts. Client generation does
# not contact the database, so use a non-secret placeholder during the image build.
RUN DATABASE_URL="postgresql://docker:docker@127.0.0.1:5432/docker" npx prisma generate

FROM node:24.15.0-bookworm-slim AS production

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts ./
COPY --chown=node:node src ./src

USER node

EXPOSE 3000

CMD ["npm", "start"]
