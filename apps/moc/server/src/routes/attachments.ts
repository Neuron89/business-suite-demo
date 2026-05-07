import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf', 'image/jpeg', 'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv', 'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

const router = Router();

const VALID_ENTITY_TYPES = ['moc', 'ehs_incident'];

function getEntityTable(entityType: string): string {
  if (entityType === 'moc') return 'moc_requests';
  if (entityType === 'ehs_incident') return 'ehs_incidents';
  return '';
}

// ── Downloads (must come before /:entityType/:entityId) ─────────────────

// GET /api/attachments/download/:id
router.get('/download/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const attachment = await db('attachments').where('id', req.params.id).first();
    if (!attachment) {
      res.status(404).json({ message: 'Attachment not found' });
      return;
    }

    const filePath = path.join(UPLOAD_DIR, attachment.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'File not found on disk' });
      return;
    }

    res.download(filePath, attachment.original_name);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attachments/preview/:id?token=JWT
// Serves the file inline for embedding in iframes / img tags.
// Accepts token as a query param since iframes can't send Authorization headers.
router.get('/preview/:id', async (req: Request, res: Response) => {
  try {
    // Authenticate via query param or header
    const tokenStr = (req.query.token as string) || req.headers.authorization?.slice(7);
    if (!tokenStr) {
      res.status(401).json({ message: 'Missing token' });
      return;
    }
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
    try {
      jwt.verify(tokenStr, JWT_SECRET);
    } catch {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    const attachment = await db('attachments').where('id', req.params.id).first();
    if (!attachment) {
      res.status(404).json({ message: 'Attachment not found' });
      return;
    }

    const filePath = path.join(UPLOAD_DIR, attachment.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'File not found on disk' });
      return;
    }

    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.original_name}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ── Generic Entity Routes (two-segment) ─────────────────────────────────

// POST /api/attachments/:entityType/:entityId
router.post('/:entityType/:entityId', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const entityType = String(req.params.entityType);
    const entityId = String(req.params.entityId);

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ message: 'Invalid entity type' });
      return;
    }

    const table = getEntityTable(entityType);
    const entity = await db(table).where('id', entityId).first();
    if (!entity) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ message: 'Entity not found' });
      return;
    }

    const [attachment] = await db('attachments')
      .insert({
        moc_id: entityType === 'moc' ? parseInt(entityId) : null,
        entity_type: entityType,
        entity_id: parseInt(entityId),
        filename: req.file.filename,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size: req.file.size,
        uploaded_by: req.user!.id,
      })
      .returning('*');

    await logAudit(req, 'upload', 'attachment', attachment.id, {
      entity_type: entityType,
      entity_id: entityId,
      filename: req.file.originalname,
    });

    res.status(201).json(attachment);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attachments/:entityType/:entityId
router.get('/:entityType/:entityId', authenticate, async (req: Request, res: Response) => {
  try {
    const entityType = String(req.params.entityType);
    const entityId = String(req.params.entityId);

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      res.status(400).json({ message: 'Invalid entity type' });
      return;
    }

    const attachments = await db('attachments')
      .join('users', 'attachments.uploaded_by', 'users.id')
      .select('attachments.*', 'users.name as uploader_name')
      .where('entity_type', entityType)
      .where('entity_id', entityId);

    res.json(attachments);
  } catch (err) {
    console.error('Attachments list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ── Legacy Single-Segment Routes ────────────────────────────────────────

// POST /api/attachments/:mocId (legacy backward compat)
router.post('/:mocId', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const moc = await db('moc_requests').where('id', req.params.mocId).first();
    if (!moc) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ message: 'MOC not found' });
      return;
    }

    const [attachment] = await db('attachments')
      .insert({
        moc_id: parseInt(String(req.params.mocId)),
        entity_type: 'moc',
        entity_id: parseInt(String(req.params.mocId)),
        filename: req.file.filename,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size: req.file.size,
        uploaded_by: req.user!.id,
      })
      .returning('*');

    await logAudit(req, 'upload', 'attachment', attachment.id, {
      moc_id: req.params.mocId,
      filename: req.file.originalname,
    });

    res.status(201).json(attachment);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attachments/:mocId (legacy backward compat)
router.get('/:mocId', authenticate, async (req: Request, res: Response) => {
  try {
    const attachments = await db('attachments')
      .join('users', 'attachments.uploaded_by', 'users.id')
      .select('attachments.*', 'users.name as uploader_name')
      .where('moc_id', req.params.mocId);

    res.json(attachments);
  } catch (err) {
    console.error('Attachments list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ── Delete ──────────────────────────────────────────────────────────────

// DELETE /api/attachments/:id
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const attachment = await db('attachments').where('id', req.params.id).first();
    if (!attachment) {
      res.status(404).json({ message: 'Attachment not found' });
      return;
    }

    // Only creator or admin can delete
    if (attachment.uploaded_by !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    const filePath = path.join(UPLOAD_DIR, attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db('attachments').where('id', req.params.id).delete();
    await logAudit(req, 'delete', 'attachment', parseInt(String(req.params.id)));

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Attachment delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
