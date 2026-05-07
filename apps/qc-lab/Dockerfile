# =============================================================================
# QC Lab — Flask + SQLite, Jinja templates, port 5000
# =============================================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DATABASE_URL=sqlite:////app/data/qc_lab.db

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt \
 && pip install pyjwt waitress

COPY . .
RUN mkdir -p /app/data

EXPOSE 5000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "\
  echo '[qc-lab] seeding (idempotent)' \
  && (python seed.py || true) \
  && echo '[qc-lab] starting waitress on :5000' \
  && python -c \"from waitress import serve; from app import app; serve(app, host='0.0.0.0', port=5000)\" \
"]
