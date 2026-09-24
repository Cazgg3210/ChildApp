import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/shared/logging/logger";
import { platformSettingsService } from "@/modules/platform/application/platform-settings.service";

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

/**
 * Resolves the transport from the platform settings on every send, so an
 * administrator can switch to SMTP from /admin without redeploying. The
 * nodemailer transport is cached per configuration.
 */
class DynamicMailer implements Mailer {
  private transporter?: { key: string; instance: Transporter };
  private console = new ConsoleMailer();

  async send(message: MailMessage): Promise<void> {
    const { value } = await platformSettingsService.mail();
    if (value.provider !== "smtp") return this.console.send(message);
    if (!value.host) throw new Error("SMTP host is not configured");
    const password = await platformSettingsService.mailPassword();
    const key = JSON.stringify([value.host, value.port, value.secure, value.user, password]);
    if (this.transporter?.key !== key) {
      this.transporter = {
        key,
        instance: nodemailer.createTransport({
          host: value.host,
          port: value.port,
          secure: value.secure,
          auth: value.user ? { user: value.user, pass: password } : undefined,
        }),
      };
    }
    const info = await this.transporter.instance.sendMail({
      from: value.from || undefined,
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
  if (!instance) instance = new DynamicMailer();
  return instance;
}
