import { env } from "@/shared/config/env";
import { logger } from "@/shared/logging/logger";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Development mailer: prints the message to the server log. Verification and
 * password-reset links are therefore visible in `npm run dev` output.
 */
class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    logger.info({ to: message.to, subject: message.subject }, "[mail] message queued (console mailer)");
    console.log(
      `\n────────── MAIL to ${message.to} ──────────\n${message.subject}\n\n${message.text}\n──────────────────────────────────────────\n`,
    );
  }
}

/** Placeholder for a real transport (SMTP / Resend). Not needed for the MVP demo. */
class SmtpMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    if (!env().SMTP_URL) throw new Error("SMTP_URL is not configured");
    // Intentionally unimplemented in the MVP: wire nodemailer here.
    logger.warn({ to: message.to }, "[mail] SMTP transport not implemented; falling back to console");
    await new ConsoleMailer().send(message);
  }
}

let instance: Mailer | undefined;

export function mailer(): Mailer {
  if (!instance) instance = env().MAILER_PROVIDER === "smtp" ? new SmtpMailer() : new ConsoleMailer();
  return instance;
}
