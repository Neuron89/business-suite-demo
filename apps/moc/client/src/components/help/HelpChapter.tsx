'use client';

import { ReactNode } from 'react';

interface HelpChapterProps {
  id: string;
  number: number;
  title: string;
  children: ReactNode;
}

export default function HelpChapter({ id, number, title, children }: HelpChapterProps) {
  return (
    <section id={id} className="scroll-mt-24 mb-16">
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold flex-shrink-0"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
          {number}
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-theme-primary">
          {title}
        </h2>
      </div>
      <div className="space-y-6 pl-14">
        {children}
      </div>
    </section>
  );
}
