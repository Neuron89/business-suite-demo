# =============================================================================
# SDS Portal — Flask + SQLite (raw sqlite3), Jinja templates, port 5001
# =============================================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DATABASE_URL=sqlite:////app/data/sds_portal.db

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt \
 && pip install pyjwt waitress

COPY . .
RUN mkdir -p /app/data /app/uploads

EXPOSE 5001

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "\
  echo '[sds-portal] seeding (idempotent)' \
  && (python seed.py || true) \
  && echo '[sds-portal] starting waitress on :5001' \
  && python -c \"from waitress import serve; from app import app; serve(app, host='0.0.0.0', port=5001)\" \
"]
