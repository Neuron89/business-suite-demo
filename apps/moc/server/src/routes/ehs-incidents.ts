import { Router, Request, Response } from 'express';
import { ehsIncidentFilterSchema, createEhsIncidentSchema, updateEhsIncidentSchema, INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_LABELS } from '@moc/shared';
import ExcelJS from 'exceljs';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';

const router = Router();

// GET /api/ehs-incidents — paginated list with filters
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const filters = ehsIncidentFilterSchema.parse(req.query);
    const { status, incident_type, severity, search, page, limit } = filters;

    let query = db('ehs_incidents')
      .join('users as reporter', 'ehs_incidents.reported_by', 'reporter.id')
      .leftJoin('users as assignee', 'ehs_incidents.assigned_to', 'assignee.id')
      .leftJoin('moc_requests', 'ehs_incidents.moc_id', 'moc_requests.id')
      .select(
        'ehs_incidents.*',
        'reporter.name as reporter_name',
        'assignee.name as assignee_name',
        'moc_requests.title as moc_title'
      );

    if (status) query = query.where('ehs_incidents.status', status);
    if (incident_type) query = query.where('ehs_incidents.incident_type', incident_type);
    if (severity) query = query.where('ehs_incidents.severity', severity);
    if (search) {
      query = query.where(function () {
        this.whereILike('ehs_incidents.title', `%${search}%`)
          .orWhereILike('ehs_incidents.description', `%${search}%`)
          .orWhereILike('ehs_incidents.location', `%${search}%`);
      });
    }

    const countResult = await query.clone().clearSelect().count('ehs_incidents.id as total').first();
    const total = parseInt(String(countResult?.total || '0'));

    const data = await query
      .orderBy('ehs_incidents.incident_date', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);

    res.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('EHS incidents list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/ehs-incidents/export — Excel download
router.get('/export', authenticate, async (req: Request, res: Response) => {
  try {
    const filters = ehsIncidentFilterSchema.parse(req.query);
    const { status, incident_type, severity, search } = filters;

    let query = db('ehs_incidents')
      .join('users as reporter', 'ehs_incidents.reported_by', 'reporter.id')
      .leftJoin('users as assignee', 'ehs_incidents.assigned_to', 'assignee.id')
      .leftJoin('moc_requests', 'ehs_incidents.moc_id', 'moc_requests.id')
      .select(
        'ehs_incidents.*',
        'reporter.name as reporter_name',
        'assignee.name as assignee_name',
        'moc_requests.title as moc_title'
      );

    if (status) query = query.where('ehs_incidents.status', status);
    if (incident_type) query = query.where('ehs_incidents.incident_type', incident_type);
    if (severity) query = query.where('ehs_incidents.severity', severity);
    if (search) {
      query = query.where(function () {
        this.whereILike('ehs_incidents.title', `%${search}%`)
          .orWhereILike('ehs_incidents.description', `%${search}%`)
          .orWhereILike('ehs_incidents.location', `%${search}%`);
      });
    }

    const data = await query.orderBy('ehs_incidents.incident_date', 'desc');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MOC System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('EHS Incidents');

    // Define columns
    sheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Type', key: 'incident_type', width: 18 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Incident Date', key: 'incident_date', width: 14 },
      { header: 'Location', key: 'location', width: 30 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Affected Persons', key: 'affected_persons', width: 25 },
      { header: 'Root Cause', key: 'root_cause', width: 40 },
      { header: 'Corrective Actions', key: 'corrective_actions', width: 40 },
      { header: 'Reported By', key: 'reporter_name', width: 20 },
      { header: 'Assigned To', key: 'assignee_name', width: 20 },
      { header: 'Related MOC', key: 'moc_title', width: 30 },
      { header: 'Created', key: 'created_at', width: 18 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    // Severity color mapping
    const severityFills: Record<string, string> = {
      minor: 'FFD4EDDA',
      moderate: 'FFFFF3CD',
      serious: 'FFFDE8D0',
      critical: 'FFF8D7DA',
    };

    // Add data rows
    for (const row of data) {
      const dataRow = sheet.addRow({
        id: row.id,
        title: row.title,
        incident_type: (row.incident_type || '').replace(/_/g, ' '),
        severity: INCIDENT_SEVERITY_LABELS[row.severity as keyof typeof INCIDENT_SEVERITY_LABELS] || row.severity,
        status: INCIDENT_STATUS_LABELS[row.status as keyof typeof INCIDENT_STATUS_LABELS] || row.status,
        incident_date: new Date(row.incident_date).toLocaleDateString('en-US'),
        location: row.location,
        description: row.description,
        affected_persons: row.affected_persons || '',
        root_cause: row.root_cause || '',
        corrective_actions: row.corrective_actions || '',
        reporter_name: row.reporter_name || '',
        assignee_name: row.assignee_name || 'Unassigned',
        moc_title: row.moc_id ? `#${row.moc_id} ${row.moc_title || ''}` : '',
        created_at: new Date(row.created_at).toLocaleString('en-US'),
      });

      // Color-code severity cell
      const sevCell = dataRow.getCell('severity');
      const fill = severityFills[row.severity];
      if (fill) {
        sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      }

      dataRow.alignment = { vertical: 'top', wrapText: true };
    }

    // Auto-filter
    sheet.autoFilter = { from: 'A1', to: `O${data.length + 1}` };

    // Send as download
    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ehs-incidents-${timestamp}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('EHS incidents export error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/ehs-incidents/:id — single incident
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const incident = await db('ehs_incidents')
      .join('users as reporter', 'ehs_incidents.reported_by', 'reporter.id')
      .leftJoin('users as assignee', 'ehs_incidents.assigned_to', 'assignee.id')
      .leftJoin('moc_requests', 'ehs_incidents.moc_id', 'moc_requests.id')
      .select(
        'ehs_incidents.*',
        'reporter.name as reporter_name',
        'assignee.name as assignee_name',
        'moc_requests.title as moc_title'
      )
      .where('ehs_incidents.id', req.params.id)
      .first();

    if (!incident) {
      res.status(404).json({ message: 'Incident not found' });
      return;
    }

    res.json(incident);
  } catch (err) {
    console.error('EHS incident detail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/ehs-incidents — create
router.post('/', authenticate, validate(createEhsIncidentSchema), async (req: Request, res: Response) => {
  try {
    const [incident] = await db('ehs_incidents')
      .insert({
        ...req.body,
        status: 'open',
        reported_by: req.user!.id,
      })
      .returning('*');

    await logAudit(req, 'create', 'ehs_incident', incident.id, req.body);

    res.status(201).json(incident);
  } catch (err) {
    console.error('EHS incident create error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/ehs-incidents/:id — update
router.put('/:id', authenticate, validate(updateEhsIncidentSchema), async (req: Request, res: Response) => {
  try {
    const incident = await db('ehs_incidents').where('id', req.params.id).first();
    if (!incident) {
      res.status(404).json({ message: 'Incident not found' });
      return;
    }

    const isOwner = incident.reported_by === req.user!.id;
    const isPrivileged = ['admin', 'ehs', 'moc_manager'].includes(req.user!.role);

    if (!isOwner && !isPrivileged) {
      res.status(403).json({ message: 'Not authorized to edit this incident' });
      return;
    }

    // Non-privileged users cannot change status or assigned_to
    const updateData = { ...req.body };
    if (!isPrivileged) {
      delete updateData.status;
      delete updateData.assigned_to;
    }

    const [updated] = await db('ehs_incidents')
      .where('id', req.params.id)
      .update({ ...updateData, updated_at: db.fn.now() })
      .returning('*');

    await logAudit(req, 'update', 'ehs_incident', incident.id, req.body);

    res.json(updated);
  } catch (err) {
    console.error('EHS incident update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/ehs-incidents/:id — admin only
router.delete('/:id', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const incident = await db('ehs_incidents').where('id', req.params.id).first();
    if (!incident) {
      res.status(404).json({ message: 'Incident not found' });
      return;
    }

    await db('ehs_incidents').where('id', req.params.id).delete();
    await logAudit(req, 'delete', 'ehs_incident', incident.id, {});

    res.json({ message: 'Incident deleted' });
  } catch (err) {
    console.error('EHS incident delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
