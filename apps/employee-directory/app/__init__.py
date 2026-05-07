from pathlib import Path

from flask import Flask, jsonify, send_from_directory, session

from .config import Config
from .database import apply_schema_upgrades, db, seed_companies_and_settings
from .routes.assets import assets_bp
from .routes.automation import automation_bp
from .routes.directory import directory_bp
from .routes.directory_groups import directory_groups_bp
from .routes.distribution_groups import distribution_groups_bp
from .routes.employees import employees_bp
from .routes.provisioning_jobs import provisioning_jobs_bp
from .routes.subscriptions import subscriptions_bp
from .routes.auth import auth_bp, handle_portal_sso
from .routes.settings import settings_bp
from .services.cli import register_cli_commands
from .services.scheduler import init_scheduler

FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"


def create_app(config_class: type[Config] = Config) -> Flask:
    app = Flask(__name__, static_folder=str(FRONTEND_DIST / "assets"), static_url_path="/assets")
    app.config.from_object(config_class)

    db.init_app(app)

    with app.app_context():
        app.config["LOCAL_AD"] = config_class.LOCAL_AD
        app.config["ONBOARDING"] = config_class.ONBOARDING
        db.create_all()
        apply_schema_upgrades()
        seed_companies_and_settings()

    def require_auth():
        if session.get("user"):
            return None
        return jsonify({"error": "Authentication required."}), 401

    for protected_bp in (
        employees_bp,
        assets_bp,
        subscriptions_bp,
        directory_groups_bp,
        distribution_groups_bp,
        automation_bp,
        settings_bp,
        provisioning_jobs_bp,
    ):
        protected_bp.before_request(require_auth)

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(employees_bp, url_prefix="/api/employees")
    app.register_blueprint(assets_bp, url_prefix="/api/hardware")
    app.register_blueprint(subscriptions_bp, url_prefix="/api/subscriptions")
    app.register_blueprint(directory_groups_bp, url_prefix="/api/directory-groups")
    app.register_blueprint(distribution_groups_bp, url_prefix="/api/distribution-groups")
    app.register_blueprint(automation_bp, url_prefix="/api/automation")
    app.register_blueprint(settings_bp, url_prefix="/api/settings")
    app.register_blueprint(
        provisioning_jobs_bp, url_prefix="/api/provisioning-jobs"
    )
    # Directory API: read-only, gated by PORTAL_SERVICE_TOKEN. No session
    # cookie required — used by the unified portal and other internal services.
    app.register_blueprint(directory_bp, url_prefix="/api/directory")

    register_cli_commands(app)
    init_scheduler(app)

    @app.route("/api/health", methods=["GET"])
    def healthcheck():
        return jsonify({"status": "ok"}), 200

    @app.route("/sso", methods=["GET"])
    def sso_entry():
        # Portal SSO landing — see routes/auth.py:handle_portal_sso. Audience
        # 'employee_db' matches the portal's ModuleKey for this tile.
        return handle_portal_sso("employee_db")

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path: str):
        file = FRONTEND_DIST / path
        if path and file.is_file():
            return send_from_directory(str(FRONTEND_DIST), path)
        return send_from_directory(str(FRONTEND_DIST), "index.html")

    return app

