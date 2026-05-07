from __future__ import annotations

import os
import secrets
from typing import Any, Dict

import jwt
from flask import Blueprint, jsonify, redirect, request, session, current_app, url_for
from werkzeug.security import check_password_hash

auth_bp = Blueprint("auth", __name__)


def _set_admin_session(email: str, *, portal_role: str | None = None) -> None:
    """Mark the Flask session as authenticated for SSO arrivals.

    Employee Tech Doc currently checks `session['user']` to gate access. We
    write the email there. When the portal claim says the user is an admin
    we also set `session['portal_admin']` so future routes (or migration
    onto a real role table) can elevate privileges.
    """
    session.clear()
    session["user"] = email
    session["auth_method"] = "sso"
    if portal_role == "admin":
        session["portal_admin"] = True
    session.permanent = True


def handle_portal_sso(audience: str) -> Any:
    """Verify a portal-issued SSO token and set the Flask session.

    Registered as a top-level GET /sso in app factory (audience='employee_db'
    for Employee Tech Doc). Each Flask app calls this with its own audience
    string matching the portal's ModuleKey.
    """
    secret = os.environ.get("PORTAL_SSO_SECRET")
    if not secret:
        return ("SSO not configured.", 503)
    token = request.args.get("token") or request.args.get("ptoken")
    next_url = request.args.get("next") or "/"
    if not next_url.startswith("/"):
        next_url = "/"
    if not token:
        return ("Missing SSO token.", 400)
    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=audience,
            issuer="acme-portal",
        )
    except jwt.PyJWTError:
        return ("Invalid or expired SSO token.", 401)
    email = str(claims.get("email", "")).strip().lower()
    if not email:
        return ("SSO token missing email.", 400)
    _set_admin_session(email, portal_role=claims.get("portal_role"))
    return redirect(next_url)


def _verify_password(stored: str, provided: str) -> bool:
    if stored.startswith("pbkdf2:"):
        return check_password_hash(stored, provided)
    return secrets.compare_digest(stored, provided)


@auth_bp.route("/login", methods=["POST"])
def login() -> Any:
    payload = request.get_json(force=True, silent=True) or {}
    username = str(payload.get("username", "")).strip().lower()
    password = str(payload.get("password", ""))
    if not username or not password:
        return (
            jsonify({"error": "Username and password are required."}),
            400,
        )

    users: Dict[str, str] = current_app.config.get("ADMIN_USERS", {}) or {}
    stored = users.get(username)
    if not stored or not _verify_password(stored, password):
        return jsonify({"error": "Invalid credentials."}), 401

    session["user"] = username
    return jsonify({"status": "ok", "user": username})


@auth_bp.route("/me", methods=["GET"])
def current_user() -> Any:
    user = session.get("user")
    if not user:
        return jsonify({"error": "Not authenticated."}), 401
    return jsonify({"user": user})


@auth_bp.route("/logout", methods=["POST"])
def logout() -> Any:
    session.clear()
    return jsonify({"status": "ok"})


