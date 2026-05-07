import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/connection';
import { authenticate, isAdminUser } from '../middleware/auth';
import { sendEmail } from '../services/email';

const router = Router();

// ── POST /api/external-actions — assign an external user to an action item ──
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { item_type, item_id, email, name } = req.body;

    if (!item_type || !item_id || !email) {
      res.status(400).json({ message: 'item_type, item_id, and email are required' });
      return;
    }
    if (!['dsr', 'pssr'].includes(item_type)) {
      res.status(400).json({ message: 'item_type must be dsr or pssr' });
      return;
    }

    // Verify the item exists and get MOC info
    const table = item_type === 'dsr' ? 'dsr_items' : 'pssr_items';
    const checklistTable = item_type === 'dsr' ? 'dsr_checklists' : 'pssr_checklists';
    const item = await db(table).where('id', item_id).first();
    if (!item) {
      res.status(404).json({ message: 'Action item not found' });
      return;
    }

    const checklist = await db(checklistTable).where('id', item.checklist_id).first();
    if (!checklist) {
      res.status(404).json({ message: 'Checklist not found' });
      return;
    }

    const moc = await db('moc_requests').where('id', checklist.moc_id).first();
    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }

    // Create token (expires in 30 days)
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [record] = await db('external_action_tokens')
      .insert({
        token,
        item_type,
        item_id,
        moc_id: moc.id,
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        expires_at: expiresAt,
        created_by: req.user!.id,
      })
      .returning('*');

    // Send email
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const responseLink = `${clientUrl}/external/action/${token}`;
    const assignerName = req.user!.name || req.user!.email;
    const mocDisplay = moc.moc_number || `MOC #${moc.id}`;

    await sendEmail(
      email.trim().toLowerCase(),
      `Action Item Assigned — ${mocDisplay}`,
      externalActionEmail(
        moc.id,
        moc.title,
        moc.description || '',
        item.description,
        item_type.toUpperCase(),
        assignerName,
        responseLink,
        name?.trim() || undefined,
        moc.moc_number,
      ),
    );

    res.status(201).json(record);
  } catch (err: any) {
    console.error('Create external action error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/external-actions/item/:itemType/:itemId — list assignments for an item ──
router.get('/item/:itemType/:itemId', authenticate, async (req: Request, res: Response) => {
  try {
    const itemType = req.params.itemType as string;
    const itemId = req.params.itemId as string;
    const assignments = await db('external_action_tokens')
      .where({ item_type: itemType, item_id: parseInt(itemId) })
      .orderBy('created_at', 'desc');
    res.json(assignments);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/external-actions/moc/:mocId — list all external assignments for a MOC ──
router.get('/moc/:mocId', authenticate, async (req: Request, res: Response) => {
  try {
    const assignments = await db('external_action_tokens')
      .where({ moc_id: parseInt(req.params.mocId as string) })
      .orderBy('created_at', 'desc');
    res.json(assignments);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/external-actions/respond/:token — public, no auth ──
router.get('/respond/:token', async (req: Request, res: Response) => {
  try {
    const record = await db('external_action_tokens').where('token', req.params.token as string).first();
    if (!record) {
      res.status(404).json({ message: 'Invalid or expired link' });
      return;
    }
    if (new Date(record.expires_at) < new Date()) {
      res.status(410).json({ message: 'This link has expired' });
      return;
    }

    // Get item details
    const table = record.item_type === 'dsr' ? 'dsr_items' : 'pssr_items';
    const item = await db(table).where('id', record.item_id).first();

    // Get MOC info
    const moc = await db('moc_requests').where('id', record.moc_id).select('id', 'title', 'moc_number', 'description').first();

    // Get who assigned it
    const assigner = await db('users').where('id', record.created_by).select('name', 'email').first();

    res.json({
      token: record.token,
      item_type: record.item_type,
      email: record.email,
      name: record.name,
      responded_at: record.responded_at,
      response_note: record.response_note,
      marked_done: record.marked_done,
      created_at: record.created_at,
      item: item ? {
        description: item.description,
        category: item.category,
        status: item.status,
        notes: item.notes,
        action_resolved: item.action_resolved,
      } : null,
      moc: moc ? {
        id: moc.id,
        title: moc.title,
        moc_number: moc.moc_number,
        description: moc.description,
      } : null,
      assigned_by: assigner ? assigner.name : 'Unknown',
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/external-actions/respond/:token — public, no auth ──
router.post('/respond/:token', async (req: Request, res: Response) => {
  try {
    const record = await db('external_action_tokens').where('token', req.params.token as string).first();
    if (!record) {
      res.status(404).json({ message: 'Invalid or expired link' });
      return;
    }
    if (new Date(record.expires_at) < new Date()) {
      res.status(410).json({ message: 'This link has expired' });
      return;
    }

    const { note, marked_done } = req.body;

    // Update the token record
    await db('external_action_tokens')
      .where('id', record.id)
      .update({
        responded_at: db.fn.now(),
        response_note: note || null,
        marked_done: !!marked_done,
      });

    // Update the action item with the external note
    const table = record.item_type === 'dsr' ? 'dsr_items' : 'pssr_items';
    const item = await db(table).where('id', record.item_id).first();
    if (item) {
      const extLabel = record.name || record.email;
      const notePrefix = `[External — ${extLabel}]: `;
      const existingNotes = item.notes || '';
      const newNote = note ? `${notePrefix}${note}` : '';
      const combinedNotes = existingNotes
        ? `${existingNotes}\n${newNote}`
        : newNote;

      const update: any = { updated_at: db.fn.now() };
      if (newNote) update.notes = combinedNotes.trim();
      if (marked_done) update.action_resolved = true;

      await db(table).where('id', record.item_id).update(update);
    }

    res.json({ message: 'Response recorded. Thank you!' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/external-actions/:id — revoke an assignment ──
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const deleted = await db('external_action_tokens')
      .where('id', parseInt(req.params.id as string))
      .del();
    if (!deleted) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }
    res.json({ message: 'Assignment revoked' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

// ── Email template ─────────────────────────────────────────────────────

function emailWrapper(content: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e40af; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 18px;">Management of Change</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        ${content}
      </div>
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
        Automated notification from the MOC system. Do not reply to this email.
      </p>
    </div>
  `;
}

function externalActionEmail(
  mocId: number,
  mocTitle: string,
  description: string,
  itemDescription: string,
  itemType: string,
  assignedBy: string,
  responseLink: string,
  recipientName?: string,
  mocNumber?: string,
): string {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const mocDisplay = mocNumber || `MOC #${mocId}`;
  return emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">Action Item Assigned — ${mocDisplay}</h2>
    <p>${greeting}</p>
    <p>You have been assigned an action item on a Management of Change by <strong>${assignedBy}</strong>.</p>
    <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
      <tr>
        <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; width: 130px;">MOC</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${mocDisplay} — ${mocTitle}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Review Type</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${itemType}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Action Item</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${itemDescription}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Assigned By</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${assignedBy}</td>
      </tr>
    </table>
    <p>Please use the button below to add a note or mark this item as complete. <strong>No login is required.</strong></p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${responseLink}" style="background: #1e40af; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
        Respond to Action Item
      </a>
    </div>
    <p style="color: #6b7280; font-size: 12px;">This link will expire in 30 days.</p>
  `);
}
