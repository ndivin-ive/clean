import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

function layout(
  title: string,
  intro: string,
  cta: string,
  url: string,
  footer: string,
) {
  const text = `${title}\n\n${intro}\n\n${url}\n\n${footer}\n`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f2f2f7;padding:24px">
<div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1><p style="color:#3c3c43">${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#007aff;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">${escapeHtml(cta)}</a></p>
<p style="color:#8e8e93;font-size:13px">${escapeHtml(footer)}</p></div></body></html>`;
  return { text, html };
}

export async function magicLinkEmail(locale: AppLocale, url: string) {
  const t = await getTranslations({ locale, namespace: "Email" });
  return {
    subject: t("magicSubject"),
    ...layout(
      t("magicTitle"),
      t("magicIntro"),
      t("magicCta"),
      url,
      t("magicFooter"),
    ),
  };
}

export async function invitationEmail(
  locale: AppLocale,
  url: string,
  organization: string,
  inviter: string,
) {
  const t = await getTranslations({ locale, namespace: "Email" });
  return {
    subject: t("inviteSubject", { organization }),
    ...layout(
      t("inviteTitle", { organization }),
      t("inviteIntro", { inviter, organization }),
      t("inviteCta"),
      url,
      t("inviteFooter"),
    ),
  };
}
