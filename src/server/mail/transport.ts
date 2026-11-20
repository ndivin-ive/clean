import nodemailer, { type Transporter } from "nodemailer";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "mailpit"]);
let transporter: Transporter | undefined;

/**
 * Outgoing mail. Refuses non-local SMTP hosts unless MAIL_ALLOW_EXTERNAL=true,
 * which must only be set after the product owner approves sending real email
 * (CLAUDE.md stop-and-ask rule). Message bodies are never logged.
 */
export function getTransport(): Transporter {
  if (transporter) return transporter;
  const url = process.env.SMTP_URL ?? "smtp://localhost:1025";
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host) && process.env.MAIL_ALLOW_EXTERNAL !== "true") {
    throw new Error(
      `Refusing to send email through non-local SMTP host "${host}" (set MAIL_ALLOW_EXTERNAL=true only after approval).`,
    );
  }
  transporter = nodemailer.createTransport(url);
  return transporter;
}

export async function sendMail(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  await getTransport().sendMail({
    from: process.env.EMAIL_FROM ?? "CLEAN <no-reply@clean.localhost>",
    ...msg,
  });
}
