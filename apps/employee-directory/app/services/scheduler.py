"""Background scheduler for nightly full sync.

Runs inside the Flask process via APScheduler's BackgroundScheduler.
Guards against double-starts when running under a multi-process server
(gunicorn/waitress with multiple workers) by checking an env flag and
relying on the 'main reloader' pid trick for dev mode.
"""
from __future__ import annotations

import os

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from flask import Flask

from .full_sync import run_full_sync

_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler | None:
    return _scheduler


def _nightly_job(app: Flask) -> None:
    with app.app_context():
        app.logger.info("Nightly full sync starting")
        try:
            stats = run_full_sync()
            app.logger.info("Nightly full sync complete: %s", stats)
        except Exception:
            app.logger.exception("Nightly full sync crashed")


def init_scheduler(app: Flask) -> None:
    """Start the scheduler once. Idempotent.

    Skipped entirely when SYNC_SCHEDULER_ENABLED=0 or when running under
    Flask's auto-reloader child process.
    """
    global _scheduler
    if _scheduler is not None:
        return
    if os.environ.get("DEMO_MODE", "false").lower() == "true":
        app.logger.info("Sync scheduler disabled in demo mode")
        return
    if os.environ.get("SYNC_SCHEDULER_ENABLED", "1") == "0":
        app.logger.info("Sync scheduler disabled by env")
        return
    # Flask debug reloader forks; only start in the reloader parent.
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        pass  # inside reloader main — proceed
    elif app.debug and os.environ.get("WERKZEUG_RUN_MAIN") is None:
        return  # reloader parent, skip; child will start it

    cron_hour = int(os.environ.get("SYNC_CRON_HOUR", "3"))
    cron_minute = int(os.environ.get("SYNC_CRON_MINUTE", "0"))

    _scheduler = BackgroundScheduler(timezone=os.environ.get("TZ", "America/New_York"))
    _scheduler.add_job(
        _nightly_job,
        CronTrigger(hour=cron_hour, minute=cron_minute),
        args=[app],
        id="nightly_full_sync",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    _scheduler.start()
    app.logger.info(
        "Sync scheduler started — nightly full sync at %02d:%02d (%s)",
        cron_hour, cron_minute, _scheduler.timezone,
    )

    # Attach the provisioning queue worker to the same scheduler instance.
    from .provisioning_queue import init_provisioning_worker

    init_provisioning_worker(app, _scheduler)
