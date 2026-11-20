import { routing, type AppLocale } from "@/i18n/routing";

export function asLocale(value: string): AppLocale {
  return (routing.locales as readonly string[]).includes(value)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

/** Only same-site paths inside the app are accepted as "return to" targets (no open redirects). */
export function safeNext(
  next: string | undefined | null,
  locale: AppLocale,
): string {
  if (
    !next ||
    !next.startsWith(`/${locale}/`) ||
    next.startsWith("//") ||
    next.includes("\\")
  )
    return `/${locale}/start`;
  return next;
}
