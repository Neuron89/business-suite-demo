from __future__ import annotations

import click
from flask import current_app

from ..database import db
from ..models import Employee, LifecycleEventType
from .lifecycle import create_lifecycle_event
from .m365_sync import M365CredentialsError, M365SyncError, M365SyncService
from .reporting import export_asset_snapshot


def register_cli_commands(app) -> None:
    @app.cli.command("init-db")
    def init_db_command():
        """Create all database tables."""
        db.create_all()
        click.echo("Database tables ensured.")

    @app.cli.command("sync-m365")
    def sync_m365_command():
        """Pull the latest Microsoft 365 users, devices, and licenses."""
        try:
            service = M365SyncService()
            stats = service.sync_directory()
        except M365CredentialsError as exc:
            raise click.ClickException(str(exc)) from exc
        except M365SyncError as exc:
            raise click.ClickException(f"M365 sync failed: {exc}") from exc
        else:
            click.echo(f"Sync completed: {stats}")

    @app.cli.command("onboard")
    @click.argument("email")
    @click.option("--initiated-by", default=None, help="Name or email of the requester.")
    @click.option(
        "--scheduled-for",
        default=None,
        help="Optional onboarding date (YYYY-MM-DD).",
    )
    @click.option("--notes", default=None, help="Additional onboarding notes.")
    def onboard_command(email, initiated_by, scheduled_for, notes):
        """Create onboarding tasks for an employee."""
        employee = Employee.query.filter_by(email=email).one_or_none()
        if not employee:
            raise click.ClickException(f"Employee with email '{email}' not found.")

        scheduled_date = None
        if scheduled_for:
            try:
                scheduled_date = click.DateTime(["%Y-%m-%d"]).convert(
                    scheduled_for, param=None, ctx=None
                ).date()
            except click.BadParameter as exc:
                raise click.ClickException(str(exc)) from exc

        event = create_lifecycle_event(
            employee=employee,
            event_type=LifecycleEventType.ONBOARDING,
            initiated_by=initiated_by,
            scheduled_for=scheduled_date,
            notes=notes,
        )
        click.echo(f"Onboarding event {event.id} created for {employee.email}.")

    @app.cli.command("offboard")
    @click.argument("email")
    @click.option("--initiated-by", default=None, help="Name or email of the requester.")
    @click.option(
        "--scheduled-for",
        default=None,
        help="Optional offboarding date (YYYY-MM-DD).",
    )
    @click.option("--notes", default=None, help="Additional offboarding notes.")
    def offboard_command(email, initiated_by, scheduled_for, notes):
        """Create offboarding tasks for an employee."""
        employee = Employee.query.filter_by(email=email).one_or_none()
        if not employee:
            raise click.ClickException(f"Employee with email '{email}' not found.")

        scheduled_date = None
        if scheduled_for:
            try:
                scheduled_date = click.DateTime(["%Y-%m-%d"]).convert(
                    scheduled_for, param=None, ctx=None
                ).date()
            except click.BadParameter as exc:
                raise click.ClickException(str(exc)) from exc

        event = create_lifecycle_event(
            employee=employee,
            event_type=LifecycleEventType.OFFBOARDING,
            initiated_by=initiated_by,
            scheduled_for=scheduled_date,
            notes=notes,
        )
        click.echo(f"Offboarding event {event.id} created for {employee.email}.")

    @app.cli.command("export-excel")
    def export_excel_command():
        """Generate an Excel workbook snapshot of the asset inventory."""
        path = export_asset_snapshot()
        click.echo(f"Export created at {path}")

