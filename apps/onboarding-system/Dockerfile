# =============================================================================
# Onboarding System — Next.js client + Express server (workspaces monorepo)
# =============================================================================
FROM node:20-bookworm-slim

WORKDIR /app

# postgresql-client is used by the entrypoint to wait for the db.
# python3/build-essential is needed for bcrypt's native build on first install.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl postgresql-client tini python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Install deps with the full source — workspace hoisting makes the layered
# approach fragile, so we keep it simple.
COPY . .
RUN npm install --workspaces --include-workspace-root

# Build shared → server → client
RUN npm run build

EXPOSE 3080 4080

ENV NODE_ENV=production

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "\
  echo '[onboarding] waiting for postgres...' \
  && until pg_isready -h ${DB_HOST:-postgres} -p ${DB_PORT:-5432} -U ${DB_USER:-demo} >/dev/null 2>&1; do sleep 1; done \
  && echo '[onboarding] running migrations' \
  && npm run migrate \
  && echo '[onboarding] running seeds' \
  && (npm run seed || echo '[onboarding] seed warning, continuing') \
  && echo '[onboarding] starting client + server' \
  && npx --yes concurrently --kill-others-on-fail \
       'npm run start -w server' \
       'npm run start -w client' \
"]
