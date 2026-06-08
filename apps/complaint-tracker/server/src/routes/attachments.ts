import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();
router.use(authenticate());

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// POST /api/attachments/:complaintId — upload file
router.post('/:complaintId', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const complaint = await db('complaints').where('id', req.params.complaintId).first();
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const [attachment] = await db('attachments')
      .insert({
        complaint_id: complaint.id,
        filename: req.file.filename,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size: req.file.size,
        uploaded_by: req.user!.id,
      })
      .returning('*');

    await logAudit(req, 'upload', 'attachment', attachment.id, { complaint_id: complaint.id });
    res.status(201).json(attachment);
  } catch (err) {
    console.error('Failed to upload attachment:', err);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// GET /api/attachments/:id/download — download file
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const attachment = await db('attachments').where('id', req.params.id).first();
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const filePath = path.join(uploadDir, attachment.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(filePath, attachment.original_name);
  } catch (err) {
    console.error('Failed to download attachment:', err);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// DELETE /api/attachments/:id — delete file
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const attachment = await db('attachments').where('id', req.params.id).first();
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const filePath = path.join(uploadDir, attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db('attachments').where('id', req.params.id).del();
    await logAudit(req, 'delete', 'attachment', attachment.id);
    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    console.error('Failed to delete attachment:', err);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

export default router;
