from __future__ import annotations

from ..models import Employee, LifecycleTaskStatus
from .welcome_packet import get_onboarding_event, get_org_settings_dict, _extract_credentials


def generate_manager_email(employee: Employee, company_id: int | None = None) -> str:
    settings = get_org_settings_dict(company_id)
    event = get_onboarding_event(employee)
    company = settings.get("company_name") or "Our Company"

    start = employee.start_date.isoformat() if employee.start_date else "TBD"

    # Completed tasks summary
    completed_tasks = []
    if event:
        for task in event.tasks:
            if task.status == LifecycleTaskStatus.COMPLETED:
                completed_tasks.append(task.description)

    tasks_text = ""
    if completed_tasks:
        tasks_text = "\n".join(f"  - {t}" for t in completed_tasks)
    else:
        tasks_text = "  (No tasks completed yet)"

    # Credentials
    credentials = _extract_credentials(event) if event else []
    creds_text = ""
    if credentials:
        creds_lines = []
        for cred in credentials:
            creds_lines.append(f"  {cred['task']}:")
            creds_lines.append(f"    {cred['notes']}")
        creds_text = "\n".join(creds_lines)
    else:
        creds_text = "  No credential information recorded."

    # System URLs
    url_keys = [
        ("sharepoint_url", "SharePoint"),
        ("erp_url", "ERP"),
        ("vpn_portal_url", "VPN Portal"),
        ("internal_wiki_url", "Internal Wiki"),
    ]
    urls_text = ""
    for key, label in url_keys:
        val = settings.get(key, "")
        urls_text += f"  {label}: {val or 'N/A'}\n"

    notes_text = ""
    if event and event.notes:
        notes_text = f"\nAdditional Notes:\n  {event.notes}\n"

    return f"""Subject: Onboarding Summary — {employee.full_name}

Hi,

This is a summary of the onboarding setup completed for {employee.full_name} at {company}.

Employee Details:
  Name: {employee.full_name}
  Email: {employee.email}
  Department: {employee.department or 'N/A'}
  Title: {employee.title or 'N/A'}
  Start Date: {start}

What Was Set Up:
{tasks_text}

Credentials:
{creds_text}

Key System URLs:
{urls_text}{notes_text}
Please share relevant credentials and access info with the new employee on their first day.

Thank you,
IT Department"""


def generate_announcement_email(employee: Employee, company_id: int | None = None) -> str:
    settings = get_org_settings_dict(company_id)
    company = settings.get("company_name") or "Our Company"

    start = employee.start_date.isoformat() if employee.start_date else "soon"
    dept = employee.department or "the team"
    title = employee.title or "a new role"

    return f"""Subject: Welcome {employee.full_name} to {company}!

Hi everyone,

Please join me in welcoming {employee.full_name}, who is joining {dept} as {title} starting {start}.

{employee.preferred_name or employee.first_name} can be reached at {employee.email}.

Please take a moment to introduce yourself and help make {employee.preferred_name or employee.first_name} feel welcome!

Best regards,
IT Department"""
