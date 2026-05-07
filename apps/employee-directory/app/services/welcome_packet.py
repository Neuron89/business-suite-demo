from __future__ import annotations

import html
from datetime import date

from ..database import db
from ..models import (
    Employee,
    LifecycleEvent,
    LifecycleEventType,
    LifecycleTaskStatus,
    OrganizationSetting,
)


def get_org_settings_dict(company_id: int | None = None) -> dict[str, str]:
    query = OrganizationSetting.query
    if company_id is not None:
        query = query.filter_by(company_id=company_id)
    rows = query.all()
    return {row.setting_key: (row.setting_value or "") for row in rows}


def get_onboarding_event(employee: Employee) -> LifecycleEvent | None:
    return (
        LifecycleEvent.query.filter_by(
            employee_id=employee.id,
            event_type=LifecycleEventType.ONBOARDING,
        )
        .order_by(LifecycleEvent.created_at.desc())
        .first()
    )


def _extract_credentials(event: LifecycleEvent) -> list[dict[str, str]]:
    credentials: list[dict[str, str]] = []
    for task in event.tasks:
        if task.status != LifecycleTaskStatus.COMPLETED:
            continue
        if not task.notes:
            continue
        lower_notes = task.notes.lower()
        if any(
            kw in lower_notes
            for kw in ("password", "credential", "account created", "username")
        ):
            credentials.append(
                {
                    "task": task.description,
                    "notes": task.notes,
                }
            )
    return credentials


def _esc(value: str | None) -> str:
    return html.escape(value or "")


def _esc_or_dash(value: str | None) -> str:
    return html.escape(value) if value else "—"


def build_welcome_packet_html(employee: Employee, company_id: int | None = None) -> str:
    settings = get_org_settings_dict(company_id)
    event = get_onboarding_event(employee)
    credentials = _extract_credentials(event) if event else []

    company = _esc(settings.get("company_name") or "Our Company")
    first_name = _esc(employee.preferred_name or employee.first_name)
    full_name = _esc(employee.full_name)
    start = employee.start_date.isoformat() if employee.start_date else "—"

    # ── PANEL 1: COVER (top of page, becomes envelope-window face when folded) ──
    cover_html = f"""
      <div class="cover-eyebrow">Welcome to {company}</div>
      <div class="cover-window">
        <div class="cover-name">Welcome, {first_name}!</div>
      </div>
      <div class="cover-below">
        <div class="cover-sub">{full_name}</div>
        <div class="cover-meta">
          {_esc_or_dash(employee.title)} &middot; Start date {_esc_or_dash(start)}
        </div>
      </div>"""

    # ── PANEL 2: INITIAL LOGIN + ACCOUNT CREDS (middle panel) ──
    if employee.initial_password:
        login_html = f"""
        <div class="panel-title">Your First Sign-In</div>
        <table class="kv">
          <tr><td>Username</td><td><strong>{_esc(employee.email)}</strong></td></tr>
          <tr><td>Temporary Password</td><td><code class="pw">{_esc(employee.initial_password)}</code></td></tr>
        </table>
        <p class="muted">You'll be prompted to change this password the first time you sign in.</p>"""
    else:
        login_html = """
        <div class="panel-title">Your First Sign-In</div>
        <p class="muted">No initial password recorded. Contact IT.</p>"""

    creds_html = ""
    if credentials:
        rows = ""
        for cred in credentials:
            rows += (
                f"<tr><td>{_esc(cred['task'])}</td>"
                f"<td>{_esc(cred['notes'])}</td></tr>"
            )
        creds_html = f"""
        <div class="panel-subtitle">Other Account Credentials</div>
        <table class="kv">{rows}</table>"""

    # ── PANEL 3: SYSTEMS + WIFI + HELPDESK (bottom panel) ──
    url_keys = [
        ("sharepoint_url", "SharePoint"),
        ("erp_url", "ERP"),
        ("vpn_portal_url", "VPN Portal"),
        ("internal_wiki_url", "Internal Wiki"),
        ("helpdesk_url", "Helpdesk"),
    ]
    url_rows = ""
    for key, label in url_keys:
        val = settings.get(key, "")
        if val:
            url_rows += f"<tr><td>{_esc(label)}</td><td>{_esc(val)}</td></tr>"

    urls_html = ""
    if url_rows:
        urls_html = f"""
        <div class="panel-title">Systems</div>
        <table class="kv">{url_rows}</table>"""

    wifi_ssid = settings.get("wifi_ssid", "")
    wifi_pass = settings.get("wifi_password", "")
    wifi_html = ""
    if wifi_ssid:
        wifi_html = f"""
        <div class="panel-subtitle">WiFi</div>
        <table class="kv">
          <tr><td>Network</td><td>{_esc(wifi_ssid)}</td></tr>
          <tr><td>Password</td><td>{_esc_or_dash(wifi_pass)}</td></tr>
        </table>"""

    hd_email = settings.get("helpdesk_email", "")
    hd_phone = settings.get("helpdesk_phone", "")
    helpdesk_html = ""
    if hd_email or hd_phone:
        rows = ""
        if hd_email:
            rows += f"<tr><td>Email</td><td>{_esc(hd_email)}</td></tr>"
        if hd_phone:
            rows += f"<tr><td>Phone</td><td>{_esc(hd_phone)}</td></tr>"
        helpdesk_html = f"""
        <div class="panel-subtitle">IT Helpdesk</div>
        <table class="kv">{rows}</table>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Welcome Packet — {full_name}</title>
<style>
  /* ── Page setup: letter portrait, no margin so 3 panels of 3.667in each ── */
  @page {{ size: letter portrait; margin: 0; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #0f172a;
    font-size: 12pt;
    background: #f1f5f9;
  }}

  /* Toolbar (screen only) */
  .toolbar {{ background: #1e293b; color: #fff; padding: 12px 24px; text-align: center; position: sticky; top: 0; z-index: 10; }}
  .toolbar button {{ padding: 8px 24px; font-size: 14px; cursor: pointer; background: #f59e0b; color: #1e293b; border: none; border-radius: 4px; font-weight: 600; }}
  .toolbar p {{ margin: 6px 0 0; font-size: 12px; opacity: 0.85; }}
  @media print {{ .toolbar {{ display: none; }} body {{ background: #fff; }} }}

  /* The "page" — exactly letter-sized, three stacked panels */
  .page {{
    width: 8.5in;
    height: 11in;
    margin: 16px auto;
    background: #fff;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }}
  @media print {{ .page {{ margin: 0; box-shadow: none; }} }}

  .panel {{
    height: 3.667in;
    box-sizing: border-box;
    padding: 0.5in 0.6in;
    position: relative;
  }}

  /* Fold marks — short dashes at the very left/right edges only, no full
     line across the page. Just enough to find the fold by eye. */
  .fold {{
    height: 0;
    position: relative;
  }}
  .fold::before, .fold::after {{
    content: '';
    position: absolute;
    top: -1px;
    width: 0.3in;
    border-top: 1px dashed #94a3b8;
  }}
  .fold::before {{ left: 0; }}
  .fold::after {{ right: 0; }}

  /* ── Panel 1: cover (faces out / shows through envelope window) ── */
  .panel.cover {{
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    position: relative;  /* anchors absolute children below */
    border-bottom: 1px solid #e2e8f0;
  }}
  /* Decorative pieces above the window (absolute-positioned so the window
     block itself stays exactly where the envelope cutout lands). */
  .cover-eyebrow {{
    position: absolute;
    top: 0.5in;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 11pt;
    color: #b45309;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 600;
  }}
  .cover-below {{
    position: absolute;
    top: 1.1in;
    left: 0;
    right: 0;
    text-align: center;
  }}
  .cover-sub {{
    font-size: 13pt;
    color: #334155;
    font-weight: 500;
  }}
  .cover-meta {{
    margin-top: 4px;
    font-size: 10pt;
    color: #64748b;
  }}

  /* The actual envelope-window area — must land exactly here when folded.
     Envelope:   9" × 4"
     Window:     4.5" × 1" — positioned 1" from left, 0.5" up from bottom.
     Folded packet (3.67" tall) sits flush at bottom of envelope:
       window y on packet  = 0.5" to 1.5" from packet bottom
       window y on cover   = 3.67 - 1.5 = 2.17" from top of cover (top edge)
     If your fold puts the packet flush at top instead of bottom, change
     `top: 2.17in` to `top: 2in`. */
  .cover-window {{
    position: absolute;
    top: 2.17in;
    left: 1in;
    width: 4.5in;
    height: 1in;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.15in;
  }}
  .cover-name {{
    font-size: 22pt;
    font-weight: 700;
    line-height: 1;
    color: #0f172a;
    white-space: nowrap;
    text-align: center;
    letter-spacing: -0.01em;
  }}

  /* ── Panel 2: First sign-in (middle panel) ── */
  .panel.middle {{ background: #fff; }}
  .panel-title {{
    font-size: 16pt;
    font-weight: 700;
    color: #1e293b;
    border-bottom: 2px solid #f59e0b;
    padding-bottom: 6px;
    margin-bottom: 12px;
  }}
  .panel-subtitle {{
    font-size: 12pt;
    font-weight: 600;
    color: #334155;
    margin-top: 14px;
    margin-bottom: 6px;
  }}
  table.kv {{ width: 100%; border-collapse: collapse; }}
  table.kv td {{ padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-size: 11pt; }}
  table.kv td:first-child {{ width: 38%; color: #64748b; font-weight: 500; }}
  code.pw {{
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 14pt;
    background: #fef3c7;
    color: #78350f;
    padding: 2px 8px;
    border-radius: 3px;
    letter-spacing: 0.04em;
  }}
  .muted {{ color: #64748b; font-size: 9.5pt; margin: 6px 0 0; }}

  /* ── Panel 3: Systems / WiFi / Helpdesk (bottom panel) ── */
  .panel.bottom {{ background: #fff; }}
  .panel.bottom .col-2 {{ display: flex; gap: 16px; margin-top: 8px; }}
  .panel.bottom .col-2 > div {{ flex: 1; }}
</style>
</head>
<body>

<div class="toolbar">
  <button onclick="window.print()">Print Welcome Packet</button>
  <p>Print on letter paper, tri-fold along the dashed lines, insert into a #10 (9×4) window envelope with the cover panel facing out.</p>
</div>

<div class="page">

  <!-- ── PANEL 1: COVER (top third, shows through window) ── -->
  <div class="panel cover">
    {cover_html}
  </div>

  <div class="fold"></div>

  <!-- ── PANEL 2: First sign-in (middle third) ── -->
  <div class="panel middle">
    {login_html}
    {creds_html}
  </div>

  <div class="fold"></div>

  <!-- ── PANEL 3: Systems / WiFi / Helpdesk (bottom third) ── -->
  <div class="panel bottom">
    {urls_html}
    <div class="col-2">
      <div>{wifi_html}</div>
      <div>{helpdesk_html}</div>
    </div>
  </div>

</div>

</body>
</html>"""
