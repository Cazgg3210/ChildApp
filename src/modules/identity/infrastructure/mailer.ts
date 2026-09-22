import nodemailer, { type Transporter } from "nodemailer";
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
 * Development mailer: prints the message to the server log. Verification,
 * password-reset and invitation links are therefore visible in `npm run dev`
 * output.
 */
class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    logger.info({ to: message.to, subject: message.subject }, "[mail] message queued (console mailer)");
    console.log(
      `\n────────── MAIL to ${message.to} ──────────\n${message.subject}\n\n${message.text}\n──────────────────────────────────────────\n`,
    );
  }
}

/** SMTP transport (any provider: Resend, Postmark, SES, Gmail…) configured with SMTP_URL. */
class SmtpMailer implements Mailer {
  private transporter: Transporter;

  constructor(url: string) {
    this.transporter = nodemailer.createTransport(url);
  }

  async send(message: MailMessage): Promise<void> {
    const info = await this.transporter.sendMail({
      from: env().MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    logger.info({ to: message.to, subject: message.subject, messageId: info.messageId }, "[mail] sent");
  }
}

let instance: Mailer | undefined;

export function mailer(): Mailer {
  if (!instance) {
    const e = env();
    if (e.MAILER_PROVIDER === "smtp") {
      if (!e.SMTP_URL) throw new Error("MAILER_PROVIDER=smtp requires SMTP_URL");
      instance = new SmtpMailer(e.SMTP_URL);
    } else {
      instance = new ConsoleMailer();
    }
  }
  return instance;
}
