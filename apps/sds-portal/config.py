import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

SECRET_KEY = os.environ.get('SECRET_KEY', 'change-me-in-production')

# Portal SSO shared secret (HS256). When unset the /sso route returns 503.
PORTAL_SSO_SECRET = os.environ.get('PORTAL_SSO_SECRET')

# Demo flag — controls cookie hardening so the app works behind the demo
# reverse-proxy over plain HTTP. Truthy unless explicitly set to a falsey value.
DEMO_MODE = os.environ.get('DEMO_MODE', '1').lower() not in ('0', 'false', 'no', '')


def _resolve_db_path():
    """Honor DATABASE_URL when present.

    The rest of the app uses raw sqlite3 with a filesystem path, so we accept
    either a bare path or a sqlite:/// URI and reduce it to a path. Defaults to
    a file next to the app for local dev.
    """
    url = os.environ.get('DATABASE_URL')
    if not url:
        return os.path.join(BASE_DIR, 'sds_portal.db')
    if url.startswith('sqlite:////'):       # absolute: sqlite:////app/data/x.db
        return '/' + url[len('sqlite:////'):]
    if url.startswith('sqlite:///'):        # relative: sqlite:///x.db
        return url[len('sqlite:///'):]
    return url


DATABASE = _resolve_db_path()

# Store uploaded PDFs alongside the DB so they live on the same writable volume
# in the container (/app/data). Falls back to ./uploads for local dev.
_db_dir = os.path.dirname(DATABASE)
UPLOAD_FOLDER = os.path.join(_db_dir, 'uploads') if _db_dir else os.path.join(BASE_DIR, 'uploads')

MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max upload

# Access token settings
TOKEN_EXPIRY_MINUTES = 10
