'use client';

/**
 * "[← Portal]" chip — sits at the top of the sidebar (desktop) or in the
 * mobile top bar. Clicking returns the user to the NYCOA Portal.
 *
 * The portal URL comes from NEXT_PUBLIC_PORTAL_URL. If unset (local dev
 * with no portal running) the component renders nothing, so we don't
 * dangle a broken link.
 *
 * The compact prop renders just the icon (mobile top bar use). Default
 * is the full "[← Portal]" chip with label.
 */
type Props = {
  /** Render only the back-arrow icon (no "Portal" text). For mobile top bars. */
  compact?: boolean;
  /** Override the portal URL (rare — usually leave undefined). */
  href?: string;
  className?: string;
};

export default function PortalBackLink({ compact = false, href, className = '' }: Props) {
  const portalUrl = href ?? process.env.NEXT_PUBLIC_PORTAL_URL;
  if (!portalUrl) return null;

  const Icon = (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );

  if (compact) {
    return (
      <a
        href={portalUrl}
        title="Back to NYCOA Portal"
        className={`inline-flex items-center justify-center w-9 h-9 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition ${className}`}
      >
        {Icon}
      </a>
    );
  }

  return (
    <a
      href={portalUrl}
      title="Back to NYCOA Portal"
      className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-white/70 hover:text-white border border-white/10 hover:border-white/25 bg-white/[0.04] hover:bg-white/[0.08] transition ${className}`}
    >
      <span className="transition-transform group-hover:-translate-x-0.5">{Icon}</span>
      <span>Portal</span>
    </a>
  );
}
