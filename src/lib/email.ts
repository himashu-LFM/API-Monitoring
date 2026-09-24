import "server-only";
import nodemailer from "nodemailer";

/**
 * Gmail SMTP sender.
 *
 * GMAIL_APP_PASSWORD must be a Google *App Password* (16 chars, generated at
 * myaccount.google.com/apppasswords with 2FA enabled) — a normal account
 * password will be rejected by Gmail.
 */
export interface EmailResult {
  sent: boolean;
  message?: string;
}

export function emailConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_USER?.trim() &&
    process.env.GMAIL_APP_PASSWORD?.trim() &&
    process.env.ALERT_EMAIL_TO?.trim(),
  );
}

export async function sendAlertEmail(subject: string, html: string): Promise<EmailResult> {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  const to = process.env.ALERT_EMAIL_TO?.trim();

  if (!user || !pass || !to) {
    return { sent: false, message: "Email not configured — set GMAIL_USER, GMAIL_APP_PASSWORD and ALERT_EMAIL_TO" };
  }

  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    await transport.sendMail({
      from: `API Monitor <${user}>`,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, message: (e as Error).message };
  }
}
