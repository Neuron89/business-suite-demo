/**
 * Microsoft 365 Graph — mail + calendar widgets.
 *
 * Reuses the same Acme Industries tenant credentials the Employee Tech Doc app uses
 * (GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET). Those are
 * application-level creds with admin consent — we authorize as a specific
 * user mailbox.
 */
import { ok, notConfigured, err, type WidgetEnvelope } from './types';

export interface MailMessage {
  id: string;
  subject: string;
  from: string;
  preview: string;
  received_at: string;
  is_read: boolean;
  web_link: string;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  location?: string | null;
  is_all_day: boolean;
  organizer?: string | null;
}

let cachedToken: { value: string; expires_at: number } | null = null;

async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at - Date.now() > 60_000) {
    return cachedToken.value;
  }
  const tenant = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const secret = process.env.GRAPH_CLIENT_SECRET;
  if (!tenant || !clientId || !secret) {
    throw new Error('GRAPH_* env vars not configured');
  }
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  });
  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!resp.ok) throw new Error(`graph token ${resp.status}: ${await resp.text()}`);
  const json = (await resp.json()) as any;
  cachedToken = {
    value: json.access_token,
    expires_at: Date.now() + (json.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

function targetMailbox(): string {
  return process.env.DASHBOARD_MAILBOX || process.env.SMTP_USER || 'demo.it@acme.demo';
}

export async function fetchInbox(): Promise<WidgetEnvelope<MailMessage[]>> {
  if (!process.env.GRAPH_TENANT_ID) {
    return notConfigured('Reuses Employee Tech Doc GRAPH_* creds. Add them to portal/.env.');
  }
  try {
    const token = await getGraphToken();
    const mailbox = targetMailbox();
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages?$top=8&$orderby=receivedDateTime desc&$select=id,subject,from,bodyPreview,receivedDateTime,isRead,webLink`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }
    );
    if (!resp.ok) return err(`Graph mail ${resp.status}: ${await resp.text()}`);
    const json = (await resp.json()) as any;
    const messages: MailMessage[] = (json.value || []).map((m: any) => ({
      id: m.id,
      subject: m.subject || '(no subject)',
      from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || 'unknown',
      preview: m.bodyPreview || '',
      received_at: m.receivedDateTime,
      is_read: !!m.isRead,
      web_link: m.webLink,
    }));
    return ok(messages);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function fetchCalendar(): Promise<WidgetEnvelope<CalendarEvent[]>> {
  if (!process.env.GRAPH_TENANT_ID) {
    return notConfigured('Reuses Employee Tech Doc GRAPH_* creds. Add them to portal/.env.');
  }
  try {
    const token = await getGraphToken();
    const mailbox = targetMailbox();

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 2); // today + tomorrow

    const url = new URL(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/calendarView`
    );
    url.searchParams.set('startDateTime', start.toISOString());
    url.searchParams.set('endDateTime', end.toISOString());
    url.searchParams.set('$top', '12');
    url.searchParams.set('$orderby', 'start/dateTime');
    url.searchParams.set(
      '$select',
      'id,subject,start,end,location,isAllDay,organizer'
    );

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="Eastern Standard Time"' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return err(`Graph calendar ${resp.status}: ${await resp.text()}`);
    const json = (await resp.json()) as any;
    const events: CalendarEvent[] = (json.value || []).map((e: any) => ({
      id: e.id,
      subject: e.subject || '(no subject)',
      start: e.start?.dateTime,
      end: e.end?.dateTime,
      location: e.location?.displayName || null,
      is_all_day: !!e.isAllDay,
      organizer: e.organizer?.emailAddress?.name || null,
    }));
    return ok(events);
  } catch (e) {
    return err((e as Error).message);
  }
}
