import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { simpleParser } from "mailparser";
import { SMTPServer } from "smtp-server";

/** Local SMTP sink for end-to-end tests: each message is written as JSON to MAIL_DIR. Nothing leaves the machine. */
export const MAIL_PORT = Number(process.env.E2E_SMTP_PORT ?? 2525);
export const MAIL_DIR = join(process.cwd(), "test-results", "mail");

export interface StoredMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  at: number;
}

export function startMailSink(): Promise<() => Promise<void>> {
  rmSync(MAIL_DIR, { recursive: true, force: true });
  mkdirSync(MAIL_DIR, { recursive: true });
  let n = 0;
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS", "AUTH"],
    onData(stream, _session, callback) {
      simpleParser(stream)
        .then((m) => {
          const to = Array.isArray(m.to)
            ? m.to.flatMap((a) => a.value)
            : (m.to?.value ?? []);
          const mail: StoredMail = {
            to: to.map((a) => a.address ?? "").join(","),
            subject: m.subject ?? "",
            text: m.text ?? "",
            html: typeof m.html === "string" ? m.html : "",
            at: Date.now(),
          };
          writeFileSync(
            join(MAIL_DIR, `${Date.now()}-${++n}.json`),
            JSON.stringify(mail),
          );
          callback();
        })
        .catch(callback);
    },
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(MAIL_PORT, "127.0.0.1", () =>
      resolve(() => new Promise((r) => server.close(() => r()))),
    );
  });
}

/** Latest mail to `email` received after `since` (polls up to 15 s). */
export async function waitForMail(
  email: string,
  since: number,
): Promise<StoredMail> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const mails = readdirSync(MAIL_DIR)
      .sort()
      .reverse()
      .map(
        (f) =>
          JSON.parse(readFileSync(join(MAIL_DIR, f), "utf8")) as StoredMail,
      );
    const hit = mails.find(
      (m) => m.to.toLowerCase().includes(email.toLowerCase()) && m.at >= since,
    );
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No email to ${email}`);
}

export const firstLink = (mail: StoredMail) => {
  const m = /(https?:\/\/[^\s"<>]+)/.exec(mail.text);
  if (!m) throw new Error("No link in email");
  return m[1]!;
};
