import os

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "qc-lab-dev-key-change-in-production")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(basedir, 'qc_lab.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    INTEGRATION_API_KEY = os.environ.get(
        "INTEGRATION_API_KEY", "complaint-tracker-integration-key-2024"
    )
    COMPLAINT_TRACKER_URL = os.environ.get("COMPLAINT_TRACKER_URL", "http://localhost:3000")
    MOC_URL = os.environ.get("MOC_URL", "http://localhost:3001")
