import "server-only";
import nodemailer from "nodemailer";
import { allAdminEmails } from "./admins";

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

export interface SendOptions {
  /** Mark the message high-priority (adds Importance/X-Priority headers). */
  urgent?: boolean;
}

/** Everyone who should receive alerts: all admins, plus ALERT_EMAIL_TO if set. */
function recipients(): string[] {
  const extra = (process.env.ALERT_EMAIL_TO ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...allAdminEmails(), ...extra]));
}

export function emailConfigured(): boolean {
  // Recipients always include the hardcoded admin allowlist, so the only thing
  // that can actually be missing is the Gmail credentials.
  return Boolean(process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim());
}

export async function sendAlertEmail(subject: string, html: string, opts: SendOptions = {}): Promise<EmailResult> {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  const to = recipients();

  if (!user || !pass || to.length === 0) {
    return { sent: false, message: "Email not configured — set GMAIL_USER, GMAIL_APP_PASSWORD and at least one admin/ALERT_EMAIL_TO recipient" };
  }

  try {
    // Default to Gmail's SMTP host. An explicit SMTP_HOST (with optional
    // SMTP_PORT / SMTP_SECURE) overrides it — e.g. a different provider or a
    // custom relay — without changing any code.
    const host = process.env.SMTP_HOST?.trim();
    // `|| 587` (not `??`) so a blank SMTP_PORT falls back to 587 instead of
    // becoming Number("") = 0.
    const port = Number(process.env.SMTP_PORT?.trim() || 587);
    const transport = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: (process.env.SMTP_SECURE ?? "").toLowerCase() === "true" || port === 465,
          auth: { user, pass },
        })
      : nodemailer.createTransport({ service: "gmail", auth: { user, pass } });

    const fromName = process.env.ALERT_FROM_NAME?.trim() || "API Monitor";
    await transport.sendMail({
      from: `${fromName} <${user}>`,
      to,
      subject,
      html,
      ...(opts.urgent
        ? {
            priority: "high" as const,
            headers: {
              "X-Priority": "1 (Highest)",
              "X-MSMail-Priority": "High",
              Importance: "high",
            },
          }
        : {}),
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, message: (e as Error).message };
  }
}
