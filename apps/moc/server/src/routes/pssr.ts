import { Router, Request, Response } from 'express';
import { updatePssrItemSchema, PSSR_CATEGORIES, PSSR_CATEGORY_LABELS, DEPARTMENT_LABELS, REVIEWER_ROLE_LABELS } from '@moc/shared';
import db from '../db/connection';
import { authenticate, authorize, isMocOwner } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';
import type { Department } from '@moc/shared';
import { PSSR_TEMPLATE_ITEMS } from '../templates/pssr-template';
export { PSSR_TEMPLATE_ITEMS } from '../templates/pssr-template';

const router = Router();

// Legacy inline template kept for git history — actual data now in templates/pssr-template.ts
const _UNUSED: { category: string; description: string }[] = [
  // A. Design and Construction
  { category: 'design_and_construction', description: 'Have the concerns from the Design Safety Review been resolved satisfactorily?' },
  { category: 'design_and_construction', description: 'Has the equipment QA turnover procedure been completed?' },
  { category: 'design_and_construction', description: 'Are all applicable Chemical Process Safety Standards Administrative Controls complied with?' },
  { category: 'design_and_construction', description: 'Is construction and equipment in accordance with ISP and other applicable design specifications?' },
  { category: 'design_and_construction', description: 'Has a field inspection been performed?' },
  { category: 'design_and_construction', description: 'Has the job site been properly cleaned up?' },
  { category: 'design_and_construction', description: 'Has adequate surface drainage been provided?' },
  { category: 'design_and_construction', description: 'Are walking/working surfaces level, secured and non-slippery?' },
  { category: 'design_and_construction', description: 'Have emergency access and egress been properly provided for and labeled or marked?' },
  { category: 'design_and_construction', description: 'Are personnel protected from contact with hot (>140°F) surfaces?' },
  { category: 'design_and_construction', description: 'Do walkways and ladders provide safe access to all levels?' },
  { category: 'design_and_construction', description: 'Can elevated work be performed safely?' },
  { category: 'design_and_construction', description: 'Do signs identify work area hazards and provide instruction?' },
  { category: 'design_and_construction', description: 'Is idled equipment properly isolated and identified?' },
  { category: 'design_and_construction', description: 'Is the work area adequately ventilated?' },
  { category: 'design_and_construction', description: 'Is insulation or other equipment free of sharp edges?' },

  // B. Valves and Piping
  { category: 'valves_and_piping', description: 'Are open ended valves of the correct type and plugged or blinded where required?' },
  { category: 'valves_and_piping', description: 'Are hoses and fittings of the approved types?' },
  { category: 'valves_and_piping', description: 'Are check valves installed in the correct orientation and direction?' },
  { category: 'valves_and_piping', description: 'Have tripping hazards been eliminated and adequate clearance provided?' },
  { category: 'valves_and_piping', description: 'Is the piping adequately supported?' },
  { category: 'valves_and_piping', description: 'Has a line-by-line inspection been done?' },
  { category: 'valves_and_piping', description: 'Have nipple lengths been minimized and cantilevered branch connections avoided?' },
  { category: 'valves_and_piping', description: 'Is cathodic protection provided, if specified?' },
  { category: 'valves_and_piping', description: 'Are line expansion provisions installed?' },
  { category: 'valves_and_piping', description: 'Is any piping close to the edge of a pipe rack that could fall off in high wind or during line expansion?' },
  { category: 'valves_and_piping', description: 'Are dead end pipe, pocketed lines, and unused piping branches eliminated?' },
  { category: 'valves_and_piping', description: 'Have valves and flanges subject to fugitive emission monitoring been tagged as required?' },
  { category: 'valves_and_piping', description: 'Is the placement of flanges, unions, drains, etc., adequate for maintenance?' },

  // C. Equipment
  { category: 'equipment', description: 'Has protection been provided against over pressure and vacuum?' },
  { category: 'equipment', description: 'Have guards such as coupling and seal guards been installed on moving equipment?' },
  { category: 'equipment', description: 'Does equipment location provide safe access for operation and maintenance?' },
  { category: 'equipment', description: 'Is equipment adequately supported?' },
  { category: 'equipment', description: 'Are Test and Inspections (T&I) current for reused equipment?' },
  { category: 'equipment', description: 'Was rotation checked?' },
  { category: 'equipment', description: "Is the manufacturer's label visible?" },
  { category: 'equipment', description: 'Is the equipment free from pipe strain?' },

  // D. Instrument and Electrical
  { category: 'instrument_and_electrical', description: 'Was the fail-safe position of valves verified by functional testing?' },
  { category: 'instrument_and_electrical', description: 'Were instruments/analyzers functionally tested?' },
  { category: 'instrument_and_electrical', description: 'Will alarms associated with critical instruments be clearly displayed in the control room?' },
  { category: 'instrument_and_electrical', description: 'Are guards provided to prevent accidental tripping of switches?' },
  { category: 'instrument_and_electrical', description: 'Are indicating lights operational?' },
  { category: 'instrument_and_electrical', description: 'Are conduit fittings sealed?' },
  { category: 'instrument_and_electrical', description: 'Have all junction boxes and electrical switch boxes been properly covered or closed?' },
  { category: 'instrument_and_electrical', description: 'Is electrical heat tracing labeled?' },
  { category: 'instrument_and_electrical', description: 'Are start/stop switches and electrical switchgear labeled?' },
  { category: 'instrument_and_electrical', description: 'Have the correct electrical area classification rules been followed?' },
  { category: 'instrument_and_electrical', description: 'Have the electrical protective devices and safety features been properly calibrated, set, and tested?' },
  { category: 'instrument_and_electrical', description: 'Does the electrical equipment have lockout devices?' },
  { category: 'instrument_and_electrical', description: 'Have the commissioning test results been performed by local plant maintenance?' },
  { category: 'instrument_and_electrical', description: 'Is equipment properly grounded and functionally checked?' },
  { category: 'instrument_and_electrical', description: 'Are ground wires available for tank trucks, tank cars, drums, etc.?' },
  { category: 'instrument_and_electrical', description: 'Is ventilation for batteries/electrical components adequate?' },
  { category: 'instrument_and_electrical', description: 'Is there adequate lighting?' },
  { category: 'instrument_and_electrical', description: 'Are critical instruments, ESD devices, quality instruments, etc., field distinguishable?' },
  { category: 'instrument_and_electrical', description: 'Has adequate local instrumentation been supplied per design specifications for safety and trouble-shooting?' },

  // E. Computer Software and Systems
  { category: 'computer_software_and_systems', description: 'Have all software outputs been tested off-line?' },
  { category: 'computer_software_and_systems', description: 'If the software requires information from other computers, are adequate safeguards provided?' },
  { category: 'computer_software_and_systems', description: 'Have instructions been provided for restarting the computer safely after a shutdown?' },
  { category: 'computer_software_and_systems', description: 'Is sufficient checking of data inputs to software provided to safely operate the facility?' },
  { category: 'computer_software_and_systems', description: 'Has the need for computer training been addressed?' },
  { category: 'computer_software_and_systems', description: 'Is documentation provided for software, including user and technical documentation?' },
  { category: 'computer_software_and_systems', description: 'Are important software functions (critical alarms, ESD devices, process control logic) adequately protected?' },

  // F. Operations
  { category: 'operations', description: 'Are NFPA chemical hazard identification symbols in place?' },
  { category: 'operations', description: 'Can the system be safely started up, shut down or operated on 100% recycle, if applicable?' },
  { category: 'operations', description: 'Are routinely operated valves accessible and easy to operate (gear operators and chain operators provided where necessary)?' },
  { category: 'operations', description: 'Are vents and drains visible and safely located?' },
  { category: 'operations', description: 'Have piping and equipment been installed properly to avoid unnecessary cross-ties which could contribute to contamination, pressure, or temperature problems?' },
  { category: 'operations', description: 'Are sample points properly configured for safe sampling?' },
  { category: 'operations', description: 'Have provisions been made for safe handling of drums and gas cylinders?' },
  { category: 'operations', description: 'Are new lines and equipment adequately labeled, including flow arrows?' },
  { category: 'operations', description: 'Are special procedures for commissioning/decommissioning or first time startup provided?' },
  { category: 'operations', description: 'Have operator and supervisory personnel training sessions been completed and documented?' },
  { category: 'operations', description: 'Are provisions made for technical or supervisory support during initial operation?' },
  { category: 'operations', description: 'Was the change communicated to adjacent units or other affected groups?' },

  // G. Maintenance
  { category: 'maintenance', description: 'Can equipment be cleaned, isolated, locked out, and easily removed?' },
  { category: 'maintenance', description: 'Is equipment and instrumentation reasonably accessible for inspection and maintenance?' },
  { category: 'maintenance', description: 'Is equipment entered on the PM program?' },
  { category: 'maintenance', description: 'Are capacities of lifting equipment, floors, and hoists clearly displayed and visible?' },
  { category: 'maintenance', description: 'Have maintenance personnel whose job task will be affected been trained and training documented?' },
  { category: 'maintenance', description: 'Are necessary spare parts available?' },

  // H. Relief Devices
  { category: 'relief_devices', description: 'Have all relief devices been installed per design?' },
  { category: 'relief_devices', description: 'Relief devices added to checklist?' },
  { category: 'relief_devices', description: 'Are block valves on inlet and outlet of relief devices car sealed open?' },
  { category: 'relief_devices', description: 'Are safety valve discharges directed to a safe location?' },
  { category: 'relief_devices', description: 'Is the inlet or outlet piping at least the same size as the connection on the relief device?' },
  { category: 'relief_devices', description: 'Is the relief device stack adequately braced against any reaction forces?' },
  { category: 'relief_devices', description: 'Are heat exchangers protected on the shell and tube side?' },
  { category: 'relief_devices', description: 'Are weep holes, drains, and/or weather barriers provided in discharge piping of pressure relief devices?' },
  { category: 'relief_devices', description: 'Are relief valves tagged?' },
  { category: 'relief_devices', description: 'Are relief valves installed vertically?' },
  { category: 'relief_devices', description: 'Is there a pressure indicator between rupture disks and relief valves?' },
  { category: 'relief_devices', description: 'Have safety valves been tested and tagged?' },
  { category: 'relief_devices', description: 'Are safety valves under pipe strain?' },

  // I. Fire Protection and Personnel Safety Equipment
  { category: 'fire_protection_and_personnel_safety', description: 'Have inert gas blankets and purges been provided where required?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Are tank legs fire-proofed, where required by OSHA/NFPA standards?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have sprinkler systems/deluge systems been installed and functionally tested if specified?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have new fire protection systems and control valves been added to the inspection list?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have new fire protection systems control valves been car-sealed open?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have fixed fire protection systems been installed, tested, and labeled?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Has fire protection group approved all changes to fixed fire protection facilities?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Has steam or nitrogen been provided for snuffing fires in safety valve vent headers?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have Operations and Emergency Response Team personnel been adequately instructed in appropriate support and response procedures?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have approved fire extinguishers, safety showers, eye baths, fresh air equipment, etc. been installed?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have flame arrestors been installed as required?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Have Emergency Response procedures been reviewed as necessary?' },
  { category: 'fire_protection_and_personnel_safety', description: 'Has freeze and/or scalding protection been adequately addressed?' },

  // J. Occupational Health / Industrial Hygiene
  { category: 'occupational_health_industrial_hygiene', description: 'Are provisions for monitoring potential high noise areas made?' },
  { category: 'occupational_health_industrial_hygiene', description: 'If regulated chemicals are involved, have the special requirements been observed?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Has a PPE assessment survey been conducted?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Has appropriate PPE been provided, personnel trained and training documented?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Does the system assure minimum personnel exposure to chemicals?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Are provisions made for Industrial Hygiene monitoring during initial or routine operations?' },
  { category: 'occupational_health_industrial_hygiene', description: 'Has exposed asbestos insulation been properly sealed or disposed of?' },

  // K. Environmental Protection
  { category: 'environmental_protection', description: 'Were changes in air emissions, waste, wastewater and storm water flows properly communicated?' },
  { category: 'environmental_protection', description: 'Can hazardous materials from spills or maintenance preparation be safely handled?' },
  { category: 'environmental_protection', description: 'Are environmental permits and inspections/certifications required for operation on file and understood by unit personnel?' },
];

// POST /api/pssr — create PSSR checklist for a MOC
router.post('/', authenticate, authorize('ehs', 'operations', 'admin', 'moc_manager'), async (req: Request, res: Response) => {
  try {
    const { moc_id } = req.body;
    const moc = await db('moc_requests').where('id', moc_id).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }
    if (moc.status !== 'pssr_pending') {
      res.status(400).json({ message: 'MOC must be in pssr_pending status' });
      return;
    }

    const existing = await db('pssr_checklists').where('moc_id', moc_id).first();
    if (existing) {
      res.status(400).json({ message: 'PSSR checklist already exists for this MOC' });
      return;
    }

    const [checklist] = await db('pssr_checklists')
      .insert({ moc_id, created_by: req.user!.id })
      .returning('*');

    const items = PSSR_TEMPLATE_ITEMS.map((t) => ({
      checklist_id: checklist.id,
      category: t.category,
      description: t.description,
      status: 'pending',
    }));

    await db('pssr_items').insert(items);

    await logAudit(req, 'create', 'pssr_checklist', checklist.id, { moc_id });

    const insertedItems = await db('pssr_items').where('checklist_id', checklist.id);
    res.status(201).json({ ...checklist, items: insertedItems });
  } catch (err) {
    console.error('PSSR create error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/pssr/:mocId
router.get('/:mocId', authenticate, async (req: Request, res: Response) => {
  try {
    const checklist = await db('pssr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No PSSR checklist found' });
      return;
    }

    const items = await db('pssr_items')
      .leftJoin('users', 'pssr_items.verified_by', 'users.id')
      .select('pssr_items.*', 'users.name as verifier_name')
      .where('checklist_id', checklist.id)
      .orderBy('pssr_items.id', 'asc');

    res.json({ ...checklist, items });
  } catch (err) {
    console.error('PSSR get error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/pssr/item/:itemId — update a single PSSR item
router.put('/item/:itemId', authenticate, validate(updatePssrItemSchema), async (req: Request, res: Response) => {
  try {
    const item = await db('pssr_items').where('id', req.params.itemId).first();
    if (!item) {
      res.status(404).json({ message: 'PSSR item not found' });
      return;
    }

    const user = req.user!;
    const isAdmin = ['admin', 'super_admin', 'moc_manager'].includes(user.role) || user.admin_access === true;

    // Resolve permission: MOC owner, admin, or action owner only.
    if (req.body.action_resolved !== undefined && req.body.action_resolved !== item.action_resolved) {
      const checklist = await db('pssr_checklists').where('id', item.checklist_id).first();
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
      // When the deficiency is resolved, flip the question response to pass
      // so the printed/exported report reflects the corrected state.
      if (req.body.action_resolved === true) {
        updateData.status = 'pass';
      }
    }
    if (req.body.action_type !== undefined) {
      updateData.action_type = req.body.action_type;
    }
    if (req.body.assigned_to !== undefined) {
      updateData.assigned_to = req.body.assigned_to;
    }

    const [updated] = await db('pssr_items')
      .where('id', req.params.itemId)
      .update(updateData)
      .returning('*');

    await logAudit(req, 'update', 'pssr_item', parseInt(String(req.params.itemId)), req.body);

    res.json(updated);
  } catch (err) {
    console.error('PSSR item update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/pssr/:mocId/custom-item — add a custom action item to PSSR
router.post('/:mocId/custom-item', authenticate, async (req: Request, res: Response) => {
  try {
    const checklist = await db('pssr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No PSSR checklist found' });
      return;
    }

    const { description, category, action_type } = req.body;
    if (!description || !description.trim()) {
      res.status(400).json({ message: 'Description is required for custom items' });
      return;
    }

    const [item] = await db('pssr_items')
      .insert({
        checklist_id: checklist.id,
        category: category || 'design_and_construction',
        description: description.trim(),
        status: 'pending',
        is_custom: true,
        action_type: action_type || 'pre_startup',
      })
      .returning('*');

    await logAudit(req, 'add_custom_item', 'pssr_item', item.id, { moc_id: req.params.mocId, description });

    res.status(201).json(item);
  } catch (err) {
    console.error('PSSR custom item error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/pssr/:mocId/complete — mark PSSR as complete
router.post('/:mocId/complete', authenticate, authorize('ehs', 'admin', 'moc_manager'), async (req: Request, res: Response) => {
  try {
    const checklist = await db('pssr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No PSSR checklist found' });
      return;
    }

    // Gate completion on pre-startup items only (post-startup can remain unresolved)
    const incompletePreStartup = await db('pssr_items')
      .where('checklist_id', checklist.id)
      .whereIn('status', ['pending', 'fail'])
      .where(function() {
        this.where('action_type', 'pre_startup').orWhereNull('action_type');
      })
      .count('id as count')
      .first();

    if (parseInt(String(incompletePreStartup?.count)) > 0) {
      res.status(400).json({ message: 'All pre-startup PSSR items must pass or be marked N/A before completion. Post-startup items can remain pending.' });
      return;
    }

    await db('pssr_checklists')
      .where('id', checklist.id)
      .update({ completed_at: db.fn.now() });

    await logAudit(req, 'complete', 'pssr_checklist', checklist.id, { moc_id: req.params.mocId });

    res.json({ message: 'PSSR checklist completed' });
  } catch (err) {
    console.error('PSSR complete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/pssr/:mocId/signoff — sign off on PSSR
router.post('/:mocId/signoff', authenticate, async (req: Request, res: Response) => {
  try {
    const checklist = await db('pssr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No PSSR checklist found' });
      return;
    }

    const user = req.user!;

    // Check if already signed off for this role
    const existing = await db('pssr_signoffs')
      .where({ checklist_id: checklist.id, role: user.role })
      .first();
    if (existing) {
      res.status(400).json({ message: `${user.role} has already signed off` });
      return;
    }

    const [signoff] = await db('pssr_signoffs')
      .insert({
        checklist_id: checklist.id,
        user_id: user.id,
        role: user.role,
      })
      .returning('*');

    await logAudit(req, 'signoff', 'pssr_checklist', checklist.id, { role: user.role });

    res.status(201).json(signoff);
  } catch (err) {
    console.error('PSSR signoff error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/pssr/:mocId/signoffs — get all sign-offs for PSSR
router.get('/:mocId/signoffs', authenticate, async (req: Request, res: Response) => {
  try {
    const checklist = await db('pssr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No PSSR checklist found' });
      return;
    }

    const signoffs = await db('pssr_signoffs')
      .join('users', 'pssr_signoffs.user_id', 'users.id')
      .select('pssr_signoffs.*', 'users.name as signer_name', 'users.email as signer_email')
      .where('checklist_id', checklist.id)
      .orderBy('pssr_signoffs.signed_at', 'asc');

    res.json(signoffs);
  } catch (err) {
    console.error('PSSR signoffs list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/pssr/:mocId/export — export PSSR report as printable HTML
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

    const checklist = await db('pssr_checklists').where('moc_id', req.params.mocId).first();
    if (!checklist) {
      res.status(404).json({ message: 'No PSSR checklist found' });
      return;
    }

    const items = await db('pssr_items')
      .leftJoin('users', 'pssr_items.verified_by', 'users.id')
      .select('pssr_items.*', 'users.name as verifier_name')
      .where('checklist_id', checklist.id)
      .orderBy('pssr_items.id', 'asc');

    const signoffs = await db('pssr_signoffs')
      .join('users', 'pssr_signoffs.user_id', 'users.id')
      .select('pssr_signoffs.*', 'users.name as signer_name', 'users.email as signer_email')
      .where('checklist_id', checklist.id)
      .orderBy('pssr_signoffs.signed_at', 'asc');

    // Get departments involved for sign-off roster
    const departments: string[] = moc.departments_involved || [];

    // Build action items from fail items
    const actionItems = items.filter((i: any) => i.status === 'fail');

    // Group items by category
    const grouped: Record<string, any[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    const mocNumber = moc.moc_number || `MOC #${moc.id}`;
    const catLabel = (cat: string) => (PSSR_CATEGORY_LABELS as Record<string, string>)[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const statusLabel = (s: string) => s === 'pass' ? 'Pass' : s === 'fail' ? 'Fail' : s === 'na' ? 'N/A' : 'Pending';
    const statusColor = (s: string) => s === 'pass' ? '#16a34a' : s === 'fail' ? '#dc2626' : s === 'na' ? '#9ca3af' : '#ca8a04';

    let itemsHtml = '';
    for (const cat of PSSR_CATEGORIES) {
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

    // Sign-off roster: show all departments + who signed + blank lines for scanning
    const allRoles = [...new Set([...departments, ...signoffs.map((s: any) => s.role)])];
    let signoffHtml = `
      <h2 style="margin-top: 32px;">Sign-Off Roster</h2>
      <p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">All parties must review the PSSR and action items, then sign below.</p>
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
    // Add blank rows for additional signatures
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
        <title>PSSR Report — ${mocNumber}</title>
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
          <h1 style="color: #1E3A5F; margin-bottom: 4px;">Pre-Startup Safety Review (PSSR)</h1>
          <h2 style="color: #6b7280; font-weight: normal; margin-top: 0;">${mocNumber} — ${moc.title || 'Untitled'}</h2>
          <p style="font-size: 12px; color: #9ca3af;">Created by: ${moc.creator_name} | Date: ${new Date(checklist.created_at).toLocaleDateString()}${checklist.completed_at ? ' | Completed: ' + new Date(checklist.completed_at).toLocaleDateString() : ''}</p>
        </div>

        <h2 style="color: #1E3A5F;">PSSR Checklist Items</h2>
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
          Management of Change System — PSSR Report generated on ${new Date().toLocaleDateString()}
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="PSSR-${mocNumber}.html"`);
    res.send(html);
  } catch (err) {
    console.error('PSSR export error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
