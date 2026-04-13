import nodemailer from 'nodemailer';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`${name} is not configured`);
  }
  return v.trim();
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`${name} must be a number`);
  }
  return n;
}

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let _transport: nodemailer.Transporter | null = null;

function transport(): nodemailer.Transporter {
  if (_transport) return _transport;

  const host = requiredEnv('MAIL_HOST');
  const port = numberEnv('MAIL_PORT', 1025);
  const user = process.env.MAIL_USER?.trim() || undefined;
  const pass = process.env.MAIL_PASS?.trim() || undefined;

  _transport = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: user && pass ? { user, pass } : undefined,
  });
  return _transport;
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const from = process.env.MAIL_FROM?.trim() || 'no-reply@localhost';
  await transport().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
