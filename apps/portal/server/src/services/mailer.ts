import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;
  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user, pass: password },
  });
  return transporter;
}

export async function sendPasswordReset(email: string, resetLink: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] SMTP unconfigured — would send reset to ${email}: ${resetLink}`);
    return;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@acme.demo',
    to: email,
    subject: 'Acme Portal — set your password',
    text:
      `Hi,\n\nUse the link below to set your password for the Acme Industries portal:\n\n` +
      `${resetLink}\n\nThis link expires in 2 hours. If you didn't request this, ignore this email.\n`,
  });
}
