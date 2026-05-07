'use client';

import { useEffect, useRef, useState } from 'react';
import { getBanner, type BannerItem } from '@/lib/api';

const ROTATE_MS = 6000;

const KIND_ICON: Record<BannerItem['kind'], string> = {
  announcement: '📣',
  birthday: '🎂',
  holiday: '🗓️',
};

const SEVERITY_BG: Record<NonNullable<BannerItem['severity']>, string> = {
  info: 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
  warning: 'bg-orange-100 dark:bg-orange-900/40 border-orange-400 dark:border-orange-600',
  critical: 'bg-red-100 dark:bg-red-900/40 border-red-500',
};

const SEVERITY_BAR: Record<NonNullable<BannerItem['severity']>, string> = {
  info: 'bg-amber-500',
  warning: 'bg-orange-500',
  critical: 'bg-red-500',
};

export default function Banner({ token }: { token: string }) {
  const [items, setItems] = useState<BannerItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBanner(token)
      .then((r) => {
        if (!cancelled) setItems(r.items || []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, items.length, idx]);

  if (items.length === 0) return null;
  const cur = items[idx];
  const sev = cur.severity || 'info';

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`relative rounded-lg border-l-4 p-3 pb-4 flex items-start gap-3 transition-colors overflow-hidden ${SEVERITY_BG[sev]}`}
    >
      <span className="text-2xl shrink-0" aria-hidden>
        {KIND_ICON[cur.kind]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-theme-primary truncate">{cur.title}</p>
        {cur.subtitle && (
          <p className="text-xs text-theme-muted truncate mt-0.5">{cur.subtitle}</p>
        )}
      </div>
      {items.length > 1 && (
        <div className="flex items-center gap-1 shrink-0">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show item ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 w-4 rounded-full transition-colors ${
                i === idx ? 'bg-amber-600' : 'bg-amber-300/50 dark:bg-amber-700/50'
              }`}
            />
          ))}
        </div>
      )}
      {items.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/5">
          <div
            key={`${idx}-${paused}`}
            className={`h-full origin-left ${SEVERITY_BAR[sev]}`}
            style={{
              animation: `banner-progress ${ROTATE_MS}ms linear forwards`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          />
        </div>
      )}
    </div>
  );
}
