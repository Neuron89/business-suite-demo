import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require('archiver');
import { PassThrough } from 'stream';
import path from 'path';
import fs from 'fs';
import db from '../db/connection';
import { authenticate } from '../middleware/auth';
import {
  SEVERITY_LABELS, LIKELIHOOD_LABELS,
  getRiskLevel, DEPARTMENT_LABELS,
  INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_LABELS,
  CRF_CHANGE_TYPE_LABELS, CRF_CHANGE_DURATION_LABELS,
  CRF_RISK_LEVEL_COLORS, getCrfRiskDescription,
  CRF_IMPACT_AREA_LABELS,
  CRF_HAZARD_QUESTION_LABELS, CRF_SIGNIFICANCE_QUESTION_LABELS,
  CRF_IMPLEMENTATION_TASK_LABELS,
  calculateCrfRiskLevel, getCrfRiskReason,
  CRF_HAZARD_L1_QUESTIONS, CRF_HAZARD_L2_QUESTIONS,
  CRF_SIGNIFICANCE_L0_QUESTIONS, CRF_SIGNIFICANCE_L1_QUESTIONS, CRF_SIGNIFICANCE_L2_QUESTIONS,
} from '@moc/shared';
import type { CrfRiskLevel } from '@moc/shared';

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const router = Router();

// ─── Font Registration ───────────────────────────────────────────────────────
// PDFKit's built-in Helvetica (Type 1) only supports WinAnsi encoding, so
// em-dashes, smart quotes, ellipses, and other UTF-8 punctuation render as
// garbage symbols. DejaVu Sans is a TTF with full Unicode coverage; we register
// it under the names "Body" / "Body-Bold" used throughout this file.
const FONT_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function registerBodyFonts(doc: PDFKit.PDFDocument) {
  if (fs.existsSync(FONT_REGULAR)) doc.registerFont('Body', FONT_REGULAR);
  if (fs.existsSync(FONT_BOLD)) doc.registerFont('Body-Bold', FONT_BOLD);
}

// ─── Color Constants ─────────────────────────────────────────────────────────

const BRAND       = '#1E3A5F';
const BRAND_LIGHT = '#E8EEF4';
const TEXT_DARK    = '#1f2937';
const TEXT_MUTED   = '#6b7280';
const WHITE        = '#ffffff';
const ROW_ALT      = '#f9fafb';
const BORDER_GRAY  = '#d1d5db';

// Colorblind-safe palette for risk matrix (matches CrfRiskMatrix.tsx)
const CB_COLORS: Record<CrfRiskLevel, string> = {
  '---': '#d1d5db',
  L0:    '#2166ac',
  L1:    '#fee08b',
  L2:    '#f46d43',
  L3:    '#9e0142',
};
const CB_TEXT: Record<CrfRiskLevel, string> = {
  '---': '#374151',
  L0:    '#ffffff',
  L1:    '#374151',
  L2:    '#ffffff',
  L3:    '#ffffff',
};

// Decision badge colors for reviews
const DECISION_COLORS: Record<string, string> = {
  approved: '#16a34a',
  rejected: '#dc2626',
  returned: '#ca8a04',
};

// ─── Layout helpers ──────────────────────────────────────────────────────────

const PAGE_LEFT  = 50;   // matches doc margin
const CONTENT_W  = 512;  // LETTER width 612 − 2×50

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

// Section title with colored underline
// Ensures enough room for the header + at least 40px of content so headers
// don't appear orphaned at the bottom of a page.
function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 60);
  doc.moveDown(0.8);
  doc.fontSize(13).font('Body-Bold').fillColor(BRAND).text(title);
  const y = doc.y + 2;
  doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_LEFT + CONTENT_W, y)
    .strokeColor(BRAND).lineWidth(1.5).stroke();
  doc.moveDown(0.5);
  doc.font('Body').fillColor(TEXT_DARK).fontSize(10);
}

// Bold label + normal value, inline or block
function labelValue(doc: PDFKit.PDFDocument, label: string, value: string, inline = true) {
  if (inline) {
    doc.font('Body-Bold').text(`${label}: `, { continued: true });
    doc.font('Body').text(value || '-');
  } else {
    doc.font('Body-Bold').text(`${label}:`);
    doc.font('Body').text(value || '-');
    doc.moveDown(0.3);
  }
}

// Rounded-rect inline badge
function drawBadge(
  doc: PDFKit.PDFDocument,
  text: string,
  bgColor: string,
  textColor: string = WHITE,
  x?: number,
  y?: number,
) {
  const bx = x ?? doc.x;
  const by = y ?? doc.y;
  doc.fontSize(9).font('Body-Bold');
  const tw = doc.widthOfString(text);
  const pad = 6;
  const bw = tw + pad * 2;
  const bh = 16;
  doc.save();
  doc.roundedRect(bx, by, bw, bh, 3).fill(bgColor);
  doc.fillColor(textColor).text(text, bx + pad, by + 3, { width: tw + 2, lineBreak: false });
  doc.restore();
  doc.fillColor(TEXT_DARK).font('Body').fontSize(10);
  return { w: bw, h: bh };
}

// Generic table drawing helper
interface TableOptions {
  colWidths: number[];
  headerBg?: string;
  headerColor?: string;
  rowHeight?: number;
  fontSize?: number;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  options: TableOptions,
) {
  const { colWidths, headerBg = BRAND, headerColor = WHITE, fontSize = 9 } = options;
  const minRowH = options.rowHeight ?? 20;
  const tableW = colWidths.reduce((s, w) => s + w, 0);
  const startX = PAGE_LEFT;
  const cellPadX = 4;
  const cellPadY = 5;

  let curY = doc.y;

  // Header row (fixed height — headers are short)
  const headerH = minRowH;
  ensureSpace(doc, headerH + minRowH);
  curY = doc.y;
  doc.save();
  doc.rect(startX, curY, tableW, headerH).fill(headerBg);
  doc.fontSize(fontSize).font('Body-Bold').fillColor(headerColor);
  let cx = startX;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cx + cellPadX, curY + cellPadY, { width: colWidths[i] - cellPadX * 2, lineBreak: false });
    cx += colWidths[i];
  }
  doc.restore();
  curY += headerH;

  // Data rows — measure each row's height dynamically
  for (let r = 0; r < rows.length; r++) {
    // Measure tallest cell in this row
    doc.fontSize(fontSize).font('Body');
    let tallest = 0;
    for (let i = 0; i < rows[r].length; i++) {
      const cellText = rows[r][i] || '-';
      const h = doc.heightOfString(cellText, { width: colWidths[i] - cellPadX * 2 });
      if (h > tallest) tallest = h;
    }
    const rowH = Math.max(minRowH, tallest + cellPadY * 2);

    // Page break check
    if (curY + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      curY = doc.y;
    }

    const bg = r % 2 === 1 ? ROW_ALT : WHITE;
    doc.save();
    doc.rect(startX, curY, tableW, rowH).fill(bg);
    doc.rect(startX, curY, tableW, rowH).strokeColor(BORDER_GRAY).lineWidth(0.5).stroke();
    doc.fontSize(fontSize).font('Body').fillColor(TEXT_DARK);
    cx = startX;
    for (let i = 0; i < rows[r].length; i++) {
      doc.text(rows[r][i] || '-', cx + cellPadX, curY + cellPadY, {
        width: colWidths[i] - cellPadX * 2,
        lineBreak: true,
      });
      cx += colWidths[i];
    }
    doc.restore();
    curY += rowH;
  }

  doc.y = curY + 4;
  doc.x = PAGE_LEFT;
  doc.fillColor(TEXT_DARK).fontSize(10).font('Body');
}

// ─── Risk Matrix Drawing ─────────────────────────────────────────────────────

const HAZARD_ROWS = [
  { label: 'None',     hazL1: 0, hazL2: 0 },
  { label: 'L1 (×1)',  hazL1: 1, hazL2: 0 },
  { label: 'L1 (×2+)', hazL1: 2, hazL2: 0 },
  { label: 'L2',       hazL1: 0, hazL2: 1 },
];
const SIG_COLS = [
  { label: 'None',    sigL0: 0, sigL1: 0, sigL2: 0 },
  { label: 'L0 only', sigL0: 1, sigL1: 0, sigL2: 0 },
  { label: 'L1',      sigL0: 0, sigL1: 1, sigL2: 0 },
  { label: 'L2',      sigL0: 0, sigL1: 0, sigL2: 1 },
];

function currentHazardRow(hazL1: number, hazL2: number): number {
  if (hazL2 >= 1) return 3;
  if (hazL1 >= 2) return 2;
  if (hazL1 === 1) return 1;
  return 0;
}
function currentSigCol(sigL0: number, sigL1: number, sigL2: number): number {
  if (sigL2 >= 1) return 3;
  if (sigL1 >= 1) return 2;
  if (sigL0 >= 1) return 1;
  return 0;
}

function drawShapeInCell(doc: PDFKit.PDFDocument, level: CrfRiskLevel, cx: number, cy: number, textColor: string) {
  const r = 6;
  doc.save();
  switch (level) {
    case '---': // empty circle
      doc.circle(cx, cy, r).strokeColor(textColor).lineWidth(1.5).stroke();
      break;
    case 'L0': // filled circle
      doc.circle(cx, cy, r).fill(textColor);
      break;
    case 'L1': // filled rounded square
      doc.roundedRect(cx - r, cy - r, r * 2, r * 2, 2).fill(textColor);
      break;
    case 'L2': // filled triangle
      doc.save();
      doc.moveTo(cx, cy - r).lineTo(cx + r, cy + r).lineTo(cx - r, cy + r).closePath().fill(textColor);
      doc.restore();
      break;
    case 'L3': // filled diamond
      doc.save();
      doc.moveTo(cx, cy - r).lineTo(cx + r, cy).lineTo(cx, cy + r).lineTo(cx - r, cy).closePath().fill(textColor);
      doc.restore();
      break;
  }
  doc.restore();
}

function drawRiskMatrix(
  doc: PDFKit.PDFDocument,
  answers: { hazard_l1?: Record<string, boolean>; hazard_l2?: Record<string, boolean>; significance_l0?: Record<string, boolean>; significance_l1?: Record<string, boolean>; significance_l2?: Record<string, boolean> },
) {
  const countYes = (obj?: Record<string, boolean>) => Object.values(obj || {}).filter(Boolean).length;
  const hazL1Count = countYes(answers.hazard_l1);
  const hazL2Count = countYes(answers.hazard_l2);
  const sigL0Count = countYes(answers.significance_l0);
  const sigL1Count = countYes(answers.significance_l1);
  const sigL2Count = countYes(answers.significance_l2);

  const activeR = currentHazardRow(hazL1Count, hazL2Count);
  const activeC = currentSigCol(sigL0Count, sigL1Count, sigL2Count);

  const cellW = 80;
  const cellH = 44;
  const labelColW = 70;
  const headerRowH = 22;
  const totalH = headerRowH + cellH * 4 + 30; // +30 for legend

  ensureSpace(doc, totalH + 10);

  const originX = PAGE_LEFT + 30;
  const originY = doc.y;

  // Legend row
  doc.fontSize(8).font('Body').fillColor(TEXT_MUTED);
  let legendX = originX + labelColW;
  const levels: CrfRiskLevel[] = ['---', 'L0', 'L1', 'L2', 'L3'];
  const shapeNames = ['Circle (outline)', 'Circle', 'Square', 'Triangle', 'Diamond'];
  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i];
    // Color swatch
    doc.rect(legendX, originY, 12, 12).fill(CB_COLORS[lvl]);
    drawShapeInCell(doc, lvl, legendX + 6, originY + 6, CB_TEXT[lvl]);
    doc.fillColor(TEXT_MUTED).fontSize(7).font('Body');
    doc.text(`${lvl} ${shapeNames[i]}`, legendX + 16, originY + 2, { lineBreak: false });
    legendX += 90;
  }

  const gridY = originY + 20;

  // Column headers
  doc.fontSize(8).font('Body-Bold').fillColor(TEXT_DARK);
  // Corner label
  doc.fontSize(7).font('Body').fillColor(TEXT_MUTED);
  doc.text('Hazard ↓  Sig →', originX, gridY + 4, { width: labelColW, align: 'right', lineBreak: false });

  for (let ci = 0; ci < SIG_COLS.length; ci++) {
    const hx = originX + labelColW + ci * cellW;
    const isActiveCol = ci === activeC;
    if (isActiveCol) {
      doc.save();
      doc.rect(hx, gridY, cellW, headerRowH).fill('#e5e7eb');
      doc.restore();
    }
    doc.fontSize(8).font('Body-Bold').fillColor(TEXT_DARK);
    doc.text(SIG_COLS[ci].label, hx, gridY + 6, { width: cellW, align: 'center', lineBreak: false });
  }

  const rowStartY = gridY + headerRowH;

  // Draw rows
  for (let ri = 0; ri < HAZARD_ROWS.length; ri++) {
    const ry = rowStartY + ri * cellH;
    const isActiveRow = ri === activeR;

    // Row header
    if (isActiveRow) {
      doc.save();
      doc.rect(originX, ry, labelColW, cellH).fill('#e5e7eb');
      doc.restore();
    }
    doc.fontSize(8).font('Body-Bold').fillColor(TEXT_DARK);
    doc.text(HAZARD_ROWS[ri].label, originX, ry + cellH / 2 - 5, { width: labelColW - 4, align: 'right', lineBreak: false });

    // Cells
    for (let ci = 0; ci < SIG_COLS.length; ci++) {
      const cx = originX + labelColW + ci * cellW;
      const hr = HAZARD_ROWS[ri];
      const sc = SIG_COLS[ci];
      const level = calculateCrfRiskLevel(hr.hazL1, hr.hazL2, sc.sigL0, sc.sigL1, sc.sigL2);
      const isActive = ri === activeR && ci === activeC;
      const bg = CB_COLORS[level];
      const fg = CB_TEXT[level];

      doc.save();
      // Cell fill (dimmed if not active)
      doc.rect(cx, ry, cellW, cellH).fill(bg);
      if (!isActive) {
        // Overlay semi-transparent white for 50% opacity effect
        doc.rect(cx, ry, cellW, cellH).fillOpacity(0.5).fill(WHITE);
      }
      doc.fillOpacity(1);

      // Active cell: thick dark border ring
      if (isActive) {
        doc.rect(cx + 1.5, ry + 1.5, cellW - 3, cellH - 3)
          .strokeColor('#1f2937').lineWidth(2.5).stroke();
      }

      // Shape
      drawShapeInCell(doc, level, cx + cellW / 2, ry + cellH / 2 - 5, isActive ? fg : fg);

      // Level text
      doc.fontSize(9).font('Body-Bold').fillColor(isActive ? fg : fg);
      doc.text(level, cx, ry + cellH / 2 + 4, { width: cellW, align: 'center', lineBreak: false });

      doc.restore();

      // Cell border
      doc.save();
      doc.rect(cx, ry, cellW, cellH).strokeColor(BORDER_GRAY).lineWidth(0.5).stroke();
      doc.restore();
    }
  }

  doc.y = rowStartY + HAZARD_ROWS.length * cellH + 8;
  doc.x = PAGE_LEFT;
  doc.fillColor(TEXT_DARK).font('Body').fontSize(10);
}

// ─── Attachment helpers ──────────────────────────────────────────────────────

function embedImages(doc: PDFKit.PDFDocument, attachments: any[]) {
  const imageAttachments = attachments.filter(a =>
    ['image/jpeg', 'image/png'].includes(a.mime_type)
  );
  if (imageAttachments.length === 0) return;

  sectionTitle(doc, 'Attached Images');
  for (const att of imageAttachments) {
    const filePath = path.join(UPLOAD_DIR, att.filename);
    if (!fs.existsSync(filePath)) continue;

    try {
      // Read the image buffer to let PDFKit measure its natural size
      const imgBuf = fs.readFileSync(filePath);
      const img = (doc as any).openImage(imgBuf);
      const imgWidth = Math.min(img.width, CONTENT_W);
      const scale = imgWidth / img.width;
      const imgHeight = img.height * scale;

      // Space needed: caption (~24px) + image + padding
      const needed = 28 + imgHeight + 8;
      ensureSpace(doc, needed);

      doc.font('Body-Bold').fontSize(9).fillColor(TEXT_DARK).text(att.original_name);
      doc.fontSize(8).font('Body').fillColor(TEXT_MUTED).text(
        `Uploaded by ${att.uploader_name} on ${new Date(att.created_at).toLocaleDateString()}`
      );
      doc.fillColor(TEXT_DARK);
      doc.moveDown(0.3);

      doc.image(img, { width: imgWidth });
      doc.moveDown(0.5);
    } catch {
      doc.text(`[Image could not be embedded: ${att.original_name}]`);
      doc.moveDown(0.3);
    }
  }
}

function listAttachments(doc: PDFKit.PDFDocument, attachments: any[]) {
  const nonImage = attachments.filter(a =>
    !['image/jpeg', 'image/png'].includes(a.mime_type)
  );
  if (nonImage.length === 0) return;

  sectionTitle(doc, 'Other Attachments');

  const iconW = 28;
  const detailX = PAGE_LEFT + iconW + 8;
  const detailW = CONTENT_W - iconW - 8;
  const rowPad = 6;

  for (const att of nonImage) {
    const sizeStr = att.size >= 1048576
      ? `${(att.size / 1048576).toFixed(1)} MB`
      : `${(att.size / 1024).toFixed(1)} KB`;
    const ext = (att.original_name || '').split('.').pop()?.toUpperCase() || '?';
    const isPdf = att.mime_type === 'application/pdf';

    // Measure name height for tall filenames
    doc.fontSize(9).font('Body-Bold');
    const nameH = doc.heightOfString(att.original_name, { width: detailW });
    const rowH = Math.max(36, nameH + 20 + rowPad * 2);

    ensureSpace(doc, rowH + 4);
    const ry = doc.y;

    // Row background
    doc.save();
    doc.roundedRect(PAGE_LEFT, ry, CONTENT_W, rowH, 3)
      .fillAndStroke('#f8fafc', BORDER_GRAY);
    doc.restore();

    // File type icon box
    const iconColor = isPdf ? '#dc2626' : BRAND;
    doc.save();
    doc.roundedRect(PAGE_LEFT + rowPad, ry + (rowH - 24) / 2, iconW, 24, 3).fill(iconColor);
    doc.fontSize(8).font('Body-Bold').fillColor(WHITE);
    doc.text(ext, PAGE_LEFT + rowPad, ry + (rowH - 24) / 2 + 7, { width: iconW, align: 'center', lineBreak: false });
    doc.restore();

    // File name
    doc.fontSize(9).font('Body-Bold').fillColor(TEXT_DARK)
      .text(att.original_name, detailX, ry + rowPad, { width: detailW });

    // Meta line: size + uploader + date
    const metaY = ry + rowPad + nameH + 2;
    doc.fontSize(8).font('Body').fillColor(TEXT_MUTED)
      .text(`${sizeStr}  •  ${att.uploader_name}  •  ${new Date(att.created_at).toLocaleDateString()}`, detailX, metaY, { width: detailW });

    doc.y = ry + rowH + 4;
    doc.x = PAGE_LEFT;
  }
  doc.fillColor(TEXT_DARK).font('Body').fontSize(10);
}

// ─── Question group table helper ─────────────────────────────────────────────

function drawQuestionGroup(
  doc: PDFKit.PDFDocument,
  groupTitle: string,
  questionKeys: readonly string[],
  answersObj: Record<string, boolean> | undefined,
  labelsMap: Record<string, string>,
) {
  const entries = questionKeys.map(key => ({
    label: labelsMap[key] || key,
    answer: answersObj?.[key] ?? false,
  }));
  const yesCount = entries.filter(e => e.answer).length;

  // Ensure room for group title + table header + at least one row
  const qColW = CONTENT_W - 60;
  const aColW = 60;
  const cellPad = 4;
  const minRowH = 22;
  const headerH = 18;

  ensureSpace(doc, 16 + headerH + minRowH);
  doc.font('Body-Bold').fontSize(10).fillColor(BRAND).text(groupTitle);
  doc.moveDown(0.2);

  let curY = doc.y;
  // Header
  doc.save();
  doc.rect(PAGE_LEFT, curY, CONTENT_W, headerH).fill(BRAND);
  doc.fontSize(8).font('Body-Bold').fillColor(WHITE);
  doc.text('Question', PAGE_LEFT + cellPad, curY + 4, { width: qColW - cellPad * 2, lineBreak: false });
  doc.text('Answer', PAGE_LEFT + qColW + cellPad, curY + 4, { width: aColW - cellPad * 2, lineBreak: false });
  doc.restore();
  curY += headerH;

  for (let i = 0; i < entries.length; i++) {
    // Measure question text height
    doc.fontSize(8).font('Body');
    const textH = doc.heightOfString(entries[i].label, { width: qColW - cellPad * 2 });
    const rowH = Math.max(minRowH, textH + cellPad * 2);

    if (curY + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      curY = doc.y;
    }
    const bg = i % 2 === 1 ? ROW_ALT : WHITE;
    doc.save();
    doc.rect(PAGE_LEFT, curY, CONTENT_W, rowH).fill(bg);
    doc.rect(PAGE_LEFT, curY, CONTENT_W, rowH).strokeColor(BORDER_GRAY).lineWidth(0.3).stroke();

    // Question text
    doc.fontSize(8).font('Body').fillColor(TEXT_DARK);
    doc.text(entries[i].label, PAGE_LEFT + cellPad, curY + cellPad, { width: qColW - cellPad * 2, lineBreak: true });

    // Answer — vertically centered in the row
    const answerY = curY + rowH / 2 - 5;
    const ans = entries[i].answer;
    if (ans) {
      doc.fontSize(9).font('Body-Bold').fillColor('#16a34a');
      doc.text('■ Yes', PAGE_LEFT + qColW + cellPad, answerY, { width: aColW - cellPad * 2, lineBreak: false });
    } else {
      doc.fontSize(9).font('Body').fillColor(TEXT_MUTED);
      doc.text('No', PAGE_LEFT + qColW + cellPad, answerY, { width: aColW - cellPad * 2, lineBreak: false });
    }
    doc.restore();
    curY += rowH;
  }

  // Subtotal
  doc.fontSize(8).font('Body').fillColor(TEXT_MUTED);
  doc.y = curY + 2;
  doc.x = PAGE_LEFT;
  doc.text(`${yesCount} of ${entries.length} answered Yes`, { align: 'right' });
  doc.moveDown(0.4);
  doc.fillColor(TEXT_DARK).fontSize(10).font('Body');
}

// ─── MOC PDF Export ──────────────────────────────────────────────────────────

router.get('/moc/:id/pdf', authenticate, async (req: Request, res: Response) => {
  try {
    const moc = await db('moc_requests')
      .join('users', 'moc_requests.created_by', 'users.id')
      .leftJoin('users as transferee', 'moc_requests.transferred_to', 'transferee.id')
      .leftJoin('moc_templates', 'moc_requests.template_id', 'moc_templates.id')
      .select(
        'moc_requests.*',
        'users.name as creator_name',
        'transferee.name as transferred_to_name',
        'moc_templates.name as template_name'
      )
      .where('moc_requests.id', req.params.id)
      .first();

    if (!moc) {
      res.status(404).json({ message: 'MOC not found' });
      return;
    }

    const [risks, reviews, timeline, attachments] = await Promise.all([
      db('risk_assessments')
        .join('users', 'risk_assessments.assessed_by', 'users.id')
        .select('risk_assessments.*', 'users.name as assessor_name')
        .where('moc_id', moc.id),
      db('reviews')
        .join('users', 'reviews.reviewer_id', 'users.id')
        .select('reviews.*', 'users.name as reviewer_name')
        .where('moc_id', moc.id)
        .orderBy('reviews.created_at', 'desc'),
      db('workflow_history')
        .join('users', 'workflow_history.changed_by', 'users.id')
        .select('workflow_history.*', 'users.name as changer_name')
        .where('moc_id', moc.id)
        .orderBy('workflow_history.created_at', 'asc'),
      db('attachments')
        .join('users', 'attachments.uploaded_by', 'users.id')
        .select('attachments.*', 'users.name as uploader_name')
        .where('entity_type', 'moc')
        .where('entity_id', moc.id),
    ]);

    const doc = new PDFDocument({ size: 'LETTER', margin: 50, bufferPages: true });
    registerBodyFonts(doc);

    // Determine if we need a ZIP (has non-image attachments) or plain PDF
    const hasFiles = attachments.some(a => !['image/jpeg', 'image/png'].includes(a.mime_type));
    // Use the public MOC number (e.g. MOC-2026-001-L2) for the filename so it
    // matches what users see in the UI. Fall back to the internal id only if
    // moc_number is missing (legacy rows pre-widening).
    const fileBase = (moc.moc_number || `MOC-${moc.id}`).replace(/[^A-Za-z0-9._-]/g, '_');
    const pdfFilename = `${fileBase}.pdf`;

    let pdfStream: PassThrough | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let archive: any;

    if (hasFiles) {
      // ZIP mode: PDF + attachments folder
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.zip"`);

      archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('error', (err: Error) => { throw err; });
      archive.pipe(res);

      // PDF goes into a PassThrough so archiver can consume it
      pdfStream = new PassThrough();
      doc.pipe(pdfStream);
    } else {
      // Plain PDF (no non-image attachments)
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
      doc.pipe(res);
    }

    // ── Page 1: Cover / Header Block ─────────────────────────────────────

    doc.fontSize(22).font('Body-Bold').fillColor(BRAND)
      .text('Management of Change Report', { align: 'center' });
    doc.moveDown(0.15);
    doc.fontSize(12).font('Body').fillColor(TEXT_MUTED)
      .text(moc.moc_number || `MOC-${moc.id}`, { align: 'center' });
    doc.moveDown(0.6);
    doc.fontSize(17).font('Body-Bold').fillColor(TEXT_DARK)
      .text(moc.title, { align: 'center' });
    doc.moveDown(1);

    // Summary info box
    const boxY = doc.y;
    const boxH = moc.form_version === 'crf_v1' ? 115 : 80;
    doc.save();
    doc.roundedRect(PAGE_LEFT, boxY, CONTENT_W, boxH, 4).fill(BRAND_LIGHT);
    doc.restore();

    const col1X = PAGE_LEFT + 12;
    const col2X = PAGE_LEFT + CONTENT_W / 3;
    const col3X = PAGE_LEFT + (CONTENT_W * 2) / 3;
    const colW = CONTENT_W / 3 - 16; // max width per column to prevent overlap
    let infoY = boxY + 10;

    const drawInfoPair = (x: number, y: number, label: string, value: string) => {
      doc.fontSize(8).font('Body').fillColor(TEXT_MUTED).text(label, x, y, { width: colW, lineBreak: false });
      doc.fontSize(10).font('Body-Bold').fillColor(TEXT_DARK).text(value || '-', x, y + 11, { width: colW, lineBreak: true, height: 24, ellipsis: true });
    };

    drawInfoPair(col1X, infoY, 'STATUS', formatStatus(moc.status));
    drawInfoPair(col2X, infoY, 'TEMPLATE', moc.template_name || 'None');
    drawInfoPair(col3X, infoY, 'CREATED BY', moc.creator_name);
    infoY += 30;
    drawInfoPair(col1X, infoY, 'DATE', new Date(moc.created_at).toLocaleDateString());

    if (moc.form_version === 'crf_v1') {
      const crfTypeLabel = CRF_CHANGE_TYPE_LABELS[moc.crf_change_type as keyof typeof CRF_CHANGE_TYPE_LABELS] || moc.crf_change_type || '-';
      const durLabel = CRF_CHANGE_DURATION_LABELS[moc.change_duration as keyof typeof CRF_CHANGE_DURATION_LABELS] || moc.change_duration || '-';
      drawInfoPair(col2X, infoY, 'CHANGE TYPE', crfTypeLabel);
      drawInfoPair(col3X, infoY, 'DURATION', durLabel);
      infoY += 30;
      const riskLvl = (moc.crf_risk_level || '---') as CrfRiskLevel;
      const riskAnswers = typeof moc.crf_risk_answers === 'string' ? JSON.parse(moc.crf_risk_answers) : moc.crf_risk_answers;
      const riskLabel = `${riskLvl} — ${getCrfRiskDescription(riskLvl, riskAnswers)}`;
      drawInfoPair(col1X, infoY, 'RISK LEVEL', riskLabel);
      drawInfoPair(col2X, infoY, 'PSM RELEVANT', moc.is_psm_relevant ? 'Yes' : 'No');
      drawInfoPair(col3X, infoY, 'EMERGENCY', moc.emergency_change ? 'Yes' : 'No');
    } else {
      drawInfoPair(col2X, infoY, 'CHANGE TYPE', (moc.change_type || '-').replace(/_/g, ' '));
      if (moc.risk_level) {
        drawInfoPair(col3X, infoY, 'RISK LEVEL', moc.risk_level.toUpperCase());
      }
    }

    doc.y = boxY + boxH + 12;
    doc.x = PAGE_LEFT;

    if (moc.transferred_to_name) {
      doc.fontSize(9).font('Body-Bold').fillColor(BRAND)
        .text('Transferred to: ', { continued: true });
      doc.font('Body').fillColor(TEXT_DARK).text(moc.transferred_to_name);
      doc.moveDown(0.4);
    }

    // Generation timestamp
    doc.fontSize(8).fillColor(TEXT_MUTED).font('Body')
      .text(`Generated ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(0.5);

    // ── Description & Justification ──────────────────────────────────────

    sectionTitle(doc, 'Description');
    doc.fontSize(10).font('Body').fillColor(TEXT_DARK);
    doc.text(moc.description || 'No description provided.', { lineGap: 3 });
    doc.moveDown(0.5);

    if (moc.justification) {
      sectionTitle(doc, 'Justification');
      doc.fontSize(10).font('Body').fillColor(TEXT_DARK);
      doc.text(moc.justification, { lineGap: 3 });
      doc.moveDown(0.5);
    }

    // ── Departments (badges) ─────────────────────────────────────────────

    if (moc.departments_involved && moc.departments_involved.length > 0) {
      sectionTitle(doc, 'Departments Involved');
      let badgeX = PAGE_LEFT;
      const badgeY = doc.y;
      for (const d of moc.departments_involved) {
        const label = DEPARTMENT_LABELS[d as keyof typeof DEPARTMENT_LABELS] || d;
        const { w } = drawBadge(doc, label, BRAND, WHITE, badgeX, badgeY);
        badgeX += w + 6;
        if (badgeX > PAGE_LEFT + CONTENT_W - 80) {
          badgeX = PAGE_LEFT;
        }
      }
      doc.y = badgeY + 24;
      doc.x = PAGE_LEFT;
      doc.moveDown(0.3);
    }

    // ── CRF-specific sections ────────────────────────────────────────────

    if (moc.form_version === 'crf_v1') {
      // Risk Assessment Questionnaire
      if (moc.crf_risk_answers) {
        sectionTitle(doc, 'Risk Assessment Questionnaire');
        const answers = moc.crf_risk_answers;

        drawQuestionGroup(doc, 'Degree of Hazard — Level 1', CRF_HAZARD_L1_QUESTIONS, answers.hazard_l1, CRF_HAZARD_QUESTION_LABELS);
        drawQuestionGroup(doc, 'Degree of Hazard — Level 2', CRF_HAZARD_L2_QUESTIONS, answers.hazard_l2, CRF_HAZARD_QUESTION_LABELS);
        drawQuestionGroup(doc, 'Degree of Significance — Level 0', CRF_SIGNIFICANCE_L0_QUESTIONS, answers.significance_l0, CRF_SIGNIFICANCE_QUESTION_LABELS);
        drawQuestionGroup(doc, 'Degree of Significance — Level 1', CRF_SIGNIFICANCE_L1_QUESTIONS, answers.significance_l1, CRF_SIGNIFICANCE_QUESTION_LABELS);
        drawQuestionGroup(doc, 'Degree of Significance — Level 2', CRF_SIGNIFICANCE_L2_QUESTIONS, answers.significance_l2, CRF_SIGNIFICANCE_QUESTION_LABELS);

        // Calculated risk level badge
        doc.moveDown(0.3);
        const riskLvl = (moc.crf_risk_level || '---') as CrfRiskLevel;
        const riskColor = CRF_RISK_LEVEL_COLORS[riskLvl] || '#9ca3af';
        doc.font('Body-Bold').fontSize(11).fillColor(TEXT_DARK).text('Calculated Risk Level: ', { continued: true });
        doc.font('Body').text('');
        const riskAnswersForBadge = typeof moc.crf_risk_answers === 'string' ? JSON.parse(moc.crf_risk_answers) : moc.crf_risk_answers;
        drawBadge(doc, `${riskLvl} — ${getCrfRiskDescription(riskLvl, riskAnswersForBadge)}`, riskColor, WHITE);
        doc.moveDown(0.3);

        // Reason
        const countYes = (obj?: Record<string, boolean>) => Object.values(obj || {}).filter(Boolean).length;
        const reason = getCrfRiskReason(
          countYes(answers.hazard_l1), countYes(answers.hazard_l2),
          countYes(answers.significance_l0), countYes(answers.significance_l1), countYes(answers.significance_l2),
        );
        if (reason) {
          doc.fontSize(9).font('Body').fillColor(TEXT_MUTED).text(`Reason: ${reason}`);
        }
        doc.moveDown(0.5);
      }

      // ── Risk Matrix ────────────────────────────────────────────────────
      if (moc.crf_risk_answers) {
        sectionTitle(doc, 'Risk Matrix');
        drawRiskMatrix(doc, moc.crf_risk_answers);
        doc.moveDown(0.5);
      }

      // ── Impact Assessment ──────────────────────────────────────────────
      if (moc.impact_assessment && moc.impact_assessment.length > 0) {
        sectionTitle(doc, 'Impact Assessment');
        const headers = ['Area', 'Affected?', 'Description'];
        const colWidths = [150, 60, CONTENT_W - 210];
        const rows = moc.impact_assessment.map((item: any) => {
          const areaLabel = CRF_IMPACT_AREA_LABELS[item.area as keyof typeof CRF_IMPACT_AREA_LABELS] || item.area;
          return [areaLabel, item.affected ? 'YES' : 'No', item.affected ? (item.description || '-') : '-'];
        });
        drawTable(doc, headers, rows, { colWidths });
      }

      // ── Implementation Plan ────────────────────────────────────────────
      if (moc.implementation_tasks && moc.implementation_tasks.length > 0) {
        sectionTitle(doc, 'Implementation Plan');
        const headers = ['Task', 'Assigned To', 'Target Date', 'Completed', 'Status'];
        const colWidths = [160, 90, 80, 80, CONTENT_W - 410];
        const rows = moc.implementation_tasks.map((task: any) => {
          const taskLabel = CRF_IMPLEMENTATION_TASK_LABELS[task.task_type as keyof typeof CRF_IMPLEMENTATION_TASK_LABELS] || task.task_type;
          return [
            taskLabel,
            task.assigned_to || '-',
            task.target_date ? new Date(task.target_date).toLocaleDateString() : '-',
            task.completion_date ? new Date(task.completion_date).toLocaleDateString() : '-',
            formatStatus(task.status || '-'),
          ];
        });
        drawTable(doc, headers, rows, { colWidths });
      }

      // ── Post-Implementation Verification ───────────────────────────────
      if (moc.post_impl_verifications && moc.post_impl_verifications.length > 0) {
        sectionTitle(doc, 'Post-Implementation Verification');
        const headers = ['Activity', 'Verified By', 'Date', 'Comments'];
        const colWidths = [160, 100, 80, CONTENT_W - 340];
        const rows = moc.post_impl_verifications.map((v: any) => [
          v.activity || '-',
          v.verified_by || '-',
          v.date || '-',
          v.comments || '-',
        ]);
        drawTable(doc, headers, rows, { colWidths });
      }
    } else {
      // EHS Assessment section intentionally omitted from print output
      // (per 2026-05-01 change request — EHS reviews live in the workflow,
      // not the printed report).

      // Legacy: Affected Areas
      if (moc.affected_areas && moc.affected_areas.length > 0) {
        sectionTitle(doc, 'Affected Areas');
        doc.text(moc.affected_areas.join(', '));
      }
    }

    // ── Risk Assessments (legacy 5×5) ────────────────────────────────────
    if (risks.length > 0 && moc.form_version !== 'crf_v1') {
      sectionTitle(doc, 'Risk Assessments');
      const headers = ['Hazard', 'Severity', 'Likelihood', 'Risk', 'Controls', 'Assessor'];
      const colWidths = [110, 80, 80, 60, 110, CONTENT_W - 440];
      const rows = risks.map((ra: any) => {
        const sevLabel = SEVERITY_LABELS[ra.severity as keyof typeof SEVERITY_LABELS] || ra.severity;
        const likLabel = LIKELIHOOD_LABELS[ra.likelihood as keyof typeof LIKELIHOOD_LABELS] || ra.likelihood;
        const level = getRiskLevel(ra.severity, ra.likelihood);
        return [ra.hazard || '-', sevLabel, likLabel, level.toUpperCase(), ra.controls || '-', ra.assessor_name];
      });
      drawTable(doc, headers, rows, { colWidths });
    }

    // ── Reviews (card-style) ─────────────────────────────────────────────
    if (reviews.length > 0) {
      sectionTitle(doc, 'Reviews');
      const cardPad = 8;
      const headerLineH = 16;

      for (const rev of reviews) {
        // Measure comment height to size the card
        let commentH = 0;
        const commentW = CONTENT_W - cardPad * 2;
        if (rev.comments) {
          doc.fontSize(9).font('Helvetica-Oblique');
          commentH = doc.heightOfString(`"${rev.comments}"`, { width: commentW }) + 4;
        }
        const cardH = headerLineH + commentH + cardPad * 2;

        ensureSpace(doc, cardH + 4);
        const cardY = doc.y;

        // Card background
        doc.save();
        doc.roundedRect(PAGE_LEFT, cardY, CONTENT_W, cardH, 3)
          .fillAndStroke('#f8fafc', BORDER_GRAY);
        doc.restore();

        // Reviewer name + decision + date
        doc.fontSize(10).font('Body-Bold').fillColor(TEXT_DARK)
          .text(rev.reviewer_name, PAGE_LEFT + cardPad, cardY + cardPad, { continued: true });

        const decColor = DECISION_COLORS[rev.decision] || TEXT_MUTED;
        doc.font('Body-Bold').fillColor(decColor)
          .text(`  ${rev.decision.toUpperCase()}`, { continued: true });

        doc.font('Body').fillColor(TEXT_MUTED).fontSize(9)
          .text(`  ${new Date(rev.created_at).toLocaleDateString()}`);

        // Comments
        if (rev.comments) {
          doc.fontSize(9).font('Helvetica-Oblique').fillColor(TEXT_MUTED)
            .text(`"${rev.comments}"`, PAGE_LEFT + cardPad, cardY + cardPad + headerLineH + 2, { width: commentW });
        }

        doc.y = cardY + cardH + 4;
        doc.x = PAGE_LEFT;
      }
      doc.fillColor(TEXT_DARK).font('Body').fontSize(10);
      doc.moveDown(0.3);
    }

    // ── Workflow Timeline (vertical) ─────────────────────────────────────
    if (timeline.length > 0) {
      sectionTitle(doc, 'Workflow Timeline');
      const dotR = 4;
      const lineX = PAGE_LEFT + 80;
      const commentX = lineX + 12;
      const commentW = CONTENT_W - (lineX - PAGE_LEFT) - 12;
      const headerBlockH = 26; // transition text + changer name

      for (let i = 0; i < timeline.length; i++) {
        const entry = timeline[i];

        // Measure comment height
        let commentH = 0;
        if (entry.comment) {
          doc.fontSize(8).font('Helvetica-Oblique');
          commentH = doc.heightOfString(`"${entry.comment}"`, { width: commentW }) + 2;
        }
        const entryH = headerBlockH + commentH + 6; // 6px bottom padding

        ensureSpace(doc, entryH);
        const ey = doc.y;

        // Date on left
        const dateStr = new Date(entry.created_at).toLocaleDateString();
        doc.fontSize(8).font('Body').fillColor(TEXT_MUTED)
          .text(dateStr, PAGE_LEFT, ey + 2, { width: 72, align: 'right', lineBreak: false });

        // Dot
        doc.circle(lineX, ey + 6, dotR).fill(BRAND);

        // Vertical line to next entry (except last)
        if (i < timeline.length - 1) {
          doc.moveTo(lineX, ey + 6 + dotR).lineTo(lineX, ey + entryH)
            .strokeColor(BORDER_GRAY).lineWidth(1).stroke();
        }

        // Transition text
        let transText: string;
        if (entry.from_status) {
          transText = `${formatStatus(entry.from_status)} → ${formatStatus(entry.to_status)}`;
        } else {
          transText = 'Created MOC';
        }
        doc.fontSize(10).font('Body-Bold').fillColor(TEXT_DARK)
          .text(transText, commentX, ey, { width: commentW, lineBreak: true });
        doc.fontSize(9).font('Body').fillColor(TEXT_MUTED)
          .text(entry.changer_name, commentX, ey + 13, { lineBreak: false });

        // Comment indented below
        if (entry.comment) {
          doc.fontSize(8).font('Helvetica-Oblique').fillColor(TEXT_MUTED)
            .text(`"${entry.comment}"`, commentX, ey + headerBlockH, { width: commentW });
        }

        doc.y = ey + entryH;
        doc.x = PAGE_LEFT;
      }
      doc.fillColor(TEXT_DARK).font('Body').fontSize(10);
      doc.moveDown(0.3);
    }

    // ── Improvement Expected & Realized ────────────────────────────────
    if (moc.scope_baseline && Array.isArray(moc.scope_baseline) && moc.scope_baseline.length > 0) {
      sectionTitle(doc, 'Improvement Expected & Realized');
      const baseline = moc.scope_baseline as { name: string; value: number | null; unit: string }[];
      const postChange = (moc.scope_post_change || []) as { name: string; value: number | null; unit: string }[];
      const realized = (moc.scope_realized || []) as { name: string; value: number | null; unit: string }[];

      // Comparison table
      const scopeHeaders = ['Parameter', 'Unit', 'Baseline', 'Expected', 'Realized', 'Delta', '% Change'];
      const scopeColWidths = [100, 50, 65, 65, 65, 65, CONTENT_W - 410];
      const scopeRows = baseline.map((bp, i) => {
        const pp = postChange[i];
        const rp = realized[i];
        const bv = bp.value;
        const rv = rp?.value ?? null;
        let delta = '-';
        let pctChange = '-';
        if (bv != null && rv != null) {
          const d = rv - bv;
          delta = `${d >= 0 ? '+' : ''}${Number.isInteger(d) ? d : d.toFixed(2)}`;
          if (bv !== 0) {
            const pct = ((rv - bv) / Math.abs(bv)) * 100;
            pctChange = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
          } else {
            pctChange = rv === 0 ? '0%' : 'N/A';
          }
        }
        return [
          bp.name,
          bp.unit || '-',
          bv != null ? String(bv) : '-',
          pp?.value != null ? String(pp.value) : 'pending',
          rv != null ? String(rv) : 'pending',
          delta,
          pctChange,
        ];
      });
      drawTable(doc, scopeHeaders, scopeRows, { colWidths: scopeColWidths });

      // Simple grouped bar chart drawn with PDFKit
      const hasPostData = postChange.some((p) => p?.value != null);
      if (hasPostData) {
        ensureSpace(doc, 200);
        doc.moveDown(0.5);
        doc.font('Body-Bold').fontSize(10).fillColor(BRAND).text('Visual Comparison');
        doc.moveDown(0.3);

        const chartX = PAGE_LEFT + 40;
        const chartW = CONTENT_W - 80;
        const chartH = 140;
        const chartY = doc.y;

        // Determine max value for scale
        let maxVal = 0;
        for (const bp of baseline) {
          if (bp.value != null && Math.abs(bp.value) > maxVal) maxVal = Math.abs(bp.value);
        }
        for (const pp of postChange) {
          if (pp?.value != null && Math.abs(pp.value) > maxVal) maxVal = Math.abs(pp.value);
        }
        if (maxVal === 0) maxVal = 1;

        const paramCount = baseline.length;
        const groupW = chartW / paramCount;
        const barW = Math.min(groupW * 0.3, 30);
        const gap = 3;

        // Y axis line
        doc.save();
        doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartH).strokeColor(BORDER_GRAY).lineWidth(0.5).stroke();
        // X axis line
        doc.moveTo(chartX, chartY + chartH).lineTo(chartX + chartW, chartY + chartH).strokeColor(BORDER_GRAY).lineWidth(0.5).stroke();

        for (let i = 0; i < paramCount; i++) {
          const bp = baseline[i];
          const pp = postChange[i];
          const cx = chartX + i * groupW + groupW / 2;

          // Baseline bar
          if (bp.value != null) {
            const bh = (bp.value / maxVal) * (chartH - 20);
            doc.rect(cx - barW - gap / 2, chartY + chartH - bh, barW, bh).fill('#6b7280');
          }

          // Post-change bar
          if (pp?.value != null) {
            const ph = (pp.value / maxVal) * (chartH - 20);
            const barColor = bp.value != null
              ? (pp.value > bp.value ? '#16a34a' : pp.value < bp.value ? '#dc2626' : '#6b7280')
              : '#3b82f6';
            doc.rect(cx + gap / 2, chartY + chartH - ph, barW, ph).fill(barColor);
          }

          // Label
          doc.fontSize(7).font('Body').fillColor(TEXT_DARK);
          doc.text(bp.name, cx - groupW / 2, chartY + chartH + 3, { width: groupW, align: 'center', lineBreak: false });
        }

        // Legend
        const legendY = chartY + chartH + 16;
        doc.rect(chartX, legendY, 10, 10).fill('#6b7280');
        doc.fontSize(7).font('Body').fillColor(TEXT_DARK).text('Baseline', chartX + 14, legendY + 1, { lineBreak: false });
        doc.rect(chartX + 70, legendY, 10, 10).fill('#3b82f6');
        doc.text('Post-Change', chartX + 84, legendY + 1, { lineBreak: false });

        doc.restore();
        doc.y = legendY + 18;
        doc.x = PAGE_LEFT;
        doc.fillColor(TEXT_DARK).font('Body').fontSize(10);
      }
    }

    // ── Attachments ──────────────────────────────────────────────────────
    embedImages(doc, attachments);
    listAttachments(doc, attachments);

    // ── Page numbers (Page X of Y) ───────────────────────────────────────
    // Use an addPage listener approach: intercept and prevent any new pages
    // that PDFKit tries to auto-create while we write footer text in the
    // margin area. We save/restore Y and also patch addPage temporarily.
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    const realAddPage = doc.addPage.bind(doc);
    // Block auto-pagination during footer writing
    doc.addPage = () => doc;
    for (let i = range.start; i < range.start + totalPages; i++) {
      doc.switchToPage(i);
      const savedY = doc.y;
      doc.fontSize(8).font('Body').fillColor(TEXT_MUTED);
      doc.text(
        `Page ${i + 1} of ${totalPages}`,
        PAGE_LEFT, doc.page.height - 30,
        { width: CONTENT_W, align: 'center', lineBreak: false },
      );
      doc.y = savedY;
    }
    // Restore addPage and switch to last real page
    doc.addPage = realAddPage;
    doc.switchToPage(range.start + totalPages - 1);

    doc.end();

    // If ZIP mode, append the PDF and all attachment files to the archive
    if (archive && pdfStream) {
      archive.append(pdfStream, { name: pdfFilename });

      // Add all attachment files under an "attachments/" folder
      for (const att of attachments) {
        const filePath = path.join(UPLOAD_DIR, att.filename);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: `attachments/${att.original_name}` });
        }
      }

      await archive.finalize();
    }
  } catch (err) {
    console.error('MOC PDF export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// ─── EHS Incident PDF Export ─────────────────────────────────────────────────

router.get('/ehs-incident/:id/pdf', authenticate, async (req: Request, res: Response) => {
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

    const attachments = await db('attachments')
      .join('users', 'attachments.uploaded_by', 'users.id')
      .select('attachments.*', 'users.name as uploader_name')
      .where('entity_type', 'ehs_incident')
      .where('entity_id', incident.id);

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    registerBodyFonts(doc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="EHS-Incident-${incident.id}.pdf"`);
    doc.pipe(res);

    // Title
    doc.fontSize(20).font('Body-Bold').fillColor('#1E3A5F')
      .text(`EHS Incident Report #${incident.id}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(16).font('Body').fillColor('#333333')
      .text(incident.title, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#777777')
      .text(`Generated ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // General Info
    sectionTitle(doc, 'Incident Details');
    const sevLabel = INCIDENT_SEVERITY_LABELS[incident.severity as keyof typeof INCIDENT_SEVERITY_LABELS] || incident.severity;
    const statusLabel = INCIDENT_STATUS_LABELS[incident.status as keyof typeof INCIDENT_STATUS_LABELS] || incident.status;

    labelValue(doc, 'Status', statusLabel);
    labelValue(doc, 'Severity', sevLabel);
    labelValue(doc, 'Type', (incident.incident_type || '').replace(/_/g, ' '));
    labelValue(doc, 'Incident Date', incident.incident_date ? new Date(incident.incident_date).toLocaleDateString() : '-');
    labelValue(doc, 'Location', incident.location || '-');
    labelValue(doc, 'Reported By', incident.reporter_name);
    labelValue(doc, 'Assigned To', incident.assignee_name || 'Unassigned');
    if (incident.affected_persons) {
      labelValue(doc, 'Affected Persons', incident.affected_persons);
    }
    if (incident.moc_id) {
      labelValue(doc, 'Related MOC', `#${incident.moc_id} ${incident.moc_title || ''}`);
    }
    labelValue(doc, 'Created', new Date(incident.created_at).toLocaleString());

    // Description
    sectionTitle(doc, 'Description');
    doc.text(incident.description || 'No description provided.');

    // Root Cause
    sectionTitle(doc, 'Root Cause');
    doc.text(incident.root_cause || 'Not yet determined.');

    // Corrective Actions
    sectionTitle(doc, 'Corrective Actions');
    doc.text(incident.corrective_actions || 'None documented yet.');

    // Embedded images
    embedImages(doc, attachments);

    // Non-image attachments list
    listAttachments(doc, attachments);

    doc.end();
  } catch (err) {
    console.error('EHS Incident PDF export error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Improvements CSV Export ─────────────────────────────────────────────────

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

router.get('/improvements/csv', authenticate, async (req: Request, res: Response) => {
  try {
    const mocs = await db('moc_requests')
      .join('users', 'moc_requests.created_by', 'users.id')
      .select(
        'moc_requests.id', 'moc_requests.moc_number', 'moc_requests.title',
        'moc_requests.status', 'moc_requests.created_at', 'moc_requests.updated_at',
        'moc_requests.scope_baseline', 'moc_requests.scope_post_change', 'moc_requests.scope_realized',
        'users.name as creator_name'
      )
      .whereNotNull('moc_requests.scope_baseline');

    const headers = [
      'MOC Number', 'Title', 'Status', 'Creator', 'Created Date',
      'Parameter', 'Unit', 'Baseline', 'Expected', 'Realized',
      'Delta (Expected)', 'Delta (Realized)', '% Change (Realized)',
    ];

    const rows: string[][] = [];

    for (const moc of mocs) {
      const baseline = (typeof moc.scope_baseline === 'string' ? JSON.parse(moc.scope_baseline) : moc.scope_baseline) || [];
      const postChange = (typeof moc.scope_post_change === 'string' ? JSON.parse(moc.scope_post_change) : moc.scope_post_change) || [];
      const realized = (typeof moc.scope_realized === 'string' ? JSON.parse(moc.scope_realized) : moc.scope_realized) || [];

      for (let i = 0; i < baseline.length; i++) {
        const bp = baseline[i];
        const ep = postChange[i];
        const rp = realized[i];
        const bv = bp?.value;
        const ev = ep?.value ?? null;
        const rv = rp?.value ?? null;

        let deltaExpected = '';
        if (bv != null && ev != null) {
          const d = ev - bv;
          deltaExpected = `${d >= 0 ? '+' : ''}${Number.isInteger(d) ? d : d.toFixed(2)}`;
        }

        let deltaRealized = '';
        let pctRealized = '';
        if (bv != null && rv != null) {
          const d = rv - bv;
          deltaRealized = `${d >= 0 ? '+' : ''}${Number.isInteger(d) ? d : d.toFixed(2)}`;
          if (bv !== 0) {
            const pct = ((rv - bv) / Math.abs(bv)) * 100;
            pctRealized = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
          } else {
            pctRealized = rv === 0 ? '0%' : 'N/A';
          }
        }

        rows.push([
          moc.moc_number || `MOC-${moc.id}`,
          moc.title,
          formatStatus(moc.status),
          moc.creator_name,
          new Date(moc.created_at).toISOString().split('T')[0],
          bp.name,
          bp.unit || '',
          bv != null ? String(bv) : '',
          ev != null ? String(ev) : '',
          rv != null ? String(rv) : '',
          deltaExpected,
          deltaRealized,
          pctRealized,
        ]);
      }
    }

    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="improvements_report.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Improvements CSV export error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
