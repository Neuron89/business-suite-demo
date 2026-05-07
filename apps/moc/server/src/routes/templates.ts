import { Router, Request, Response } from 'express';
import { createTemplateSchema, updateTemplateSchema } from '@moc/shared';
import db from '../db/connection';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAudit } from '../middleware/audit';

const router = Router();

// GET /api/templates — list active templates (any authenticated user)
router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const templates = await db('moc_templates')
      .join('users', 'moc_templates.created_by', 'users.id')
      .select('moc_templates.*', 'users.name as creator_name')
      .where('moc_templates.is_active', true)
      .orderBy('moc_templates.name', 'asc');

    res.json(templates);
  } catch (err) {
    console.error('Template list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/templates/all — list ALL templates including inactive (admin/moc_manager)
router.get('/all', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
  try {
    const templates = await db('moc_templates')
      .join('users', 'moc_templates.created_by', 'users.id')
      .select('moc_templates.*', 'users.name as creator_name')
      .orderBy('moc_templates.name', 'asc');

    res.json(templates);
  } catch (err) {
    console.error('Template list all error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/templates/:id — single template
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const template = await db('moc_templates')
      .join('users', 'moc_templates.created_by', 'users.id')
      .select('moc_templates.*', 'users.name as creator_name')
      .where('moc_templates.id', req.params.id)
      .first();

    if (!template) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }

    res.json(template);
  } catch (err) {
    console.error('Template detail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/templates — create template (admin/moc_manager)
router.post('/', authenticate, authorize('admin'), validate(createTemplateSchema), async (req: Request, res: Response) => {
  try {
    // If setting as default, unset other defaults
    if (req.body.is_default) {
      await db('moc_templates').update({ is_default: false });
    }

    const [template] = await db('moc_templates')
      .insert({
        name: req.body.name,
        description: req.body.description,
        is_default: req.body.is_default,
        field_config: JSON.stringify(req.body.field_config),
        custom_fields: JSON.stringify(req.body.custom_fields),
        workflow_config: JSON.stringify(req.body.workflow_config),
        created_by: req.user!.id,
      })
      .returning('*');

    await logAudit(req, 'create', 'moc_template', template.id, req.body);

    res.status(201).json(template);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(400).json({ message: 'A template with that name already exists' });
      return;
    }
    console.error('Template create error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/templates/:id — update template (admin/moc_manager)
router.put('/:id', authenticate, authorize('admin'), validate(updateTemplateSchema), async (req: Request, res: Response) => {
  try {
    const existing = await db('moc_templates').where('id', req.params.id).first();
    if (!existing) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }

    // If setting as default, unset other defaults
    if (req.body.is_default) {
      await db('moc_templates').where('id', '!=', req.params.id).update({ is_default: false });
    }

    const updateData: Record<string, any> = { updated_at: db.fn.now() };
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.is_default !== undefined) updateData.is_default = req.body.is_default;
    if (req.body.field_config !== undefined) updateData.field_config = JSON.stringify(req.body.field_config);
    if (req.body.custom_fields !== undefined) updateData.custom_fields = JSON.stringify(req.body.custom_fields);
    if (req.body.workflow_config !== undefined) updateData.workflow_config = JSON.stringify(req.body.workflow_config);

    const [updated] = await db('moc_templates')
      .where('id', req.params.id)
      .update(updateData)
      .returning('*');

    await logAudit(req, 'update', 'moc_template', parseInt(String(req.params.id)), req.body);

    res.json(updated);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(400).json({ message: 'A template with that name already exists' });
      return;
    }
    console.error('Template update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/templates/:id — soft delete (admin/moc_manager)
router.delete('/:id', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const existing = await db('moc_templates').where('id', req.params.id).first();
    if (!existing) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }

    await db('moc_templates')
      .where('id', req.params.id)
      .update({ is_active: false, updated_at: db.fn.now() });

    await logAudit(req, 'delete', 'moc_template', parseInt(String(req.params.id)), {});

    res.json({ message: 'Template deactivated' });
  } catch (err) {
    console.error('Template delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
