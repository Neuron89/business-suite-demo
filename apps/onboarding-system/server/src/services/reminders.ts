/**
 * Start-date reminder scheduler. Runs in-process: on boot and every 6 hours,
 * scans completed onboarding tickets and emails reminders at the configured
 * day-offsets before the manager-set start date. Dedups via
 * onboarding_details.reminders_sent so a given offset only fires once.
 */
import db from '../db/connection';
import { notifyStartReminder } from './email';

const OFFSETS = (process.env.REMINDER_OFFSETS || '7,3,1')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => !Number.isNaN(n));
const SIX_HOURS = 6 * 60 * 60 * 1000;

function daysUntil(dateStr: string): number | null {
  // Parse a YYYY-MM-DD date as LOCAL midnight. (new Date('2026-06-05') parses
  // as UTC midnight, which reads back a day earlier in negative-offset zones
  // like EDT — an off-by-one that would fire reminders on the wrong day.)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  let target: Date;
  if (m) {
    target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  } else {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export async function reminderTick(): Promise<void> {
  try {
    const tickets = await db('tickets').where({ status: 'completed', request_type: 'onboarding' });
    for (const t of tickets) {
      const od = typeof t.onboarding_details === 'string'
        ? JSON.parse(t.onboarding_details)
        : (t.onboarding_details || {});
      const start = od.start_date;
      if (!start) continue;
      const d = daysUntil(start);
      if (d === null || d < 0) continue;
      const sent: number[] = Array.isArray(od.reminders_sent) ? od.reminders_sent.slice() : [];
      let changed = false;
      for (const off of OFFSETS) {
        if (d === off && !sent.includes(off)) {
          await notifyStartReminder(
            { id: t.id, request_number: t.request_number, title: t.title, onboarding_details: od, requester_id: t.requester_id, manager_id: t.manager_id },
            off,
          );
          sent.push(off);
          changed = true;
        }
      }
      if (changed) {
        await db('tickets').where({ id: t.id }).update({ onboarding_details: JSON.stringify({ ...od, reminders_sent: sent }) });
      }
    }
  } catch (err: any) {
    console.error('[reminders] tick failed:', err?.message || err);
  }
}

export function startReminderScheduler(): void {
  console.log('[reminders] scheduler started; offsets =', OFFSETS);
  void reminderTick();
  setInterval(() => void reminderTick(), SIX_HOURS);
}
