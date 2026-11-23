# API + worker image (monorepo)
# Build iz korijena repoa:
#   docker build -f apps/api/Dockerfile -t digitalni-asistent-api .
#
# Image sadrži i Prisma CLI (za `migrate deploy`) i worker ulaz (`dist/worker.js`).
# Za produkciju se preporučuje da migracije idu kao poseban korak (`migrate` servis u compose).

FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
ENV CI=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.34.9 --activate

WORKDIR /app

# Prvo samo manifesti — bolji Docker cache.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/

# `apps/api` postinstall pokreće `prisma generate`, pa schema mora postojati prije install-a.
COPY apps/api/prisma ./apps/api/prisma

# Instaliraj root (tsc/turbo) + api i njegove workspace zavisnosti; web/mobile se ne instaliraju.
RUN pnpm install --frozen-lockfile --filter . --filter "api..."

COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm --filter @digitalni-asistent/shared build \
  && pnpm --filter api exec prisma generate \
  && pnpm --filter api build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.34.9 --activate

WORKDIR /app

# Monorepo sa hoisted node_modules: kopiramo build stage u cjelini (uključuje Prisma CLI,
# workspace pakete i dist). Veličina je veća, ali nema "missing module" iznenađenja.
COPY --from=build /app /app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# API; worker koristi isti image sa `node apps/api/dist/worker.js`.
CMD ["node", "apps/api/dist/main.js"]
