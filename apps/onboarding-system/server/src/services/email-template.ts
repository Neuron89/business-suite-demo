/**
 * Shared HTML layout for onboarding notification emails.
 *
 * Email clients (Outlook especially) only reliably support table-based layout
 * + inline styles — no flexbox/grid/external CSS. Everything here is built to
 * that constraint so the emails render consistently.
 */

const BRAND = '#2563eb'; // accent (blue)
const INK = '#0f172a';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const PAGE_BG = '#f1f5f9';

export interface EmailRow {
  label: string;
  value: string;
}

export interface RenderOpts {
  title: string;
  intro?: string; // HTML allowed
  statusLabel?: string; // small pill shown in the header
  rows?: EmailRow[]; // a labeled details table
  note?: { label?: string; body: string }; // a quoted note block (comments, pings, etc.)
  ctaUrl?: string;
  ctaLabel?: string;
  accent?: string; // override the accent color
  preheader?: string; // hidden inbox-preview text
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderEmail(o: RenderOpts): string {
  const accent = o.accent || BRAND;

  const statusPill = o.statusLabel
    ? `<span style="display:inline-block;margin-left:10px;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,0.18);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;vertical-align:middle;">${esc(o.statusLabel)}</span>`
    : '';

  const rows = (o.rows || []).filter((r) => r.value !== undefined && r.value !== null && String(r.value).trim() !== '');
  const rowsHtml = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;border-top:1px solid ${BORDER};">
        ${rows
          .map(
            (r) => `<tr>
          <td style="padding:9px 0;border-bottom:1px solid ${BORDER};color:${MUTED};font-size:13px;width:40%;vertical-align:top;">${esc(r.label)}</td>
          <td style="padding:9px 0;border-bottom:1px solid ${BORDER};color:${INK};font-size:14px;font-weight:600;">${esc(r.value)}</td>
        </tr>`,
          )
          .join('')}
      </table>`
    : '';

  const noteHtml = o.note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
        <tr><td style="background:#f8fafc;border-left:4px solid ${accent};border-radius:6px;padding:12px 16px;">
          ${o.note.label ? `<div style="font-size:12px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">${esc(o.note.label)}</div>` : ''}
          <div style="font-size:14px;color:${INK};line-height:1.55;white-space:pre-wrap;">${esc(o.note.body)}</div>
        </td></tr>
      </table>`
    : '';

  const ctaHtml = o.ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;">
        <tr><td style="border-radius:8px;background:${accent};">
          <a href="${o.ctaUrl}" style="display:inline-block;padding:12px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(o.ctaLabel || 'Open ticket')}</a>
        </td></tr>
      </table>`
    : '';

  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${esc(o.preheader)}</div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAGE_BG};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <tr><td style="background:${accent};padding:18px 28px;">
        <span style="color:#ffffff;font-size:16px;font-weight:800;letter-spacing:.02em;">NYCOA&nbsp;Onboarding</span>${statusPill}
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 10px;font-size:20px;line-height:1.3;color:${INK};font-weight:800;">${esc(o.title)}</h1>
        ${o.intro ? `<p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">${o.intro}</p>` : ''}
        ${rowsHtml}
        ${noteHtml}
        ${ctaHtml}
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid ${BORDER};background:#f8fafc;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">Automated message from the NYCOA Onboarding system. Please don't reply directly to this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
