import { useEffect, useMemo, useState } from "react";

import {
  fetchDistributionGroup,
  fetchDistributionGroups,
} from "../api/distributionGroups";
import type {
  DistributionGroupActor,
  DistributionGroupDetail,
  DistributionGroupSummary,
  DistributionGroupType,
} from "../api/types";

const TYPE_LABEL: Record<DistributionGroupType, string> = {
  m365_unified: "M365 group",
  distribution: "Distribution list",
  mail_enabled_security: "Mail-enabled security",
};

const FLAG_LABEL: Record<string, { text: string; tone: "warn" | "info" }> = {
  empty: { text: "No members", tone: "warn" },
  all_terminated: { text: "All members terminated", tone: "warn" },
  has_terminated: { text: "Has terminated members", tone: "info" },
  has_external: { text: "Has external members", tone: "info" },
};

interface Props {
  companyId: number | null;
  onSelectEmployee: (employeeId: number) => void;
}

export default function DistributionGroupsView({
  companyId,
  onSelectEmployee,
}: Props) {
  const [groups, setGroups] = useState<DistributionGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DistributionGroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DistributionGroupType>("all");
  const [flagFilter, setFlagFilter] = useState<
    "all" | "empty" | "has_terminated" | "has_external"
  >("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDistributionGroups(companyId)
      .then((rows) => {
        if (!cancelled) setGroups(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load groups");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetchDistributionGroup(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load group detail");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return groups.filter((g) => {
      if (typeFilter !== "all" && g.group_type !== typeFilter) return false;
      if (flagFilter !== "all" && !g.flags.includes(flagFilter)) return false;
      if (!term) return true;
      return (
        g.display_name.toLowerCase().includes(term) ||
        (g.mail ?? "").toLowerCase().includes(term) ||
        (g.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [groups, searchTerm, typeFilter, flagFilter]);

  if (selectedId != null) {
    return (
      <DistributionGroupDetailView
        loading={detailLoading}
        detail={detail}
        onBack={() => setSelectedId(null)}
        onSelectEmployee={onSelectEmployee}
      />
    );
  }

  return (
    <div className="user-grid-view">
      <div className="user-grid-view__toolbar">
        <div className="user-grid-view__left">
          <input
            type="search"
            placeholder="Search groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="user-grid-view__search"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="user-grid-view__filter"
          >
            <option value="all">All types</option>
            <option value="m365_unified">M365 groups</option>
            <option value="distribution">Distribution lists</option>
            <option value="mail_enabled_security">Mail-enabled security</option>
          </select>
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value as typeof flagFilter)}
            className="user-grid-view__filter"
          >
            <option value="all">All groups</option>
            <option value="empty">Empty groups</option>
            <option value="has_terminated">Has terminated</option>
            <option value="has_external">Has external</option>
          </select>
        </div>
        <div className="user-grid-view__right">
          <span className="user-grid-view__summary">
            <strong>{filtered.length}</strong> / <strong>{groups.length}</strong> groups
          </span>
        </div>
      </div>

      {error ? <div className="error-banner"><p>{error}</p></div> : null}

      {loading && groups.length === 0 ? (
        <div className="user-grid-view__empty">Loading groups...</div>
      ) : filtered.length === 0 ? (
        <div className="user-grid-view__empty">
          {groups.length === 0
            ? "No distribution groups synced yet. Run a Microsoft 365 sync."
            : "No groups match your filter."}
        </div>
      ) : (
        <div className="user-list">
          <div className="user-list__header">
            <span className="user-list__col user-list__col--name">Name</span>
            <span className="user-list__col user-list__col--email">Email</span>
            <span className="user-list__col user-list__col--title">Type</span>
            <span className="user-list__col user-list__col--ext">Members</span>
            <span className="user-list__col user-list__col--phone">Flags</span>
            <span className="user-list__col user-list__col--status">Owners</span>
          </div>
          {filtered.map((g) => (
            <button
              key={g.id}
              className="user-list__row"
              onClick={() => setSelectedId(g.id)}
              type="button"
            >
              <span className="user-list__col user-list__col--name">
                <span className="user-list__name-text">{g.display_name}</span>
              </span>
              <span className="user-list__col user-list__col--email">
                {g.mail ?? <span className="user-list__muted">—</span>}
              </span>
              <span className="user-list__col user-list__col--title">
                {TYPE_LABEL[g.group_type]}
              </span>
              <span className="user-list__col user-list__col--ext">
                {g.member_count}
              </span>
              <span className="user-list__col user-list__col--phone">
                {g.flags.length === 0 ? (
                  <span className="user-list__muted">—</span>
                ) : (
                  g.flags.map((f) => (
                    <span
                      key={f}
                      className={`flag-chip flag-chip--${FLAG_LABEL[f]?.tone ?? "info"}`}
                    >
                      {FLAG_LABEL[f]?.text ?? f}
                    </span>
                  ))
                )}
              </span>
              <span className="user-list__col user-list__col--status">
                {g.owner_count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface DetailViewProps {
  loading: boolean;
  detail: DistributionGroupDetail | null;
  onBack: () => void;
  onSelectEmployee: (employeeId: number) => void;
}

function DistributionGroupDetailView({
  loading,
  detail,
  onBack,
  onSelectEmployee,
}: DetailViewProps) {
  if (loading || !detail) {
    return (
      <div className="user-detail-view">
        <button type="button" className="btn btn-secondary user-detail-view__back" onClick={onBack}>
          &larr; Back to Groups
        </button>
        <div className="user-grid-view__empty">Loading...</div>
      </div>
    );
  }
  return (
    <div className="user-detail-view">
      <button type="button" className="btn btn-secondary user-detail-view__back" onClick={onBack}>
        &larr; Back to Groups
      </button>
      <div className="layout-tabbed__hero">
        <div>
          <h2>{detail.display_name}</h2>
          <p>
            {TYPE_LABEL[detail.group_type]}
            {detail.mail ? ` · ${detail.mail}` : ""}
          </p>
          {detail.description ? <p>{detail.description}</p> : null}
          {detail.hidden_from_gal ? (
            <span className="flag-chip flag-chip--info">Hidden from GAL</span>
          ) : null}
        </div>
      </div>

      <div className="overview-panel__grid">
        <ActorList
          title={`Members (${detail.members.length})`}
          empty="No members"
          actors={detail.members}
          onSelectEmployee={onSelectEmployee}
        />
        <ActorList
          title={`Owners (${detail.owners.length})`}
          empty="No owners"
          actors={detail.owners}
          onSelectEmployee={onSelectEmployee}
        />
      </div>

      <div className="overview-panel__grid">
        <ActorList
          title={`Send on behalf (${detail.send_on_behalf.length})`}
          empty="Nobody delegated"
          actors={detail.send_on_behalf}
          onSelectEmployee={onSelectEmployee}
        />
        <div>
          <h3>Send-As</h3>
          <p className="user-list__muted" style={{ fontSize: "0.85rem" }}>
            {detail.send_as_note}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActorList({
  title,
  empty,
  actors,
  onSelectEmployee,
}: {
  title: string;
  empty: string;
  actors: DistributionGroupActor[];
  onSelectEmployee: (employeeId: number) => void;
}) {
  return (
    <div>
      <h3>{title}</h3>
      {actors.length === 0 ? (
        <p className="user-list__muted">{empty}</p>
      ) : (
        <ul className="actor-list">
          {actors.map((a, idx) => {
            const key = `${a.employee_id ?? a.email ?? idx}-${idx}`;
            const terminated = a.status === "terminated";
            return (
              <li key={key} className="actor-list__item">
                {a.employee_id != null ? (
                  <button
                    type="button"
                    className="actor-list__link"
                    onClick={() => onSelectEmployee(a.employee_id!)}
                  >
                    {a.display_name}
                  </button>
                ) : (
                  <span>{a.display_name}</span>
                )}
                <span className="user-list__muted">
                  {" "}
                  · {a.email ?? "no email"}
                </span>
                {a.external ? (
                  <span className="flag-chip flag-chip--info">External</span>
                ) : null}
                {terminated ? (
                  <span className="flag-chip flag-chip--warn">Terminated</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
