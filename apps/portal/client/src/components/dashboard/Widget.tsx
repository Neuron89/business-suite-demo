'use client';

import type { ReactNode } from 'react';
import type { WidgetEnvelope } from '@/lib/dashboard-types';

interface WidgetProps {
  title: string;
  /** Optional small icon glyph (1 character) shown next to the title. */
  glyph?: string;
  /** Optional accent color (any css color). */
  color?: string;
  /** Right-side header element (counter badges, action button, etc.). */
  rightSlot?: ReactNode;
  /** Tailwind grid span — defaults to 1 column. */
  span?: string;
  /** Standard envelope. If null, the widget is "loading". */
  envelope?: WidgetEnvelope<any> | null;
  children: ReactNode;
}

export default function Widget({
  title,
  glyph,
  color = '#f59e0b',
  rightSlot,
  span = 'col-span-1',
  envelope,
  children,
}: WidgetProps) {
  const state = envelope?.state ?? 'ok';

  return (
    <section
      className={`dashboard-widget rounded-2xl bg-[#0f172a]/80 border border-white/5 backdrop-blur p-5 flex flex-col ${span}`}
      style={{ minHeight: '180px' }}
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {glyph && (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-base flex-shrink-0"
              style={{ background: `${color}33`, color }}
            >
              {glyph}
            </div>
          )}
          <h2 className="text-lg font-extrabold text-white tracking-tight truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">{rightSlot}</div>
      </header>

      {!envelope ? (
        <div className="text-sm text-slate-500 animate-pulse">Loading…</div>
      ) : state === 'not_configured' ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-amber-200 text-sm">
          <p className="font-bold mb-1">Configure me</p>
          <p className="text-amber-200/70">{envelope.message}</p>
        </div>
      ) : state === 'error' ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-red-200 text-sm">
          <p className="font-bold mb-1">Upstream error</p>
          <p className="text-red-200/70">{envelope.message}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">{children}</div>
      )}
    </section>
  );
}
