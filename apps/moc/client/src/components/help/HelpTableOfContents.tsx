'use client';

interface TocItem {
  id: string;
  number: number;
  title: string;
}

interface HelpTableOfContentsProps {
  items: TocItem[];
  activeId: string;
}

export default function HelpTableOfContents({ items, activeId }: HelpTableOfContentsProps) {
  return (
    <nav className="space-y-1">
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-theme-faint mb-3">
        Contents
      </div>
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`
              flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.8rem] font-semibold transition-all duration-200
              ${isActive
                ? 'text-[var(--accent)] bg-amber-500/10'
                : 'text-theme-muted hover:text-theme-primary hover:bg-page'
              }
            `}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0 transition-colors duration-200 ${
                isActive
                  ? 'bg-amber-500 text-[var(--accent-text)]'
                  : 'bg-gray-200 dark:bg-gray-700 text-theme-muted'
              }`}
            >
              {item.number}
            </span>
            <span className="truncate">{item.title}</span>
          </a>
        );
      })}
    </nav>
  );
}
