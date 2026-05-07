# =============================================================================
# IQMS Chat — Flask, port 5055 (frontend with stubbed /ask backend)
# =============================================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .
RUN mkdir -p /app/data /app/uploads /app/reports

EXPOSE 5055

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "\
  echo '[iqms-chat] seeding demo users (idempotent)' \
  && (python seed.py || true) \
  && echo '[iqms-chat] starting waitress on :5055' \
  && python -c \"from waitress import serve; from app import app; serve(app, host='0.0.0.0', port=5055)\" \
"]
