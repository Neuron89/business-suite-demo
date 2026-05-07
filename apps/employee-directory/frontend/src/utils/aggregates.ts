import type { EmployeeRecord, UnifiDoor, UnifiSchedule } from "../api/types";

export interface Member {
  employee_id: number;
  employee_name: string;
  employee_email: string;
  employee_department: string | null;
  employee_status: string;
}

export interface GroupAggregate {
  key: string;
  group_name: string;
  group_scope: string | null;
  group_type: string | null;
  source: string;
  description: string | null;
  members: Member[];
}

export interface LicenseAggregate {
  key: string;
  sku_id: string;
  sku_part_number: string | null;
  sku_name: string | null;
  members: Member[];
}

export interface PolicyAggregate {
  key: string;
  policy_id: string;
  policy_name: string;
  doors: UnifiDoor[];
  schedule: UnifiSchedule | null;
  members: Member[];
}

function toMember(e: EmployeeRecord): Member {
  return {
    employee_id: e.id,
    employee_name: e.full_name,
    employee_email: e.email,
    employee_department: e.department,
    employee_status: e.status,
  };
}

export function aggregateGroups(employees: EmployeeRecord[]): GroupAggregate[] {
  const map = new Map<string, GroupAggregate>();
  for (const e of employees) {
    for (const g of e.directory_groups) {
      const key = `${g.group_name}::${g.source}`;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          key,
          group_name: g.group_name,
          group_scope: g.group_scope,
          group_type: g.group_type,
          source: g.source,
          description: g.description,
          members: [],
        };
        map.set(key, agg);
      }
      agg.members.push(toMember(e));
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.group_name.localeCompare(b.group_name)
  );
}

export function aggregateLicenses(
  employees: EmployeeRecord[]
): LicenseAggregate[] {
  const map = new Map<string, LicenseAggregate>();
  for (const e of employees) {
    for (const l of e.license_assignments) {
      const key = l.sku_id;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          key,
          sku_id: l.sku_id,
          sku_part_number: l.sku_part_number,
          sku_name: l.sku_name,
          members: [],
        };
        map.set(key, agg);
      }
      agg.members.push(toMember(e));
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const an = a.sku_name ?? a.sku_part_number ?? a.sku_id;
    const bn = b.sku_name ?? b.sku_part_number ?? b.sku_id;
    return an.localeCompare(bn);
  });
}

export function aggregatePolicies(
  employees: EmployeeRecord[]
): PolicyAggregate[] {
  const map = new Map<string, PolicyAggregate>();
  for (const e of employees) {
    if (!e.unifi_access) continue;
    for (const p of e.unifi_access.access_policies) {
      const key = p.policy_id;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          key,
          policy_id: p.policy_id,
          policy_name: p.policy_name,
          doors: p.doors ?? [],
          schedule: p.schedule ?? null,
          members: [],
        };
        map.set(key, agg);
      } else {
        if ((p.doors?.length ?? 0) > agg.doors.length) {
          agg.doors = p.doors;
        }
        if (!agg.schedule && p.schedule) {
          agg.schedule = p.schedule;
        }
      }
      agg.members.push(toMember(e));
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.policy_name.localeCompare(b.policy_name)
  );
}
