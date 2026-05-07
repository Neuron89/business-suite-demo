import type { NavView, Company } from "../api/types";
import type { ReactNode } from "react";

interface Props {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
  companies: Company[];
  selectedCompanyId: number | null;
  onCompanyChange: (id: number) => void;
  currentUser: string | null;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onSettings: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

function SvgIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const UsersIcon = () => (
  <SvgIcon>
    <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </SvgIcon>
);

const HardwareIcon = () => (
  <SvgIcon>
    <path d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
  </SvgIcon>
);

const SoftwareIcon = () => (
  <SvgIcon>
    <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  </SvgIcon>
);

const DevicesIcon = () => (
  <SvgIcon>
    <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </SvgIcon>
);

const LicensesIcon = () => (
  <SvgIcon>
    <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </SvgIcon>
);

const GroupsIcon = () => (
  <SvgIcon>
    <path d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </SvgIcon>
);

const AccessIcon = () => (
  <SvgIcon>
    <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </SvgIcon>
);

const RefreshIcon = () => (
  <SvgIcon>
    <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
  </SvgIcon>
);

const SettingsIcon = () => (
  <SvgIcon>
    <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </SvgIcon>
);

const SunIcon = () => (
  <SvgIcon>
    <path d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
  </SvgIcon>
);

const MoonIcon = () => (
  <SvgIcon>
    <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
  </SvgIcon>
);

const LogoutIcon = () => (
  <SvgIcon>
    <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  </SvgIcon>
);

const JobsIcon = () => (
  <SvgIcon>
    <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </SvgIcon>
);

type NavIcon = () => React.ReactElement;

const NAV_ITEMS: { view: NavView; label: string; icon: NavIcon }[] = [
  { view: "users", label: "Users", icon: UsersIcon },
  { view: "hardware", label: "Hardware", icon: HardwareIcon },
  { view: "subscriptions", label: "Software", icon: SoftwareIcon },
  { view: "devices", label: "Devices", icon: DevicesIcon },
  { view: "licenses", label: "Licenses", icon: LicensesIcon },
  { view: "directory-groups", label: "Groups", icon: GroupsIcon },
  { view: "distribution-groups", label: "Dist. Lists", icon: GroupsIcon },
  { view: "access-policies", label: "Access", icon: AccessIcon },
  { view: "jobs", label: "Jobs", icon: JobsIcon },
];

export default function NavSidebar({
  activeView,
  onViewChange,
  companies,
  selectedCompanyId,
  onCompanyChange,
  currentUser,
  isDark,
  onToggleTheme,
  onLogout,
  onSettings,
  onRefresh,
  refreshing,
}: Props) {
  const initials = (currentUser ?? "?")
    .split("@")[0]
    .split(/[._\s-]+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const displayName = (currentUser ?? "").split("@")[0] || "User";

  return (
    <nav className="nav-sidebar">
      <div className="nav-sidebar__brand">
        <div className="nav-sidebar__brand-mark">N</div>
        <div className="nav-sidebar__brand-text">
          Acme Industries Employee<span className="nav-sidebar__brand-accent">Database</span>
        </div>
      </div>

      <div className="nav-sidebar__section">
        <div className="nav-sidebar__section-label">Navigation</div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              className={`nav-sidebar__item${isActive ? " is-active" : ""}`}
              onClick={() => onViewChange(item.view)}
              type="button"
            >
              <span className="nav-sidebar__active-bar" aria-hidden="true" />
              <span className="nav-sidebar__icon">
                <Icon />
              </span>
              <span className="nav-sidebar__label">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="nav-sidebar__section">
        <div className="nav-sidebar__section-label">Tools</div>
        <button
          className="nav-sidebar__item"
          onClick={onRefresh}
          disabled={refreshing}
          type="button"
        >
          <span className="nav-sidebar__active-bar" aria-hidden="true" />
          <span className="nav-sidebar__icon">
            <RefreshIcon />
          </span>
          <span className="nav-sidebar__label">
            {refreshing ? "Syncing…" : "Sync All"}
          </span>
        </button>
        <button
          className="nav-sidebar__item"
          onClick={onToggleTheme}
          type="button"
        >
          <span className="nav-sidebar__active-bar" aria-hidden="true" />
          <span className="nav-sidebar__icon">
            {isDark ? <SunIcon /> : <MoonIcon />}
          </span>
          <span className="nav-sidebar__label">
            {isDark ? "Light mode" : "Dark mode"}
          </span>
        </button>
        <button
          className="nav-sidebar__item"
          onClick={onSettings}
          type="button"
        >
          <span className="nav-sidebar__active-bar" aria-hidden="true" />
          <span className="nav-sidebar__icon">
            <SettingsIcon />
          </span>
          <span className="nav-sidebar__label">Settings</span>
        </button>
      </div>

      <div className="nav-sidebar__footer">
        <div className="nav-sidebar__user-card">
          <div className="nav-sidebar__user-avatar">{initials}</div>
          <div className="nav-sidebar__user-meta">
            <div className="nav-sidebar__user-name" title={currentUser ?? ""}>
              {displayName}
            </div>
            <div className="nav-sidebar__user-role">Signed in</div>
          </div>
        </div>
        <button
          className="nav-sidebar__logout"
          onClick={onLogout}
          type="button"
        >
          <span className="nav-sidebar__icon">
            <LogoutIcon />
          </span>
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
