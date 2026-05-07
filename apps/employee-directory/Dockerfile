# syntax=docker/dockerfile:1.6

# ---- Stage 1: build React/Vite frontend ----
FROM node:20-alpine AS frontend-builder

WORKDIR /build

COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npx vite build


# ---- Stage 2: Python runtime ----
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DATABASE_URL=sqlite:////app/data/employee_assets.db \
    EXPORT_DIR=/app/exports

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY app/ ./app/
COPY scripts/ ./scripts/
COPY run.py manage.py ./

COPY --from=frontend-builder /build/dist ./frontend/dist

RUN mkdir -p /app/data /app/exports

EXPOSE 5065

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:5065/api/health || exit 1

CMD ["sh", "-c", "(python seed.py || echo '[edir] seed warning, continuing') && python run.py"]
