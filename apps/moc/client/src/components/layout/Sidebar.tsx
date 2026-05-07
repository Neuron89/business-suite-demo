'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth, isAdminUser } from '@/lib/auth-context';
import { ReactNode } from 'react';

function SvgIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      {children}
    </svg>
  );
}

const DashboardIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </SvgIcon>
);

const DocumentTextIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </SvgIcon>
);

const ChartBarIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </SvgIcon>
);

const ShieldCheckIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </SvgIcon>
);

const CogIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </SvgIcon>
);

const ClockIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </SvgIcon>
);

const CheckCircleIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </SvgIcon>
);

const ExclamationTriangleIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </SvgIcon>
);

const ClipboardListIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
  </SvgIcon>
);

const HourglassIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </SvgIcon>
);

const UsersIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </SvgIcon>
);

const TemplateIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
  </SvgIcon>
);

const TicketIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
  </SvgIcon>
);

const ArrowRepeatIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
  </SvgIcon>
);

const QuestionMarkIcon = () => (
  <SvgIcon>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
  </SvgIcon>
);

type NavIcon = () => React.ReactElement;

const ALL_ROLES = ['super_admin', 'admin', 'ehs', 'operations', 'qc', 'moc_manager', 'maintenance', 'it', 'product_manager', 'sales', 'management'];

const NAV_SECTIONS: { label: string; items: { href: string; label: string; icon: NavIcon; roles: string[]; badgeKey?: string }[] }[] = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: DashboardIcon, roles: ALL_ROLES },
      { href: '/moc', label: 'MOC Requests', icon: DocumentTextIcon, roles: ALL_ROLES, badgeKey: 'moc' },
      { href: '/action-items', label: 'My Action Items', icon: ClipboardListIcon, roles: ALL_ROLES },
      { href: '/ehs-incidents', label: 'EHS Incidents', icon: ExclamationTriangleIcon, roles: ['super_admin', 'admin', 'ehs', 'operations', 'qc', 'moc_manager', 'maintenance', 'it', 'management'] },
    ],
  },
  {
    label: 'Quick Filters',
    items: [
      { href: '/moc?exclude_status=closed,draft', label: 'All Open', icon: HourglassIcon, roles: ALL_ROLES },
      { href: '/moc?status=under_review', label: 'Under Review', icon: ArrowRepeatIcon, roles: ALL_ROLES },
      { href: '/moc?status=closed', label: 'Closed', icon: CheckCircleIcon, roles: ALL_ROLES },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/admin?tab=templates', label: 'Templates', icon: TemplateIcon, roles: ['super_admin', 'admin', 'moc_manager'] },
      { href: '/admin?tab=users', label: 'Manage Users', icon: UsersIcon, roles: ['super_admin', 'admin', 'moc_manager'] },
      { href: '/reports', label: 'Reports', icon: ChartBarIcon, roles: ['super_admin', 'admin', 'ehs', 'operations', 'moc_manager'] },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin?tab=system_requests', label: 'Tickets', icon: TicketIcon, roles: ['super_admin', 'admin', 'moc_manager'] },
      { href: '/audit', label: 'Audit Trail', icon: ShieldCheckIcon, roles: ['super_admin', 'admin', 'ehs', 'moc_manager'] },
    ],
  },
  {
    label: 'Testing',
    items: [
      { href: '/testing/risk-calculator', label: 'Risk Calculator', icon: ShieldCheckIcon, roles: ALL_ROLES },
      { href: '/testing/pssr', label: 'PSSR Checklist', icon: ClipboardListIcon, roles: ALL_ROLES },
      { href: '/testing/dsr', label: 'DSR Checklist', icon: DocumentTextIcon, roles: ALL_ROLES },
      { href: '/testing/scope-validation', label: 'Scope Validation', icon: ChartBarIcon, roles: ALL_ROLES },
    ],
  },
  {
    label: 'Help',
    items: [
      { href: '/help', label: 'How to Use', icon: QuestionMarkIcon, roles: ALL_ROLES },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[260px] flex flex-col z-50 transition-colors duration-300"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center font-extrabold text-sm flex-shrink-0"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
          M
        </div>
        <div className="text-white font-extrabold text-[1.1rem] tracking-tight">
          MOC<span style={{ color: 'var(--accent)' }} className="font-semibold">System</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => item.roles.includes(user.role) || (item.roles.some(r => ['super_admin', 'admin', 'moc_manager'].includes(r)) && isAdminUser(user)));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label}>
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] px-3 pt-4 pb-2"
                style={{ color: '#475569' }}
              >
                {section.label}
              </div>
              {visibleItems.map((item) => {
                const hasQuery = item.href.includes('?');
                let isActive: boolean;
                if (hasQuery) {
                  const [hrefPath, hrefSearch] = item.href.split('?');
                  const hrefParams = new URLSearchParams(hrefSearch);
                  isActive = pathname === hrefPath &&
                    Array.from(hrefParams.entries()).every(([k, v]) => searchParams.get(k) === v);
                } else {
                  isActive = (pathname === item.href || pathname.startsWith(item.href + '/')) &&
                    !searchParams.has('status') && !searchParams.has('exclude_status');
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      group relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[0.85rem] font-semibold
                      transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden
                      ${isActive
                        ? 'text-[var(--accent)]'
                        : 'text-[#94a3b8] hover:text-[#e2e8f0] hover:translate-x-0.5'
                      }
                    `}
                    style={{
                      background: isActive ? 'var(--sidebar-active)' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--sidebar-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = '';
                    }}
                  >
                    {/* Active indicator bar */}
                    <span
                      className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] origin-center ${
                        isActive ? 'scale-y-100' : 'scale-y-0'
                      }`}
                      style={{ background: 'var(--accent)' }}
                    />

                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                      <item.icon />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User card + logout */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors duration-200 cursor-default"
          style={{ background: 'var(--sidebar-hover)' }}
        >
          <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.8rem] font-semibold text-[#e2e8f0] truncate">{user.name}</div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              {user.role.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="mt-2 w-full text-left px-3 py-2 rounded-[10px] text-[0.8rem] font-semibold text-[#94a3b8] transition-all duration-200 hover:text-[#f87171]"
          style={{ background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
