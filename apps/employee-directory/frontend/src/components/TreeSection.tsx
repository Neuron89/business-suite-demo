import type { ReactNode } from "react";
import { useId, useState } from "react";

type TreeSectionProps = {
  title: string;
  subtitle?: string;
  countLabel?: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

type TreeItemProps = {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function TreeSection({
  title,
  subtitle,
  countLabel,
  actions,
  defaultOpen = false,
  children,
}: TreeSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className={`tree-section${isOpen ? " is-open" : ""}`}>
      <div className="tree-section__header">
        <button
          type="button"
          className="tree-section__toggle"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="tree-section__chevron" aria-hidden />
          <span className="tree-section__labels">
            <span className="tree-section__title">{title}</span>
            {subtitle ? (
              <span className="tree-section__subtitle">{subtitle}</span>
            ) : null}
          </span>
          {countLabel ? (
            <span className="tree-section__count">{countLabel}</span>
          ) : null}
        </button>
        {actions ? (
          <div className="tree-section__actions">{actions}</div>
        ) : null}
      </div>
      <div
        className="tree-section__body"
        id={bodyId}
        aria-hidden={!isOpen}
      >
        <div className="tree-section__content">{children}</div>
      </div>
    </section>
  );
}

export function TreeItem({
  title,
  subtitle,
  badge,
  meta,
  defaultOpen = false,
  children,
}: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <article className={`tree-item${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="tree-item__toggle"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="tree-item__chevron" aria-hidden />
        <span className="tree-item__labels">
          <span className="tree-item__title">{title}</span>
          {subtitle ? (
            <span className="tree-item__subtitle">{subtitle}</span>
          ) : null}
        </span>
        <span className="tree-item__meta">
          {badge ? <span className="tree-item__badge">{badge}</span> : null}
          {meta}
        </span>
      </button>
      <div className="tree-item__body" id={bodyId} aria-hidden={!isOpen}>
        <div className="tree-item__content">{children}</div>
      </div>
    </article>
  );
}


