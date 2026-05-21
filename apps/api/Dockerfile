# Build context: repo root
# Railway service settings: Root Directory = / (repo root), Dockerfile path = apps/api/Dockerfile
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /repo

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/customer-demo/package.json apps/customer-demo/package.json
COPY packages/vapi-assistant-config/package.json packages/vapi-assistant-config/package.json

# Install only api and its transitive deps (pnpm resolves the workspace graph)
RUN pnpm install --no-frozen-lockfile --filter @joola/api

COPY apps/api apps/api

RUN cd apps/api && pnpm build

ENV NODE_ENV=production

WORKDIR /repo/apps/api

EXPOSE 3001

# No --env-file flag: Railway injects env vars directly into process.env
CMD ["node", "dist/index.js"]
