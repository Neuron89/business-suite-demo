/**
 * Home-page ticker banner.
 *
 * Merges three sources into a single ordered list:
 *   1. Active announcements (table: announcements, expires_at NULL or future)
 *   2. Birthdays in the next 7 days (from the directory API)
 *   3. Holidays in the next 14 days (table: holidays)
 *
 * The home page renders this as an auto-rotating ticker.
 */
import { Router } from 'express';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';
import { listEmployees } from '../services/directory';

const router = Router();

interface BannerItem {
  kind: 'announcement' | 'birthday' | 'holiday';
  title: string;
  subtitle?: string;
  date?: string; // YYYY-MM-DD
  severity?: 'info' | 'warning' | 'critical';
  /** For sorting only — items with closer/sooner dates come first. */
  sort_key: string;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextOccurrence(monthDay: string, today: Date): Date {
  // monthDay is "MM-DD"
  const [mm, dd] = monthDay.split('-').map(Number);
  const thisYear = new Date(today.getFullYear(), mm - 1, dd);
  if (thisYear >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    return thisYear;
  }
  return new Date(today.getFullYear() + 1, mm - 1, dd);
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86_400_000);
}

router.get('/', authenticate, async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items: BannerItem[] = [];

  // --- Announcements ---
  try {
    const rows = await db('announcements')
      .where((qb) => {
        qb.whereNull('expires_at').orWhere('expires_at', '>', db.fn.now());
      })
      .orderBy('pinned', 'desc')
      .orderBy('created_at', 'desc')
      .limit(20);
    for (const r of rows) {
      items.push({
        kind: 'announcement',
        title: r.title,
        subtitle: r.body?.slice(0, 200),
        severity: r.pinned ? 'warning' : 'info',
        sort_key: r.pinned ? '0' : '1',
      });
    }
  } catch (err) {
    console.error('[banner] announcements error:', err);
  }

  // --- Birthdays (next 7 days) ---
  try {
    const employees = await listEmployees();
    for (const emp of employees) {
      const bday = (emp as any).birthday as string | null | undefined;
      if (!bday) continue;
      const md = bday.slice(5, 10); // "MM-DD"
      const next = nextOccurrence(md, today);
      const diff = daysBetween(today, next);
      if (diff < 0 || diff > 7) continue;
      const label =
        diff === 0
          ? `🎂 ${emp.preferred_name || emp.first_name}'s birthday is today!`
          : diff === 1
            ? `🎂 ${emp.preferred_name || emp.first_name}'s birthday is tomorrow`
            : `🎂 ${emp.preferred_name || emp.first_name}'s birthday is in ${diff} days`;
      items.push({
        kind: 'birthday',
        title: label,
        subtitle: emp.department || undefined,
        date: fmtDate(next),
        severity: 'info',
        sort_key: `2-${diff.toString().padStart(2, '0')}`,
      });
    }
  } catch (err) {
    console.error('[banner] birthdays error:', err);
  }

  // --- Holidays (next 14 days) ---
  try {
    const upper = new Date(today);
    upper.setDate(upper.getDate() + 14);
    const rows = await db('holidays')
      .where('date', '>=', fmtDate(today))
      .andWhere('date', '<=', fmtDate(upper))
      .orderBy('date', 'asc');
    for (const r of rows) {
      const d = new Date(r.date);
      const diff = daysBetween(today, d);
      const when =
        diff === 0
          ? 'today'
          : diff === 1
            ? 'tomorrow'
            : `in ${diff} days`;
      items.push({
        kind: 'holiday',
        title: `🗓️ ${r.name} — ${when}`,
        subtitle: r.kind === 'federal' ? 'Federal holiday' : 'Company holiday',
        date: typeof r.date === 'string' ? r.date.slice(0, 10) : fmtDate(d),
        severity: 'info',
        sort_key: `3-${diff.toString().padStart(2, '0')}`,
      });
    }
  } catch (err) {
    console.error('[banner] holidays error:', err);
  }

  items.sort((a, b) => a.sort_key.localeCompare(b.sort_key));
  res.json({ items: items.map(({ sort_key: _s, ...rest }) => rest) });
});

export default router;
