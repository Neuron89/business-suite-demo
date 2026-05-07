"""Seed users.json with the four demo users. Idempotent — only creates the
file if it doesn't already exist."""
import json
from hashlib import sha256
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
USERS_FILE = DATA_DIR / "users.json"


def _hash(password: str, salt: str = "") -> str:
    return sha256(f"{salt}:{password}".encode()).hexdigest()


DEMO_USERS = {
    "demo.it@acme.demo": {
        "display_name": "Ivy Tanaka",
        "password_hash": _hash("demo"),
        "is_admin": True,
    },
    "demo.hr@acme.demo": {
        "display_name": "Hana Reyes",
        "password_hash": _hash("demo"),
        "is_admin": True,
    },
    "demo.manager@acme.demo": {
        "display_name": "Marco Goldberg",
        "password_hash": _hash("demo"),
        "is_admin": False,
    },
    "demo.employee@acme.demo": {
        "display_name": "Eli Park",
        "password_hash": _hash("demo"),
        "is_admin": False,
    },
}


if USERS_FILE.exists():
    print(f"[iqms-chat seed] {USERS_FILE} exists, skipping.")
else:
    USERS_FILE.write_text(json.dumps(DEMO_USERS, indent=2))
    print(f"[iqms-chat seed] wrote {len(DEMO_USERS)} demo users to {USERS_FILE}")
