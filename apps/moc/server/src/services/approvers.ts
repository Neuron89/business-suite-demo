import db from '../db/connection';

/**
 * Named-user approval model.
 *
 * On transition to `under_review`, `populateApprovers` seeds the moc_approvers
 * table with specific user ids based on:
 *   - Plant Manager (management) — always
 *   - Every active EHS user with is_approver=true
 *   - For each affected_area on the MOC, users whose user_locations covers it + is_approver
 *   - Tyler (any maintenance-approver) when `maintenance` in departments_involved
 *   - Purchasing Lead (purchasing approver) when purchasing_involved=true on the MOC
 *   - NPD Lead (product_manager approver) when npd_involved=true on the MOC
 *
 * Idempotent: re-running inserts only missing rows, preserves existing decisions.
 *
 * On reset (reject → under_review), bump moc.review_cycle and clear decisions
 * by marking rows pending again — see `resetApproversForCycle`.
 */

type ApproverSeed = {
  user_id: number;
  role_context: string;
};

const MANAGEMENT_EMAIL = 'demo.manager@acme.demo';
const PURCHASING_EMAIL = 'demo.it@acme.demo';
const NPD_EMAIL = 'demo.hr@acme.demo';

async function findUserByEmail(email: string): Promise<number | null> {
  const u = await db('users').where('email', email).where('is_active', true).first();
  return u ? u.id : null;
}

/** Union of primary role + secondary_roles (text[]). */
function userRoles(u: any): string[] {
  return [u.role, ...((u.secondary_roles as string[]) || [])];
}

export async function populateApprovers(mocId: number): Promise<void> {
  const moc = await db('moc_requests').where('id', mocId).first();
  if (!moc) throw new Error(`MOC ${mocId} not found`);

  const seeds: ApproverSeed[] = [];
  const affectedAreas: string[] = moc.affected_areas || [];
  const deptsInvolved: string[] = moc.departments_involved || [];

  // 1. Management — Rob always
  const robId = await findUserByEmail(MANAGEMENT_EMAIL);
  if (robId) seeds.push({ user_id: robId, role_context: 'management' });

  // 2. EHS approvers (any EHS user flagged is_approver)
  const ehsApprovers = await db('users')
    .where({ is_active: true, is_approver: true })
    .andWhere(function () {
      this.where('role', 'ehs').orWhereRaw(`'ehs' = ANY(secondary_roles)`);
    });
  for (const u of ehsApprovers) seeds.push({ user_id: u.id, role_context: 'ehs' });

  // 3. Area-specific ops/qc: users whose user_locations includes any affected_area
  if (affectedAreas.length > 0) {
    const areaApprovers = await db('users as u')
      .join('user_locations as ul', 'ul.user_id', 'u.id')
      .where('u.is_active', true)
      .where('u.is_approver', true)
      .whereIn('ul.area', affectedAreas)
      .select('u.id', 'u.role', 'u.secondary_roles', 'ul.area')
      .distinct();
    for (const u of areaApprovers) {
      const roles = userRoles(u);
      const primaryArea = roles.includes('operations') ? 'operations' : roles.includes('qc') ? 'qc' : u.role;
      seeds.push({ user_id: u.id, role_context: `${primaryArea}:${u.area}` });
    }
  }

  // 4. Maintenance — when involved, include any maintenance approver
  if (deptsInvolved.includes('maintenance')) {
    const maintApprovers = await db('users')
      .where({ is_active: true, is_approver: true })
      .andWhere(function () {
        this.where('role', 'maintenance').orWhereRaw(`'maintenance' = ANY(secondary_roles)`);
      });
    for (const u of maintApprovers) seeds.push({ user_id: u.id, role_context: 'maintenance' });
  }

  // 5. Purchasing — explicit flag on MOC
  if (moc.purchasing_involved) {
    const purchId = await findUserByEmail(PURCHASING_EMAIL);
    if (purchId) seeds.push({ user_id: purchId, role_context: 'purchasing' });
  }

  // 6. NPD — explicit flag on MOC
  if (moc.npd_involved) {
    const npdId = await findUserByEmail(NPD_EMAIL);
    if (npdId) seeds.push({ user_id: npdId, role_context: 'npd' });
  }

  // Deduplicate by user_id only — one row per person, regardless of how many
  // role contexts they qualify for. The seed order above doubles as priority
  // (management > ehs > area-specific > generic maintenance > purchasing >
  // npd), so first-wins keeps the most specific context. This prevents users
  // like Tyler from showing up twice (once as generic "maintenance" and once
  // as area-specific "maintenance:utilities").
  const seenUsers = new Set<number>();
  const dedup = seeds.filter((s) => {
    if (seenUsers.has(s.user_id)) return false;
    seenUsers.add(s.user_id);
    return true;
  });

  // Insert missing rows. Uses unique constraint on (moc_id, user_id, role_context).
  for (const s of dedup) {
    await db('moc_approvers')
      .insert({
        moc_id: mocId,
        user_id: s.user_id,
        role_context: s.role_context,
        decision: 'pending',
      })
      .onConflict(['moc_id', 'user_id', 'role_context'])
      .ignore();
  }

  // Clean up any pre-existing duplicate rows for this MOC: if the same user
  // has multiple approver rows, keep the one matching this run's seed
  // (most specific) and drop the rest, but only if none of the to-be-dropped
  // rows already carry a non-pending decision (don't lose audit history).
  for (const s of dedup) {
    const rows = await db('moc_approvers')
      .where({ moc_id: mocId, user_id: s.user_id })
      .select('id', 'role_context', 'decision');
    if (rows.length <= 1) continue;
    const keep = rows.find((r) => r.role_context === s.role_context) || rows[0];
    const toDrop = rows.filter((r) => r.id !== keep.id && r.decision === 'pending');
    if (toDrop.length > 0) {
      await db('moc_approvers').whereIn('id', toDrop.map((r) => r.id)).del();
    }
  }
}

/** Called after reset-on-reject. Bumps review_cycle and resets decisions to pending. */
export async function resetApproversForCycle(mocId: number): Promise<void> {
  await db.transaction(async (trx) => {
    const moc = await trx('moc_requests').where('id', mocId).first();
    if (!moc) throw new Error(`MOC ${mocId} not found`);
    await trx('moc_requests')
      .where('id', mocId)
      .update({ review_cycle: (moc.review_cycle || 0) + 1 });
    await trx('moc_approvers')
      .where('moc_id', mocId)
      .update({ decision: 'pending', comments: null, decided_at: null });
  });
}

export type ApproverRow = {
  id: number;
  moc_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  role_context: string | null;
  decision: 'pending' | 'approved' | 'rejected' | 'returned';
  comments: string | null;
  decided_at: string | null;
};

export async function listApprovers(mocId: number): Promise<ApproverRow[]> {
  return db('moc_approvers as ma')
    .join('users as u', 'u.id', 'ma.user_id')
    .where('ma.moc_id', mocId)
    .select(
      'ma.id',
      'ma.moc_id',
      'ma.user_id',
      'u.name as user_name',
      'u.email as user_email',
      'ma.role_context',
      'ma.decision',
      'ma.comments',
      'ma.decided_at',
    )
    .orderBy([{ column: 'ma.role_context', order: 'asc' }, { column: 'u.name', order: 'asc' }]);
}

export async function recordApproverDecision(
  mocId: number,
  userId: number,
  decision: 'approved' | 'rejected' | 'returned',
  comments: string | null,
): Promise<{ updated: boolean; rows: number }> {
  // Admin bypass is handled at the route level; here we just match user+moc.
  const rows = await db('moc_approvers')
    .where({ moc_id: mocId, user_id: userId })
    .update({ decision, comments, decided_at: db.fn.now() });
  return { updated: rows > 0, rows };
}

/**
 * Check whether every approver row has decision='approved'.
 * If any row is rejected/returned, returns a non-approved summary.
 */
export async function approverSummary(mocId: number): Promise<{
  total: number;
  approved: number;
  rejected: number;
  returned: number;
  pending: number;
  allApproved: boolean;
  hasRejection: boolean;
  hasReturn: boolean;
  managementApproved: boolean;
}> {
  const rows = await db('moc_approvers').where('moc_id', mocId);
  let approved = 0, rejected = 0, returned = 0, pending = 0;
  let managementApproved = false;
  for (const r of rows) {
    if (r.decision === 'approved') approved++;
    else if (r.decision === 'rejected') rejected++;
    else if (r.decision === 'returned') returned++;
    else pending++;
    if (r.role_context === 'management' && r.decision === 'approved') managementApproved = true;
  }
  return {
    total: rows.length,
    approved, rejected, returned, pending,
    allApproved: rows.length > 0 && approved === rows.length,
    hasRejection: rejected > 0,
    hasReturn: returned > 0,
    managementApproved,
  };
}

/** Admin helper — insert a specific user as an approver on a MOC. */
export async function addApprover(mocId: number, userId: number, roleContext: string): Promise<void> {
  await db('moc_approvers')
    .insert({ moc_id: mocId, user_id: userId, role_context: roleContext, decision: 'pending' })
    .onConflict(['moc_id', 'user_id', 'role_context'])
    .ignore();
}

/** Admin helper — remove an approver row. */
export async function removeApprover(mocApproverId: number): Promise<void> {
  await db('moc_approvers').where('id', mocApproverId).del();
}
