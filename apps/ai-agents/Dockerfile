# Build context: repo root (needed for packages/warranty-policy local dependency)
# Railway service config: Root Directory = / (repo root), Dockerfile = apps/ai-agents/Dockerfile
FROM python:3.11-slim

RUN pip install --no-cache-dir uv

WORKDIR /repo

# Copy local dependency package first (layer cache)
COPY packages/warranty-policy packages/warranty-policy

# Copy app source
COPY apps/ai-agents apps/ai-agents

WORKDIR /repo/apps/ai-agents

# Install all dependencies (uv resolves the local warranty-policy path)
RUN uv pip install --system --no-cache .

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
