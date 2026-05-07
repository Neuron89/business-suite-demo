import { Router, Request, Response } from 'express';
import { updatePssrItemSchema, DSR_CATEGORIES, DSR_CATEGORY_LABELS, DEPARTMENT_LABELS, REVIEWER_ROLE_LABELS } from '@moc/shared';
import type { Department } from '@moc/shared';
import db from '../db/connection';
import { authenticate, authorize, isMocOwner } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import { DSR_TEMPLATE_ITEMS } from '../templates/dsr-template';
export { DSR_TEMPLATE_ITEMS } from '../templates/dsr-template';

const router = Router();

// Legacy inline template — actual data now in templates/dsr-template.ts
const _UNUSED: { category: string; description: string }[] = [
  // A. Administration
  { category: 'administration', description: 'Based on the current design, is the proposed change consistent with the original Process Hazard Analysis (PHA) assessment?' },
  { category: 'administration', description: 'Does the design comply with ISP Standards?' },
  { category: 'administration', description: 'Has the impact of the change on existing buildings been considered?' },
  { category: 'administration', description: 'Has any impact, beyond unit boundaries, associated with this change been properly dealt with and/or communicated?' },
  { category: 'administration', description: 'Have exposures to existing buildings been considered when siting new vessels, utilities, temporary/permanent buildings or sheds, etc.?' },
  { category: 'administration', description: 'Have noncombustible materials or construction been used?' },

  // B. Material Safety / Regulatory Status
  { category: 'material_safety_regulatory', description: 'Have TSCA change scenarios been considered for applicability?' },
  { category: 'material_safety_regulatory', description: 'Have MSDS or Preliminary Product Safety Data Sheets been obtained for all chemicals to be handled?' },
  { category: 'material_safety_regulatory', description: 'Has the potential for a hazardous chemical reaction in sumps and sewers been considered?' },
  { category: 'material_safety_regulatory', description: 'Have all other potential product regulatory issues been addressed (DOT, FIFRA, BATF, FDA, ISO 9001)?' },

  // C. Pressure / Vacuum Relief
  { category: 'pressure_vacuum_relief', description: 'Have new or modified safety relief devices or vent systems been designed in accordance with requirements?' },
  { category: 'pressure_vacuum_relief', description: 'Has potential for external pressure (vacuum) from sudden cooling, condensing, pump-out, etc. been addressed?' },
  { category: 'pressure_vacuum_relief', description: 'Have only full-port valves been specified for use at inlet and outlet of pressure/vacuum relief devices?' },
  { category: 'pressure_vacuum_relief', description: 'Have any changes to safety relief device inlet or outlet piping been properly reviewed?' },
  { category: 'pressure_vacuum_relief', description: 'Will adequate facilities (alarms, detectors, redundancy) be provided to minimize risk of relief device actuating?' },
  { category: 'pressure_vacuum_relief', description: 'Have the discharges of safety relief devices been located to avoid potential personnel injury?' },
  { category: 'pressure_vacuum_relief', description: 'Has the design included installation of the safety relief valve vertically?' },

  // D. Temperature / Reaction
  { category: 'temperature_reaction', description: 'Has potential for formation of unwanted by-products been adequately addressed?' },
  { category: 'temperature_reaction', description: 'Has potential for loss of flow or reverse flow been adequately addressed?' },
  { category: 'temperature_reaction', description: 'Have adequate provisions been made so that normally dilute but reactive materials cannot be concentrated/accumulated in unexpected areas?' },
  { category: 'temperature_reaction', description: 'Is adequate freeze protection provided?' },

  // E. Valves and Piping
  { category: 'valves_and_piping', description: 'Have the proper Valve and Piping specifications been used?' },
  { category: 'valves_and_piping', description: 'Have cross-tied lines been reviewed to minimize contamination potential and eliminate mixing of reactive chemicals?' },
  { category: 'valves_and_piping', description: 'Have test methods and documentation requirements been specified to ensure integrity of piping systems?' },
  { category: 'valves_and_piping', description: 'Will sample points be properly configured for safe sampling of hazardous chemicals?' },
  { category: 'valves_and_piping', description: 'Have all open ended valves and hand-operated ball valves been designed per environmental requirements?' },
  { category: 'valves_and_piping', description: 'Have hot-taps been reviewed and eliminated where possible?' },
  { category: 'valves_and_piping', description: 'Will necessary excess flow and back-flow prevention measures be provided?' },
  { category: 'valves_and_piping', description: 'Has line expansion and vibration during startup, shutdown, cleaning, etc. been considered?' },
  { category: 'valves_and_piping', description: 'Has the potential risk and consequences of hydraulic hammering been considered?' },
  { category: 'valves_and_piping', description: 'Have appropriate materials of construction been considered for compatibility, corrosion resistance and GMP requirements?' },
  { category: 'valves_and_piping', description: 'Have temporary start-up strainers been identified to ensure removal for normal operation?' },
  { category: 'valves_and_piping', description: 'Has the design included the proper encasing of underground piping at stress points?' },

  // F. Rotating and Mechanical Equipment
  { category: 'rotating_mechanical_equipment', description: 'Have special precautions for safe operation of equipment been considered (reverse flow, minimum flow, etc.)?' },
  { category: 'rotating_mechanical_equipment', description: 'Do new and revised pumps and/or pump seals meet GMP requirements and ISP standards?' },
  { category: 'rotating_mechanical_equipment', description: 'Have lubricants and buffer fluids been properly selected to meet any GMP requirements?' },
  { category: 'rotating_mechanical_equipment', description: 'Will moving parts on machinery be properly guarded?' },
  { category: 'rotating_mechanical_equipment', description: 'Will pumps be located in accordance with ISP Standards?' },
  { category: 'rotating_mechanical_equipment', description: 'Are the emergency shutdown systems adequate (overspeed, ground fault, high temperature, vibration, etc.)?' },
  { category: 'rotating_mechanical_equipment', description: 'Have appropriate materials of construction been considered for compatibility, corrosion resistance and GMP requirements?' },
  { category: 'rotating_mechanical_equipment', description: 'Will adequate pressure relief be provided for new or modified pump systems?' },

  // G. Instrumentation
  { category: 'instrumentation', description: 'Has the potential for instrument failure been adequately addressed?' },
  { category: 'instrumentation', description: 'Have all new shutdown devices been designed to permit testing?' },
  { category: 'instrumentation', description: 'Have potential consequences of instrument or computer failure been considered (redundancy, backup power, etc.)?' },
  { category: 'instrumentation', description: 'Has control valve fail-safe position on loss of electric power or air/nitrogen been properly specified?' },
  { category: 'instrumentation', description: 'Have provisions been made to safeguard against risks of control valves going full open or closed?' },
  { category: 'instrumentation', description: 'If the change affects a shutdown or ESD system, have issues been addressed?' },
  { category: 'instrumentation', description: 'Will alarms associated with critical instruments be clearly displayed in the control room?' },
  { category: 'instrumentation', description: 'Have any special concerns with response time or sequencing been adequately addressed?' },
  { category: 'instrumentation', description: 'Have process changes been considered in the design of new and existing instrumentation?' },
  { category: 'instrumentation', description: 'Has ESD control logic been reviewed?' },
  { category: 'instrumentation', description: 'Will temperature elements be mounted in thermo wells?' },
  { category: 'instrumentation', description: 'Have appropriate materials of construction been considered for compatibility and GMP requirements?' },
  { category: 'instrumentation', description: 'Has adequate local instrumentation been addressed for safety and trouble-shooting purposes?' },
  { category: 'instrumentation', description: 'Is the location of sensing elements proper to ensure correct measurement?' },

  // H. Electrical Systems
  { category: 'electrical_systems', description: 'Have instrumentation and electrical equipment enclosures been specified to meet the electrical classification of the area?' },
  { category: 'electrical_systems', description: 'Have wire gauges, starters and overloads been properly sized per the National Electric Code?' },
  { category: 'electrical_systems', description: 'Has the design considered requirements of Electrical Hot Work and Cranes Near Power Lines?' },
  { category: 'electrical_systems', description: 'Has the design included adequate room for ventilation of transformers, motors, etc.?' },

  // I. Fire Protection
  { category: 'fire_protection', description: 'Has the potential for static electricity buildup been adequately addressed?' },
  { category: 'fire_protection', description: 'Has proper grounding of all electrical and process equipment been specified?' },
  { category: 'fire_protection', description: 'Will fire containment be adequate where hazardous or reactive chemicals are present?' },
  { category: 'fire_protection', description: 'Has spontaneous heating of leakage into insulation been adequately considered?' },
  { category: 'fire_protection', description: 'Are provisions made for safe handling of flammable or potentially explosive materials?' },
  { category: 'fire_protection', description: 'Are all fire water spray system modifications being designed by qualified personnel?' },
  { category: 'fire_protection', description: 'Have modifications to fire protection systems been reviewed by Safety Department and/or property insurance carrier?' },
  { category: 'fire_protection', description: 'Will vents potentially containing flammables be provided with adequate safety equipment?' },
  { category: 'fire_protection', description: 'Will an adequate detection and response system be provided where a vapor cloud is likely?' },
  { category: 'fire_protection', description: 'Have the risks associated with any ignition source or explosive gas mixture been adequately dealt with?' },
  { category: 'fire_protection', description: 'Has adequate fire safety equipment been specified and located where needed?' },
  { category: 'fire_protection', description: 'Has deluge water overflow from containment systems been determined and reviewed properly?' },
  { category: 'fire_protection', description: 'Is diking, curbing, or drainage adequate to contain spills and contaminated rainwater (RCRA)?' },

  // J. Personnel Health & Industrial Hygiene
  { category: 'personnel_health_industrial_hygiene', description: 'Does the design adequately consider medical, industrial hygiene, ergonomic and GMP factors?' },
  { category: 'personnel_health_industrial_hygiene', description: 'Have adequate provisions been specified for safe handling and sampling of hazardous materials?' },
  { category: 'personnel_health_industrial_hygiene', description: 'Have personnel safety devices (showers, eye baths, fall prevention, breathing air) been specified?' },
  { category: 'personnel_health_industrial_hygiene', description: 'Will all asbestos-containing insulation be removed/repaired per plant requirements?' },
  { category: 'personnel_health_industrial_hygiene', description: 'Will secondary surfaces (grating, slip protection) be provided where freezing or slippery materials are handled?' },
  { category: 'personnel_health_industrial_hygiene', description: 'Has confined space entry been adequately addressed in this design?' },
];

// POST /api/dsr — create DSR checklist for a MOC
router.post('/', authenticate, authorize('ehs', 'operations', 'admin', 'moc_manager'), async (req: Request, res: Response) => {
  try {
    const { moc_id } = req.body;
    const moc = await db('moc_requests').where('id', moc_id).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }
    if (moc.status !== 'dsr') {
      res.status(400).json({ message: 'MOC must be in DSR status' });
      return;
    }

    const existing = await db('dsr_checklists').where('moc_id', moc_id).first();
    if (existing) {
      res.status(400).json({ message: 'DSR checklist already exists for this MOC' });
      return;
    }

    // Bidirectional rule: DSR always requires maintenance in departments
    const currentDepts: string[] = moc.departments_involved || [];
    if (!currentDepts.includes('maintenance')) {
      await db('moc_requests').where('id', moc_id).update({
        departments_involved: [...currentDepts, 'maintenance'],
      });
    }

    const [checklist] = await db('dsr_checklists')
      .insert({ moc_id, created_by: req.user!.id })
      .returning('*');

    const items = DSR_TEMPLATE_ITEMS.map((t) => ({
      checklist_id: checklist.id,
      category: t.category,
      description: t.description,
      status: 'pending',
    }));

    await db('dsr_items').insert(items);

    await logAudit(req, 'create', 'dsr_checklist', checklist.id, { moc_id });

    const insertedItems = await db('dsr_items').where('checklist_id', checklist.id);
    res.status(201).json({ ...checklist, items: insertedItems });
  } catch (err) {
    console.error('DSR create error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dsr/:mocId
router.get('/:mocId', authenticate, async (req: Request, res: Response) => {
  try {
    const checklist = await db('dsr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No DSR checklist found' });
      return;
    }

    const items = await db('dsr_items')
      .leftJoin('users', 'dsr_items.verified_by', 'users.id')
      .select('dsr_items.*', 'users.name as verifier_name')
      .where('checklist_id', checklist.id)
      .orderBy('dsr_items.id', 'asc');

    res.json({ ...checklist, items });
  } catch (err) {
    console.error('DSR get error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/dsr/item/:itemId — update a single DSR item
router.put('/item/:itemId', authenticate, async (req: Request, res: Response) => {
  try {
    const item = await db('dsr_items').where('id', req.params.itemId).first();
    if (!item) {
      res.status(404).json({ message: 'DSR item not found' });
      return;
    }

    const user = req.user!;
    const isAdmin = ['admin', 'super_admin', 'moc_manager'].includes(user.role) || user.admin_access === true;

    // Only the MOC owner, an admin, or the action's assigned owner may flip
    // action_resolved. Other reviewers can still update status/notes but cannot
    // mark a deficiency as resolved on someone else's behalf.
    if (req.body.action_resolved !== undefined && req.body.action_resolved !== item.action_resolved) {
      const checklist = await db('dsr_checklists').where('id', item.checklist_id).first();
      const moc = checklist ? await db('moc_requests').where('id', checklist.moc_id).first() : null;
      const userIsMocOwner = isMocOwner(moc, user);
      const isActionOwner = item.assigned_to === user.id;
      if (!isAdmin && !userIsMocOwner && !isActionOwner) {
        res.status(403).json({
          message: 'Only the MOC owner, an admin, or the action owner can mark this resolved',
        });
        return;
      }
    }

    const updateData: Record<string, any> = {
      status: req.body.status,
      notes: req.body.notes || '',
      verified_by: user.id,
      updated_at: db.fn.now(),
    };
    if (req.body.action_resolved !== undefined) {
      updateData.action_resolved = req.body.action_resolved;
      // When a deficiency is resolved, the underlying question response should
      // flip to "Yes" (pass) so the report reflects the corrected state.
      if (req.body.action_resolved === true) {
        updateData.status = 'pass';
      }
    }
    if (req.body.assigned_to !== undefined) {
      updateData.assigned_to = req.body.assigned_to;
    }

    const [updated] = await db('dsr_items')
      .where('id', req.params.itemId)
      .update(updateData)
      .returning('*');

    await logAudit(req, 'update', 'dsr_item', parseInt(String(req.params.itemId)), req.body);

    res.json(updated);
  } catch (err) {
    console.error('DSR item update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/dsr/:mocId/custom-item — add a custom action item to DSR
router.post('/:mocId/custom-item', authenticate, async (req: Request, res: Response) => {
  try {
    const checklist = await db('dsr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No DSR checklist found' });
      return;
    }

    const { description, category } = req.body;
    if (!description || !description.trim()) {
      res.status(400).json({ message: 'Description is required for custom items' });
      return;
    }

    const [item] = await db('dsr_items')
      .insert({
        checklist_id: checklist.id,
        category: category || 'administration',
        description: description.trim(),
        status: 'pending',
        is_custom: true,
      })
      .returning('*');

    await logAudit(req, 'add_custom_item', 'dsr_item', item.id, { moc_id: req.params.mocId, description });

    res.status(201).json(item);
  } catch (err) {
    console.error('DSR custom item error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/dsr/:mocId/complete — mark DSR as complete
// Only MOC owner or admins can complete DSR
router.post('/:mocId/complete', authenticate, async (req: Request, res: Response) => {
  try {
    // Check ownership: only MOC owner or admins can complete DSR
    const moc = await db('moc_requests').where('id', req.params.mocId).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }
    const isOwner = moc.created_by === req.user!.id;
    const isAdmin = ['super_admin', 'admin', 'moc_manager'].includes(req.user!.role);
    if (!isOwner && !isAdmin) {
      res.status(403).json({ message: 'Only the MOC owner or administrators can complete the DSR' });
      return;
    }

    const checklist = await db('dsr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No DSR checklist found' });
      return;
    }

    // All items must be reviewed (no pending) and all fail items must be resolved
    const pending = await db('dsr_items')
      .where('checklist_id', checklist.id)
      .where('status', 'pending')
      .count('id as count')
      .first();

    if (parseInt(String(pending?.count)) > 0) {
      res.status(400).json({ message: 'All DSR items must be reviewed before completion' });
      return;
    }

    const unresolvedFails = await db('dsr_items')
      .where('checklist_id', checklist.id)
      .where('status', 'fail')
      .where('action_resolved', false)
      .count('id as count')
      .first();

    if (parseInt(String(unresolvedFails?.count)) > 0) {
      res.status(400).json({ message: 'All DSR deficiencies must be resolved before completion' });
      return;
    }

    await db('dsr_checklists')
      .where('id', checklist.id)
      .update({ completed_at: db.fn.now() });

    await logAudit(req, 'complete', 'dsr_checklist', checklist.id, { moc_id: req.params.mocId });

    res.json({ message: 'DSR checklist completed' });
  } catch (err) {
    console.error('DSR complete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/dsr/:mocId/signoff — sign off on DSR for the current user's role
router.post('/:mocId/signoff', authenticate, async (req: Request, res: Response) => {
  try {
    const checklist = await db('dsr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No DSR checklist found' });
      return;
    }

    const role = req.user!.role;
    const existing = await db('dsr_signoffs').where({ checklist_id: checklist.id, role }).first();
    if (existing) {
      res.status(400).json({ message: 'You have already signed off on this DSR' });
      return;
    }

    const [signoff] = await db('dsr_signoffs')
      .insert({ checklist_id: checklist.id, user_id: req.user!.id, role })
      .returning('*');

    await logAudit(req, 'signoff', 'dsr_checklist', checklist.id, { moc_id: req.params.mocId, role });

    res.status(201).json(signoff);
  } catch (err) {
    console.error('DSR signoff error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dsr/:mocId/signoffs — get all sign-offs for a DSR
router.get('/:mocId/signoffs', authenticate, async (req: Request, res: Response) => {
  try {
    const checklist = await db('dsr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No DSR checklist found' });
      return;
    }

    const signoffs = await db('dsr_signoffs')
      .join('users', 'dsr_signoffs.user_id', 'users.id')
      .select('dsr_signoffs.*', 'users.name as signer_name', 'users.email as signer_email')
      .where('checklist_id', checklist.id)
      .orderBy('dsr_signoffs.signed_at', 'asc');

    res.json(signoffs);
  } catch (err) {
    console.error('DSR signoffs get error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dsr/:mocId/export — export DSR report as printable HTML
router.get('/:mocId/export', authenticate, async (req: Request, res: Response) => {
  try {
    const moc = await db('moc_requests')
      .join('users', 'moc_requests.created_by', 'users.id')
      .select('moc_requests.*', 'users.name as creator_name')
      .where('moc_requests.id', req.params.mocId)
      .first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }

    const checklist = await db('dsr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No DSR checklist found' });
      return;
    }

    const items = await db('dsr_items')
      .leftJoin('users', 'dsr_items.verified_by', 'users.id')
      .select('dsr_items.*', 'users.name as verifier_name')
      .where('checklist_id', checklist.id)
      .orderBy('dsr_items.id', 'asc');

    const signoffs = await db('dsr_signoffs')
      .join('users', 'dsr_signoffs.user_id', 'users.id')
      .select('dsr_signoffs.*', 'users.name as signer_name', 'users.email as signer_email')
      .where('checklist_id', checklist.id)
      .orderBy('dsr_signoffs.signed_at', 'asc');

    const departments: string[] = moc.departments_involved || [];
    const actionItems = items.filter((i: any) => i.status === 'fail');

    // Group items by category
    const grouped: Record<string, any[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    const mocNumber = moc.moc_number || `MOC #${moc.id}`;
    const catLabel = (cat: string) => (DSR_CATEGORY_LABELS as Record<string, string>)[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const statusLabel = (s: string) => s === 'pass' ? 'Yes' : s === 'fail' ? 'No' : s === 'na' ? 'N/A' : 'Pending';
    const statusColor = (s: string) => s === 'pass' ? '#16a34a' : s === 'fail' ? '#dc2626' : s === 'na' ? '#9ca3af' : '#ca8a04';

    let itemsHtml = '';
    for (const cat of DSR_CATEGORIES) {
      const catItems = grouped[cat] || [];
      if (catItems.length === 0) continue;
      itemsHtml += `
        <tr><td colspan="4" style="background: #1E3A5F; color: white; padding: 8px 12px; font-weight: bold;">${catLabel(cat)}</td></tr>
      `;
      for (const item of catItems) {
        const bgColor = item.status === 'na' ? '#f3f4f6' : 'white';
        const textColor = item.status === 'na' ? '#9ca3af' : '#374151';
        itemsHtml += `
          <tr style="background: ${bgColor}; color: ${textColor};">
            <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
            <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; color: ${statusColor(item.status)};">${statusLabel(item.status)}</td>
            <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${item.notes || ''}</td>
            <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${item.verifier_name || ''}</td>
          </tr>
        `;
      }
    }

    let actionItemsHtml = '';
    if (actionItems.length > 0) {
      actionItemsHtml = `
        <h2 style="color: #dc2626; margin-top: 32px;">Action Items</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
          <thead>
            <tr style="background: #fef2f2;">
              <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">#</th>
              <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Category</th>
              <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Item</th>
              <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Notes / Action Required</th>
              <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #fca5a5; width: 80px;">Resolved</th>
            </tr>
          </thead>
          <tbody>
            ${actionItems.map((item: any, idx: number) => `
              <tr>
                <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${catLabel(item.category)}</td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${item.notes || 'No notes provided'}</td>
                <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; color: ${item.action_resolved ? '#16a34a' : '#dc2626'};">${item.action_resolved ? 'Yes' : 'No'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    // Sign-off roster
    const allRoles = [...new Set([...departments, ...signoffs.map((s: any) => s.role)])];
    let signoffHtml = `
      <h2 style="margin-top: 32px;">Sign-Off Roster</h2>
      <p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">All parties must review the DSR and action items, then sign below.</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Department / Role</th>
            <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Name</th>
            <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Date</th>
            <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Signature</th>
          </tr>
        </thead>
        <tbody>
    `;
    for (const role of allRoles) {
      const signoff = signoffs.find((s: any) => s.role === role);
      const roleLabel = (REVIEWER_ROLE_LABELS as Record<string, string>)[role] || (DEPARTMENT_LABELS as Record<string, string>)[role as Department] || role.toUpperCase();
      signoffHtml += `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${roleLabel}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${signoff ? signoff.signer_name : '________________________'}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${signoff ? new Date(signoff.signed_at).toLocaleDateString() : '_______________'}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; min-width: 200px;">${signoff ? '(signed digitally)' : '________________________'}</td>
        </tr>
      `;
    }
    for (let i = 0; i < 3; i++) {
      signoffHtml += `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">________________________</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">________________________</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">_______________</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">________________________</td>
        </tr>
      `;
    }
    signoffHtml += '</tbody></table>';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DSR Report — ${mocNumber}</title>
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          body { font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 24px; color: #374151; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1E3A5F; margin-bottom: 4px;">Design Safety Review (DSR)</h1>
          <h2 style="color: #6b7280; font-weight: normal; margin-top: 0;">${mocNumber} — ${moc.title || 'Untitled'}</h2>
          <p style="font-size: 12px; color: #9ca3af;">Created by: ${moc.creator_name} | Date: ${new Date(checklist.created_at).toLocaleDateString()}${checklist.completed_at ? ' | Completed: ' + new Date(checklist.completed_at).toLocaleDateString() : ''}</p>
        </div>

        <h2 style="color: #1E3A5F;">DSR Checklist Items</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Item</th>
              <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #d1d5db; width: 80px;">Status</th>
              <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Notes</th>
              <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db; width: 120px;">Verified By</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${actionItemsHtml}

        ${signoffHtml}

        <div style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center;">
          Management of Change System — DSR Report generated on ${new Date().toLocaleDateString()}
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="DSR-${mocNumber}.html"`);
    res.send(html);
  } catch (err) {
    console.error('DSR export error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
